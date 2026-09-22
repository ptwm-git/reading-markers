import { Component, Menu, Notice } from 'obsidian';
import type { FileView, TFile } from 'obsidian';
import { strings } from './i18n';
import { PluginLogger } from './logger';
import { PdfMarkerService } from './pdf-marker-service';
import { PdfReadingMarker } from './types';
import { MarkerBarActions, MarkerBarEntry, renderMarkerBar } from './ui/marker-bar';
import { destroyReadingNavigation, getNavigationTargets, removeStaleNavigation, renderReadingNavigation } from './reading-navigation';
import { ReturnPositionModal } from './ui/return-position-modal';
import { PdfLocation, ReadingSession, renamedPath } from './reading-position';
import { ReadingNavigationServices, ReadingTracker } from './reading-tracker';

const PAGE_SELECTOR = '.page[data-page-number]';

interface PdfState {
	file: TFile;
	bar: HTMLElement;
	navigation: HTMLElement;
	action: HTMLElement;
	session: ReadingSession;
	tracker: ReadingTracker;
	events: Component;
}

export class PdfViewManager extends Component {
	private readonly states = new Map<FileView, PdfState>();

	constructor(
		private readonly service: PdfMarkerService,
		private readonly getMarkers: () => PdfReadingMarker[],
		private readonly getCenter: (filePath: string) => string | null,
		private readonly createActions: (file: TFile) => MarkerBarActions,
		private readonly logger: PluginLogger,
		private readonly getLeaves: () => { view: unknown }[],
		private readonly services: ReadingNavigationServices,
	) { super(); }

	syncAll(leaves: { view: unknown }[]): void {
		const views = leaves.map((leaf) => asFileView(leaf.view)).filter((view): view is FileView => !!view);
		for (const [view, state] of this.states) {
			if (!views.includes(view) || !view.file) this.dispose(view, state);
		}
		for (const view of views) this.syncView(view);
	}

	syncView(view: FileView): void {
		const file = view.file;
		if (view.getViewType() !== 'pdf' || !file) return;
		const previous = this.states.get(view);
		if (previous && previous.file !== file) this.dispose(view, previous);
		if (!this.states.has(view)) this.attachView(view, file);
		this.render(view);
	}

	refreshFile(path: string): void {
		for (const leaf of this.getLeaves()) {
			const view = asFileView(leaf.view);
			if (view?.file?.path === path) this.syncView(view);
		}
	}

	rename(oldPath: string, newPath: string): void {
		for (const state of this.states.values()) {
			state.session.filePath = renamedPath(state.session.filePath, oldPath, newPath);
		}
	}

	beginExternalJump(view: FileView): void {
		const state = this.states.get(view);
		const current = capturePdfLocation(view.containerEl);
		if (!state || !current) return;
		state.tracker.suppress();
		state.session.beginDetour(current, state.session.returnLocation === null);
		this.renderNavigation(view);
	}

	jumpToMarker(filePath: string, markerId: string, targetView?: FileView): void {
		const marker = this.getMarkers().find((item) => item.filePath === filePath && item.id === markerId);
		const view = targetView ?? Array.from(this.states.keys()).find((item) => item.file?.path === filePath);
		if (!marker || !view || view.file?.path !== filePath) {
			new Notice(strings().pdfMarkerMissing);
			return;
		}
		this.syncView(view);
		void this.jump(view, { kind: 'pdf', page: marker.page, offset: 0 });
	}

	navigate(view: FileView, action: 'previous' | 'next' | 'center' | 'resume' | 'continue'): void {
		const state = this.states.get(view);
		if (!state || view.file !== state.file) return;
		const current = capturePdfLocation(view.containerEl);
		if (action === 'continue') {
			if (current) state.session.continueAt(current);
			this.renderNavigation(view);
			return;
		}
		if (action === 'center' || action === 'resume') {
			const location = action === 'center' ? state.session.returnLocation : this.services.getProgress(state.file.path);
			if (location?.kind === 'pdf') {
				state.tracker.suppress();
				void this.jump(view, location).then((ok) => {
					if (ok && this.states.get(view) === state && view.file === state.file) {
						state.session.continueAt(location);
						this.renderNavigation(view);
					}
				});
			} else if (action === 'center') {
				const center = this.getCenter(state.file.path);
				if (center) {
					state.tracker.suppress();
					this.jumpToMarker(state.file.path, center, view);
				} else new Notice(strings().navigationCenterRequiresMarker);
			} else new Notice(strings().noReadingProgress);
			return;
		}
		if (!current) {
			new Notice(strings().pdfPageUnavailable);
			return;
		}
		const markers = this.getMarkers().filter((item) => item.filePath === state.file.path);
		const target = getNavigationTargets(markers.map((item) => ({
			id: item.id, position: item.page,
		})), current.page, this.getCenter(state.file.path))[action];
		if (!target) return;
		const jump = (saveReturn: boolean): void => {
			if (this.states.get(view) !== state || view.file !== state.file) {
				new Notice(strings().documentSwitched);
				return;
			}
			state.tracker.suppress();
			state.session.beginDetour(current, saveReturn);
			this.jumpToMarker(state.file.path, target.id, view);
			this.renderNavigation(view);
		};
		new ReturnPositionModal(this.service.app, () => jump(true), () => jump(false)).open();
	}

