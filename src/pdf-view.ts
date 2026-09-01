import { Menu, Notice, TFile } from 'obsidian';
import type { FileView } from 'obsidian';
import { strings } from './i18n';
import { PluginLogger } from './logger';
import { PdfMarkerService } from './pdf-marker-service';
import { PdfReadingMarker } from './types';
import { MarkerBarActions, MarkerBarEntry, renderMarkerBar } from './ui/marker-bar';
import {
	getNavigationTargets,
	renderReadingNavigation,
} from './reading-navigation';
import { ReturnPositionModal } from './ui/return-position-modal';

const PDF_VIEW_TYPE = 'pdf';
const PAGE_SELECTOR = '.page[data-page-number]';

export class PdfViewManager {
	private readonly attachedViews = new WeakMap<FileView, HTMLElement>();
	private readonly navigationHosts = new WeakMap<FileView, HTMLElement>();
	private readonly returnPages = new WeakMap<FileView, number>();

	constructor(
		private readonly registerDomEvent: (
			el: HTMLElement,
			type: 'contextmenu' | 'scroll',
			callback: (event: Event) => void,
			options?: boolean | AddEventListenerOptions,
		) => void,
		private readonly service: PdfMarkerService,
		private readonly getMarkers: () => PdfReadingMarker[],
		private readonly getCenter: (filePath: string) => string | null,
		private readonly createActions: (file: TFile) => MarkerBarActions,
		private readonly logger: PluginLogger,
		private readonly getLeaves: () => { view: unknown }[],
	) {}

	syncAll(leaves: { view: unknown }[]): void {
		for (const leaf of leaves) {
			const view = asFileView(leaf.view);
			if (view) {
				this.syncView(view);
			}
		}
	}

	syncView(view: FileView): void {
		const file = view.file;
		if (view.getViewType() !== PDF_VIEW_TYPE || !file || file.extension.toLowerCase() !== 'pdf') {
			return;
		}

		if (!this.attachedViews.has(view)) {
			this.attachView(view);
		}

		this.render(view, file);
	}

	refreshFile(filePath: string): void {
		for (const leaf of this.getPdfLeaves()) {
			if (leaf.file?.path === filePath) {
				this.syncView(leaf);
			}
		}
	}

