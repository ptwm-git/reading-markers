import { MarkdownView, Notice } from 'obsidian';
import type { TFile } from 'obsidian';
import { parseMarkers } from './marker-format';
import { strings } from './i18n';
import { MarkerService } from './marker-service';
import {
	getNavigationTargets,
	renderReadingNavigation,
} from './reading-navigation';
import type { ReadingMarker } from './types';

interface MarkdownNavigationViewState {
	host: HTMLElement;
	file: TFile;
	markers: ReadingMarker[];
	totalLines: number;
}

export class MarkdownNavigationManager {
	private readonly states = new WeakMap<MarkdownView, MarkdownNavigationViewState>();

	constructor(
		private readonly service: MarkerService,
		private readonly getCenter: (filePath: string) => string | null,
		private readonly getLeaves: () => { view: unknown }[],
	) {}

	syncAll(leaves: { view: unknown }[]): void {
		for (const leaf of leaves) {
			const view = asMarkdownView(leaf.view);
			if (view) {
				this.syncView(view);
			}
		}
	}

	syncView(view: MarkdownView): void {
		if (!view.file || view.file.extension.toLowerCase() !== 'md') {
			this.states.get(view)?.host.remove();
			return;
		}

		const file = view.file;
		let state = this.states.get(view);
		if (!state) {
			const host = view.containerEl.createDiv({
				cls: 'reading-markers-navigation-host',
			});
			state = { host, file, markers: [], totalLines: 0 };
			this.states.set(view, state);
			view.containerEl.addEventListener(
				'scroll',
				() => this.render(view),
				true,
			);
		}

		state.file = file;
		void this.loadMarkers(view, state, file);
	}

	refreshFile(filePath: string): void {
		for (const leaf of this.getLeaves()) {
			const view = asMarkdownView(leaf.view);
			if (view?.file?.path === filePath) {
				this.syncView(view);
			}
		}
	}

	private async loadMarkers(
		view: MarkdownView,
		state: MarkdownNavigationViewState,
		file: TFile,
	): Promise<void> {
		const source = view.getMode() === 'source'
			? view.editor.getValue()
			: await this.service.app.vault.cachedRead(file);
		if (view.file?.path !== file.path) {
			return;
		}

		state.markers = parseMarkers(source);
		state.totalLines = source.split('\n').length;
		this.render(view);
	}

	private render(view: MarkdownView): void {
		const state = this.states.get(view);
		if (!state || view.file?.path !== state.file.path) {
			return;
		}

		const currentPosition = getCurrentMarkdownLine(view, state.totalLines);
		const markers = state.markers.map((marker) => ({
			id: marker.blockId,
			position: marker.line,
		}));
		const centerId = this.getCenter(state.file.path);
		const targets = getNavigationTargets(markers, currentPosition, centerId);

		renderReadingNavigation(
			state.host,
			{
				hasPrevious: targets.previous !== null,
				centerEnabled: true,
				hasNext: targets.next !== null,
			},
			{
				goPrevious: () => {
					if (targets.previous) {
						this.service.jumpToMarker(state.file, targets.previous.id);
					}
				},
				goCenter: () => {
					if (targets.center) {
						this.service.jumpToMarker(state.file, targets.center.id);
						return;
					}
					new Notice(strings().navigationCenterRequiresMarker);
				},
				goNext: () => {
					if (targets.next) {
						this.service.jumpToMarker(state.file, targets.next.id);
					}
				},
			},
		);
	}
}

function getCurrentMarkdownLine(view: MarkdownView, totalLines: number): number {
	if (view.getMode() === 'source') {
		return Math.min(Math.max(view.editor.getCursor().line, 0), Math.max(0, totalLines - 1));
	}

	const scrollElement = findScrollElement(view);
	const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
	if (maxScroll === 0 || totalLines <= 1) {
		return 0;
	}

	const ratio = Math.min(1, Math.max(0, scrollElement.scrollTop / maxScroll));
	return Math.round(ratio * (totalLines - 1));
}

function findScrollElement(view: MarkdownView): HTMLElement {
	const preview = view.contentEl.querySelector<HTMLElement>('.markdown-preview-view');
	if (preview) {
		return preview;
	}
	return view.contentEl;
}

function asMarkdownView(value: unknown): MarkdownView | null {
	if (!(value instanceof MarkdownView)) {
		return null;
	}
	return value;
}