	onunload(): void {
		for (const [view, state] of this.states) this.dispose(view, state);
	}

	private attachView(view: FileView, file: TFile): void {
		// Versions before 1.3.0 left UI behind when disabled or upgraded in place.
		const legacyUi = view.containerEl.querySelector('.reading-markers-navigation-host, .reading-markers-pdf-bar-host');
		if (legacyUi) {
			for (const action of Array.from(view.containerEl.querySelectorAll<HTMLElement>('.view-action'))) {
				if ([strings().addReadingMarker, strings().addPdfReadingMarker].includes(action.getAttribute('aria-label') ?? '')) action.remove();
			}
		}
		removeStaleNavigation(view.containerEl);
		for (const bar of Array.from(view.containerEl.querySelectorAll('.reading-markers-pdf-bar-host'))) bar.remove();
		const events = this.addChild(new Component());
		const session = new ReadingSession(file.path, (path, location) => this.services.saveProgress(path, location));
		const tracker = events.addChild(new ReadingTracker(view, session,
			() => view.file === file ? capturePdfLocation(view.containerEl) : null, () => this.renderNavigation(view)));
		const bar = createDiv({ cls: 'reading-markers-pdf-bar-host' });
		const navigation = view.containerEl.createDiv({ cls: 'reading-markers-navigation-host' });
		const action = view.addAction('tag', strings().addPdfReadingMarker, () => {
			const page = getVisiblePdfPage(view.containerEl);
			if (view.file !== file || page === null) {
				new Notice(strings().pdfPageUnavailable);
				return;
			}
			this.service.openColorPicker(file, page);
		});
		this.states.set(view, { file, bar, navigation, action, session, tracker, events });
		events.registerDomEvent(view.containerEl, 'contextmenu', (event) => {
			if (view.file !== file) return;
			const page = getPdfPageFromTarget(event.target, view.containerEl);
			if (page === null) return;
			event.preventDefault();
			event.stopPropagation();
			const menu = new Menu();
			menu.addItem((item) => item.setTitle(strings().addPdfReadingMarker).setIcon('tag')
				.onClick(() => this.service.openColorPicker(file, page)));
			menu.showAtMouseEvent(event);
		}, true);
		events.registerDomEvent(view.contentEl, 'scroll', () => this.renderNavigation(view), true);
		this.logger.debug('attach-pdf-view', { viewType: view.getViewType() });
	}

	private render(view: FileView): void {
		const state = this.states.get(view);
		if (!state) return;
		const viewer = view.containerEl.querySelector<HTMLElement>('.pdfViewer');
		const parent = viewer?.parentElement ?? view.contentEl;
		if (viewer && (state.bar.parentElement !== parent || state.bar.nextElementSibling !== viewer)) parent.insertBefore(state.bar, viewer);
		else if (state.bar.parentElement !== parent) parent.prepend(state.bar);
		const markers = this.getMarkers().filter((item) => item.filePath === state.file.path);
		const textLayerDetected = Array.from(view.containerEl.querySelectorAll('.textLayer'))
			.some((layer) => !!layer.textContent?.trim());
		const scanned = view.containerEl.querySelectorAll(PAGE_SELECTOR).length > 0 && !textLayerDetected;
		const signature = JSON.stringify([scanned, markers]);
		if (state.bar.dataset.signature === signature) { this.renderNavigation(view); return; }
		state.bar.dataset.signature = signature;
		state.bar.empty();
		if (scanned) state.bar.createDiv({ cls: 'reading-markers-pdf-status', text: strings().pdfScannedNotice });
		if (markers.length) renderMarkerBar(state.bar.createDiv(), toMarkerBarEntries(markers), this.createActions(state.file));
		state.bar.toggleClass('reading-markers-pdf-host-visible', scanned || markers.length > 0);
		this.renderNavigation(view);
	}

