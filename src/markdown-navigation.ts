import { Component, MarkdownView, Notice } from 'obsidian';
import type { TFile } from 'obsidian';
import { parseMarkers } from './marker-format';
import { strings } from './i18n';
import { MarkerService } from './marker-service';
import { destroyReadingNavigation, getNavigationTargets, removeStaleNavigation, renderReadingNavigation } from './reading-navigation';
import type { ReadingMarker } from './types';
import { ReturnPositionModal } from './ui/return-position-modal';
import { ReadingSession, renamedPath } from './reading-position';
import { captureMarkdownLocation, restoreMarkdownLocation } from './reading-position-view';
import { ReadingNavigationServices, ReadingTracker } from './reading-tracker';

interface ViewState {
	host: HTMLElement;
	file: TFile;
	markers: ReadingMarker[];
	source: string;
	session: ReadingSession;
	tracker: ReadingTracker;
	events: Component;
	revision: number;
}

export class MarkdownNavigationManager extends Component {
	private readonly states = new Map<MarkdownView, ViewState>();

	constructor(
		private readonly service: MarkerService,
		private readonly getCenter: (filePath: string) => string | null,
		private readonly getLeaves: () => { view: unknown }[],
		private readonly services: ReadingNavigationServices,
	) { super(); }

	syncAll(leaves: { view: unknown }[]): void {
		const views = leaves.map((leaf) => leaf.view).filter((view): view is MarkdownView => view instanceof MarkdownView);
		for (const [view, state] of this.states) {
			if (!views.includes(view) || !view.file) this.dispose(view, state);
		}
		for (const view of views) this.syncView(view);
	}

	syncView(view: MarkdownView): void {
		const file = view.file;
		if (!file) return;
		let state = this.states.get(view);
		if (state && state.file !== file) {
			this.dispose(view, state);
			state = undefined;
		}
		if (!state) {
			removeStaleNavigation(view.containerEl);
			const host = view.containerEl.createDiv({ cls: 'reading-markers-navigation-host' });
			const session = new ReadingSession(file.path, (path, location) => this.services.saveProgress(path, location));
			const events = this.addChild(new Component());
			const tracker = events.addChild(new ReadingTracker(view, session,
				() => this.capture(view), () => this.render(view)));
			state = { host, file, source: '', markers: [], session, tracker, events, revision: 0 };
			this.states.set(view, state);
			events.registerDomEvent(view.contentEl, 'scroll', () => this.render(view), true);
		}
		const current = state;
		const revision = ++current.revision;
		const source = view.getMode() === 'source'
			? Promise.resolve(view.editor.getValue()) : this.service.app.vault.cachedRead(file);
		void source.then((text) => {
			if (this.states.get(view) !== current || revision !== current.revision || view.file !== file) return;
			current.source = text;
			current.markers = parseMarkers(text);
			this.render(view);
		}).catch(() => new Notice(strings().operationFailed));
	}

	refreshFile(filePath: string): void {
		for (const leaf of this.getLeaves()) {
			if (leaf.view instanceof MarkdownView && leaf.view.file?.path === filePath) this.syncView(leaf.view);
		}
	}

	rename(oldPath: string, newPath: string): void {
		for (const state of this.states.values()) {
			state.session.filePath = renamedPath(state.session.filePath, oldPath, newPath);
		}
	}

	beginExternalJump(view: MarkdownView): void {
		const state = this.states.get(view);
		const current = this.capture(view);
		if (!state || !current) return;
		state.tracker.suppress();
		state.session.beginDetour(current, state.session.returnLocation === null);
		this.render(view);
	}

	navigate(view: MarkdownView, action: 'previous' | 'next' | 'center' | 'resume' | 'continue'): void {
		const state = this.states.get(view);
		if (!state || view.file !== state.file) return;
		const current = this.capture(view);
		if (action === 'continue') {
			if (current) state.session.continueAt(current);
			this.render(view);
			return;
		}
		if (action === 'center' || action === 'resume') {
			const location = action === 'center' ? state.session.returnLocation : this.services.getProgress(state.file.path);
			if (location?.kind === 'markdown') {
				state.tracker.suppress();
				void restoreMarkdownLocation(view, this.source(view, state), location).then((exact) => {
					if (this.states.get(view) !== state || view.file !== state.file) return;
					if (!exact) new Notice(strings().positionApproximate);
					state.session.continueAt(this.capture(view) ?? location);
					this.render(view);
				}).catch(() => new Notice(strings().operationFailed));
			} else if (action === 'center') {
				const center = this.getCenter(state.file.path);
				if (center) {
					state.tracker.suppress();
					this.service.jumpToMarker(state.file, center, view);
				} else new Notice(strings().navigationCenterRequiresMarker);
			} else new Notice(strings().noReadingProgress);
			return;
		}
		if (!current) {
			new Notice(strings().invalidTarget);
			return;
		}
		const target = getNavigationTargets(
			parseMarkers(this.source(view, state)).map((marker) => ({ id: marker.blockId, position: marker.line })),
			current.line, this.getCenter(state.file.path),
		)[action];
		if (!target) return;
		const jump = (saveReturn: boolean): void => {
			if (this.states.get(view) !== state || view.file !== state.file) {
				new Notice(strings().documentSwitched);
				return;
			}
			state.tracker.suppress();
			state.session.beginDetour(current, saveReturn);
			this.service.jumpToMarker(state.file, target.id, view);
			this.render(view);
		};
		new ReturnPositionModal(this.service.app, () => jump(true), () => jump(false)).open();
	}

	onunload(): void {
		for (const [view, state] of this.states) this.dispose(view, state);
	}

	private source(view: MarkdownView, state: ViewState): string {
		return view.getMode() === 'source' ? view.editor.getValue() : state.source;
	}

	private capture(view: MarkdownView) {
		const state = this.states.get(view);
		return state && view.file === state.file ? captureMarkdownLocation(view, this.source(view, state)) : null;
	}

	private render(view: MarkdownView): void {
		const state = this.states.get(view);
		if (!state || view.file !== state.file) return;
		const current = this.capture(view);
		const targets = getNavigationTargets(
			state.markers.map((marker) => ({ id: marker.blockId, position: marker.line })),
			current?.line ?? 0, this.getCenter(state.file.path),
		);
		renderReadingNavigation(state.host, {
			hasPrevious: !!current && targets.previous !== null,
			hasNext: !!current && targets.next !== null,
			centerEnabled: true,
			centerTitle: state.session.returnLocation ? strings().navigationReturnPosition : strings().navigationCenter,
			hasProgress: this.services.getProgress(state.file.path) !== null,
			detouring: state.session.detouring,
		}, {
			goPrevious: () => this.navigate(view, 'previous'),
			goNext: () => this.navigate(view, 'next'),
			goCenter: () => this.navigate(view, 'center'),
			resume: () => this.navigate(view, 'resume'),
			continueHere: () => this.navigate(view, 'continue'),
			openMarkers: () => this.services.openMarkers(view),
		});
	}

	private dispose(view: MarkdownView, state: ViewState): void {
		this.removeChild(state.events);
		destroyReadingNavigation(state.host);
		state.host.remove();
		this.states.delete(view);
	}
}