	jumpToMarker(filePath: string, markerId: string): void {
		const marker = this.getMarkers().find(
			(candidate) => candidate.filePath === filePath && candidate.id === markerId,
		);
		const view = this.getPdfLeaves().find(
			(candidate) => candidate.file?.path === filePath,
		);

		if (!marker || !view) {
			new Notice(strings().pdfMarkerMissing);
			return;
		}

		this.syncView(view);
		const page = view.containerEl.querySelector<HTMLElement>(
			`${PAGE_SELECTOR}[data-page-number="${marker.page}"]`,
		);
		if (!page) {
			new Notice(strings().pdfPageUnavailable);
			return;
		}

		page.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	private attachView(view: FileView): void {
		const host = createDiv({ cls: 'reading-markers-pdf-bar-host' });
		this.attachedViews.set(view, host);
		view.addAction('tag', strings().addReadingMarker, () => {
			const file = view.file;
			if (!file || file.extension.toLowerCase() !== 'pdf') {
				new Notice(strings().noPdfFile);
				return;
			}

			const page = getVisiblePdfPage(view.containerEl);
			if (page === null) {
				new Notice(strings().pdfPageUnavailable);
				return;
			}

			this.service.openColorPicker(file, page);
		});

		this.registerDomEvent(
			view.containerEl,
			'contextmenu',
			(event) => {
				if (!(event instanceof MouseEvent)) {
					return;
				}
				const file = view.file;
				if (!file || file.extension.toLowerCase() !== 'pdf') {
					return;
				}

				const page = getPdfPageFromTarget(event.target, view.containerEl);
				if (page === null) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				const menu = new Menu();
				menu.addItem((item) => {
					item
						.setTitle(strings().addReadingMarker)
						.setIcon('tag')
						.onClick(() => this.service.openColorPicker(file, page));
				});
				menu.showAtMouseEvent(event);
			},
			true,
		);

		const navigationHost = createDiv({
			cls: 'reading-markers-navigation-host',
		});
		this.navigationHosts.set(view, navigationHost);
		view.containerEl.appendChild(navigationHost);
		this.registerDomEvent(
			view.containerEl,
			'scroll',
			() => this.renderNavigation(view),
			true,
		);
		this.logger.debug('attach-pdf-view', { viewType: view.getViewType() });
	}

	private render(view: FileView, file: TFile): void {
		const host = this.attachedViews.get(view);
		if (!host) {
			return;
		}

		const viewer = view.containerEl.querySelector<HTMLElement>('.pdfViewer, .pdfViewerContainer');
		const parent = viewer?.parentElement ?? view.contentEl;
		if (host.parentElement !== parent || (viewer && host.nextElementSibling !== viewer)) {
			if (viewer) {
				parent.insertBefore(host, viewer);
			} else if (host.parentElement !== parent) {
				parent.prepend(host);
			}
		}

		host.empty();
		const markers = this.getMarkers().filter((marker) => marker.filePath === file.path);
		const textLayerDetected = Array.from(
			view.containerEl.querySelectorAll<HTMLElement>('.textLayer'),
		).some((layer) => Boolean(layer.textContent?.trim()));
		const pageElements = view.containerEl.querySelectorAll(PAGE_SELECTOR);
		const scannedPdf = pageElements.length > 0 && !textLayerDetected;

		if (scannedPdf) {
			host.createDiv({
				cls: 'reading-markers-pdf-status',
				text: strings().pdfScannedNotice,
			});
		}

		if (markers.length > 0) {
			const bar = host.createDiv({ cls: 'reading-markers-pdf-marker-bar' });
			renderMarkerBar(bar, toMarkerBarEntries(markers), this.createActions(file));
		}

		host.toggleClass('reading-markers-pdf-host-visible', scannedPdf || markers.length > 0);
		this.renderNavigation(view, markers);
	}

	private renderNavigation(
		view: FileView,
		markers = this.getMarkers().filter((marker) => marker.filePath === view.file?.path),
	): void {
		const host = this.navigationHosts.get(view);
		const filePath = view.file?.path;
		if (!host || !filePath) {
			return;
		}

		const currentPage = getVisiblePdfPage(view.containerEl) ?? 0;
		const navigationMarkers = markers.map((marker) => ({
			id: marker.id,
			position: marker.page,
		}));
		const centerId = this.getCenter(filePath);
		const targets = getNavigationTargets(navigationMarkers, currentPage, centerId);
		const returnPage = this.returnPages.get(view);

		renderReadingNavigation(
			host,
			{
				hasPrevious: targets.previous !== null,
				centerEnabled: true,
				centerTitle: returnPage === undefined
					? strings().navigationCenter
					: strings().navigationReturnPosition,
				hasNext: targets.next !== null,
			},
			{
				goPrevious: () => this.navigateToAdjacent(view, markers, 'previous'),
				goCenter: () => {
					const currentReturnPage = this.returnPages.get(view);
					if (currentReturnPage !== undefined) {
						this.jumpToPage(view, currentReturnPage);
						return;
					}

					if (targets.center) {
						this.jumpToMarker(filePath, targets.center.id);
						return;
					}
					new Notice(strings().navigationCenterRequiresMarker);
				},
				goNext: () => this.navigateToAdjacent(view, markers, 'next'),
			},
		);
	}

	private navigateToAdjacent(
		view: FileView,
		markers: PdfReadingMarker[],
		direction: 'previous' | 'next',
	): void {
		const filePath = view.file?.path;
		if (!filePath) {
			return;
		}

		const currentPage = getVisiblePdfPage(view.containerEl) ?? 0;
		const navigationMarkers = markers.map((marker) => ({
			id: marker.id,
			position: marker.page,
		}));
		const target = getNavigationTargets(
			navigationMarkers,
			currentPage,
			this.getCenter(filePath),
		)[direction];
		if (!target) {
			return;
		}

		new ReturnPositionModal(
			this.service.app,
			() => {
				this.returnPages.set(view, currentPage);
				this.jumpToMarker(filePath, target.id);
				this.renderNavigation(view, markers);
			},
			() => this.jumpToMarker(filePath, target.id),
		).open();
	}

	private jumpToPage(view: FileView, pageNumber: number): void {
		const page = view.containerEl.querySelector<HTMLElement>(
			`${PAGE_SELECTOR}[data-page-number="${pageNumber}"]`,
		);
		if (!page) {
			new Notice(strings().pdfPageUnavailable);
			return;
		}

		page.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	private getPdfLeaves(): FileView[] {
		return this.getLeaves()
			.map((leaf) => asFileView(leaf.view))
			.filter((view): view is FileView => view !== null)
			.filter((view) => view.getViewType() === PDF_VIEW_TYPE);
	}
}

function asFileView(value: unknown): FileView | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const view = value as Partial<FileView>;
	return typeof view.getViewType === 'function' &&
		'file' in view &&
		'containerEl' in view &&
		'contentEl' in view
		? view as FileView
		: null;
}

function toMarkerBarEntries(markers: PdfReadingMarker[]): MarkerBarEntry[] {
	return markers.map((marker) => ({
		markerId: marker.id,
		color: marker.color,
		label: strings().pdfPageLabel(marker.page),
	}));
}

export function getPdfPageFromTarget(target: EventTarget | null, container: HTMLElement): number | null {
	if (!(target instanceof HTMLElement)) {
		return null;
	}

	const page = target.closest<HTMLElement>(PAGE_SELECTOR);
	if (!page || !container.contains(page)) {
		return null;
	}

	return parsePageNumber(page);
}

export function getVisiblePdfPage(container: HTMLElement): number | null {
	const pages = Array.from(container.querySelectorAll<HTMLElement>(PAGE_SELECTOR));
	if (pages.length === 0) {
		return null;
	}

	const viewport = container.getBoundingClientRect();
	let best: { page: number; score: number } | null = null;
	for (const element of pages) {
		const page = parsePageNumber(element);
		if (page === null) {
			continue;
		}

		const bounds = element.getBoundingClientRect();
		const visibleHeight = Math.max(
			0,
			Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top),
		);
		const distance = Math.abs(bounds.top - viewport.top);
		const score = visibleHeight * 1000 - distance;
		if (!best || score > best.score) {
			best = { page, score };
		}
	}

	return best?.page ?? null;
}

function parsePageNumber(page: HTMLElement): number | null {
	const value = Number(page.dataset.pageNumber);
	return Number.isInteger(value) && value > 0 ? value : null;
}