	private renderNavigation(view: FileView): void {
		const state = this.states.get(view);
		if (!state || view.file !== state.file) return;
		const current = capturePdfLocation(view.containerEl);
		const markers = this.getMarkers().filter((item) => item.filePath === state.file.path);
		const targets = getNavigationTargets(markers.map((item) => ({
			id: item.id, position: item.page,
		})), current?.page ?? 0, this.getCenter(state.file.path));
		renderReadingNavigation(state.navigation, {
			hasPrevious: !!current && targets.previous !== null, hasNext: !!current && targets.next !== null,
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

	private async jump(view: FileView, location: PdfLocation): Promise<boolean> {
		const file = view.file;
		let page = view.containerEl.querySelector<HTMLElement>(`${PAGE_SELECTOR}[data-page-number="${location.page}"]`);
		if (!page) {
			view.setEphemeralState({ subpath: `#page=${location.page}` });
			for (let attempt = 0; attempt < 10 && !page; attempt++) {
				await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
				if (view.file !== file || !this.states.has(view)) return false;
				page = view.containerEl.querySelector<HTMLElement>(`${PAGE_SELECTOR}[data-page-number="${location.page}"]`);
			}
		}
		if (!page) {
			new Notice(strings().pdfPageUnavailable);
			return false;
		}
		const scroller = pdfScroller(view.containerEl);
		scroller.scrollTop += page.getBoundingClientRect().top - scroller.getBoundingClientRect().top +
			location.offset * page.getBoundingClientRect().height;
		return true;
	}

	private dispose(view: FileView, state: PdfState): void {
		this.removeChild(state.events);
		destroyReadingNavigation(state.navigation);
		state.bar.remove();
		state.navigation.remove();
		state.action.remove();
		this.states.delete(view);
	}
}

function asFileView(value: unknown): FileView | null {
	if (!value || typeof value !== 'object') return null;
	const view = value as Partial<FileView>;
	return typeof view.getViewType === 'function' && view.getViewType() === 'pdf' &&
		'file' in view && 'containerEl' in view && 'contentEl' in view ? view as FileView : null;
}

function toMarkerBarEntries(markers: PdfReadingMarker[]): MarkerBarEntry[] {
	return markers.map((marker) => ({
		markerId: marker.id, color: marker.color, label: strings().pdfPageLabel(marker.page),
	}));
}

function pdfScroller(container: HTMLElement): HTMLElement {
	let parent = container.querySelector<HTMLElement>(PAGE_SELECTOR)?.parentElement;
	while (parent && parent !== container) {
		if (parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(
			parent.ownerDocument.defaultView?.getComputedStyle(parent).overflowY ?? '',
		)) return parent;
		parent = parent.parentElement;
	}
	return container.querySelector<HTMLElement>('.pdfViewerContainer') ?? container;
}

export function getPdfPageFromTarget(target: EventTarget | null, container: HTMLElement): number | null {
	if (!(target instanceof Element)) return null;
	const page = target.closest<HTMLElement>(PAGE_SELECTOR);
	return page && container.contains(page) ? parsePageNumber(page) : null;
}

export function getVisiblePdfPage(container: HTMLElement): number | null {
	return capturePdfLocation(container)?.page ?? null;
}

export function capturePdfLocation(container: HTMLElement): PdfLocation | null {
	const viewport = pdfScroller(container).getBoundingClientRect();
	if (viewport.height === 0) return null;
	let best: { page: number; score: number; offset: number } | null = null;
	for (const element of Array.from(container.querySelectorAll<HTMLElement>(PAGE_SELECTOR))) {
		const page = parsePageNumber(element);
		if (page === null) continue;
		const bounds = element.getBoundingClientRect();
		const visible = Math.max(0, Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top));
		if (visible === 0) continue;
		const score = visible * 1000 - Math.abs(bounds.top - viewport.top);
		if (!best || score > best.score) best = {
			page, score, offset: Math.min(1, Math.max(0, (viewport.top - bounds.top) / Math.max(1, bounds.height))),
		};
	}
	return best ? { kind: 'pdf', page: best.page, offset: best.offset } : null;
}

function parsePageNumber(page: HTMLElement): number | null {
	const value = Number(page.dataset.pageNumber);
	return Number.isInteger(value) && value > 0 ? value : null;
}
