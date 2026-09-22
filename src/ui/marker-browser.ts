import { Component, MarkdownView, Menu, setIcon, TFile } from 'obsidian';
import type { App, FileView } from 'obsidian';
import { strings } from '../i18n';
import { LibraryMarker, filterLibraryMarkers } from '../marker-library';
import { parseMarkers } from '../marker-format';
import { MARKER_COLORS, MarkerColor, PdfReadingMarker } from '../types';

export interface MarkerBrowserActions {
	jump(view: FileView, marker: LibraryMarker): Promise<void>;
	change(marker: LibraryMarker, color: MarkerColor): void;
	remove(marker: LibraryMarker): void;
	resume(view: FileView): void;
	hasProgress(path: string): boolean;
}

export class MarkerBrowser extends Component {
	private host: HTMLElement | null = null;
	private list!: HTMLElement;
	private status!: HTMLElement;
	private search!: HTMLInputElement;
	private resumeButton!: HTMLButtonElement;
	private currentScope = true;
	private color: MarkerColor | null = null;
	private markers: LibraryMarker[] = [];
	private revision = 0;
	private refreshTimer: number | null = null;
	private partial = false;
	private readonly cache = new Map<string, { stamp: string; markers: LibraryMarker[] }>();

	constructor(
		private readonly app: App,
		private readonly getPdfMarkers: () => PdfReadingMarker[],
		private readonly actions: MarkerBrowserActions,
		private readonly view: FileView,
		private readonly onClose: () => void,
	) { super(); }

	onload(): void {
		this.host = this.view.containerEl.createDiv({
			cls: 'reading-markers-browser',
			attr: { 'aria-label': strings().markerList, role: 'region' },
		});
		const nav = this.view.containerEl.querySelector<HTMLElement>('.reading-markers-navigation-host');
		this.host.toggleClass('reading-markers-browser-left', nav?.dataset.side === 'left');
		const header = this.host.createDiv({ cls: 'reading-markers-browser-header' });
		header.createEl('strong', { text: strings().markerList });
		this.resumeButton = this.iconButton(header, 'history', strings().resumeReading, () => this.actions.resume(this.view));
		this.refreshProgress();
		this.iconButton(header, 'refresh-cw', strings().refreshMarkers, () => { this.cache.clear(); void this.loadMarkers(); });
		this.iconButton(header, 'x', strings().closeMarkerList, this.onClose);
		const tabs = this.host.createDiv({ cls: 'reading-markers-browser-tabs', attr: { role: 'tablist' } });
		for (const current of [true, false]) {
			const button = tabs.createEl('button', {
				text: current ? strings().currentDocument : strings().allDocuments,
				attr: { type: 'button', role: 'tab', 'aria-selected': String(current) },
			});
			button.addEventListener('click', () => {
				this.currentScope = current;
				for (const tab of Array.from(tabs.querySelectorAll('button'))) tab.setAttribute('aria-selected', String(tab === button));
				void this.loadMarkers();
			});
		}
		this.search = this.host.createEl('input', {
			cls: 'reading-markers-browser-search',
			attr: { type: 'search', placeholder: strings().searchMarkers, 'aria-label': strings().searchMarkers },
		});
		this.search.addEventListener('input', () => this.render());
		const colors = this.host.createDiv({ cls: 'reading-markers-browser-colors' });
		const all = this.iconButton(colors, 'palette', strings().allColors, () => select(null));
		all.setAttribute('aria-pressed', 'true');
		for (const color of MARKER_COLORS) {
			const button = this.iconButton(colors, 'circle', strings().colors[color], () => select(color));
			button.dataset.color = color;
			button.setAttribute('aria-pressed', 'false');
		}
		const select = (color: MarkerColor | null): void => {
			this.color = color;
			for (const button of Array.from(colors.querySelectorAll<HTMLButtonElement>('button'))) {
				button.setAttribute('aria-pressed', String((button.dataset.color ?? null) === color));
			}
			this.render();
		};
		this.status = this.host.createDiv({ cls: 'reading-markers-browser-status', attr: { role: 'status' } });
		this.list = this.host.createDiv({ cls: 'reading-markers-browser-list' });
		this.registerDomEvent(this.view.containerEl, 'keydown', (event) => {
			if (event.key === 'Escape') { event.stopPropagation(); this.onClose(); }
		});
		void this.loadMarkers();
		this.search.focus();
	}

	refresh(filePath?: string): void {
		this.refreshProgress();
		if (filePath) this.cache.delete(filePath);
		else this.cache.clear();
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => { this.refreshTimer = null; void this.loadMarkers(); }, 180);
	}

	refreshProgress(): void {
		if (this.resumeButton) this.resumeButton.disabled = !this.actions.hasProgress(this.view.file?.path ?? '');
	}

	onunload(): void {
		this.revision++;
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.host?.remove();
		this.host = null;
	}

	private async loadMarkers(): Promise<void> {
		const revision = ++this.revision;
		const path = this.view.file?.path;
		const current = this.currentScope;
		if (!this.host) return;
		this.status.setText(strings().loadingMarkers);
		const files = current
			? [this.view.file].filter((file): file is TFile => !!file && file.extension === 'md')
			: this.app.vault.getMarkdownFiles();
		const entries: LibraryMarker[] = [];
		let partial = false;
		let index = 0;
		const worker = async (): Promise<void> => {
			while (index < files.length && revision === this.revision) {
				const file = files[index++];
				if (!file) continue;
				try {
					const editor = this.app.workspace.getLeavesOfType('markdown')
						.map((leaf) => leaf.view).find((view): view is MarkdownView =>
							view instanceof MarkdownView && view.file === file && view.getMode() === 'source');
					const stamp = `${file.stat.mtime}:${file.stat.size}`;
					const cached = !editor ? this.cache.get(file.path) : undefined;
					let markers = cached?.stamp === stamp ? cached.markers : undefined;
					if (!markers) {
						const source = editor?.editor.getValue() ?? await this.app.vault.cachedRead(file);
						markers = parseMarkers(source).map((marker) => ({
							kind: 'markdown', filePath: file.path, markerId: marker.blockId,
							color: marker.color, label: marker.excerpt, position: marker.line,
						}));
						if (!editor) this.cache.set(file.path, { stamp, markers });
					}
					entries.push(...markers);
				} catch { partial = true; }
			}
		};
		await Promise.all(Array.from({ length: Math.min(4, files.length) }, () => worker()));
		if (!this.host || revision !== this.revision || this.view.file?.path !== path) return;
		for (const marker of this.getPdfMarkers()) {
			if ((!current || marker.filePath === path) && this.app.vault.getAbstractFileByPath(marker.filePath) instanceof TFile) {
				entries.push({
					kind: 'pdf', filePath: marker.filePath, markerId: marker.id,
					color: marker.color, label: strings().pdfPageLabel(marker.page), position: marker.page,
				});
			}
		}
		this.markers = entries;
		this.partial = partial;
		this.render();
	}

	private render(): void {
		if (!this.host) return;
		const matches = filterLibraryMarkers(this.markers, this.search.value, this.color);
		this.status.setText(this.partial ? strings().markerListIncomplete : String(matches.length));
		this.list.empty();
		if (!matches.length) { this.list.createDiv({ text: strings().noMarkersFound }); return; }
		for (const marker of matches) {
			const row = this.list.createDiv({ cls: 'reading-markers-browser-row' });
			const button = row.createEl('button', { cls: 'reading-markers-browser-marker', attr: { type: 'button', 'data-color': marker.color } });
			setIcon(button.createSpan({ cls: 'reading-markers-marker-icon' }), 'tag');
			const label = button.createSpan({ cls: 'reading-markers-browser-label' });
			label.createSpan({ text: marker.label });
			label.createEl('small', { text: marker.filePath });
			button.addEventListener('click', () => {
				void this.actions.jump(this.view, marker).catch(() => this.status.setText(strings().operationFailed));
			});
			const menuButton = this.iconButton(row, 'ellipsis', strings().changeMarkerColor, () => show(menuButton));
			const show = (anchor: HTMLElement): void => {
				const menu = new Menu();
				for (const color of MARKER_COLORS) {
					menu.addItem((item) => item.setTitle(strings().changeToColor(strings().colors[color])).setIcon('tag')
						.setChecked(marker.color === color).onClick(() => this.actions.change(marker, color)));
				}
				menu.addSeparator();
				menu.addItem((item) => item.setTitle(strings().deleteMarker).setIcon('trash-2')
					.setWarning(true).onClick(() => this.actions.remove(marker)));
				const bounds = anchor.getBoundingClientRect();
				menu.showAtPosition({ x: bounds.left, y: bounds.bottom });
			};
			button.addEventListener('contextmenu', (event) => { event.preventDefault(); show(button); });
		}
	}

	private iconButton(parent: HTMLElement, icon: string, title: string, action: () => void): HTMLButtonElement {
		const button = parent.createEl('button', {
			cls: 'reading-markers-browser-icon', attr: { type: 'button', title, 'aria-label': title },
		});
		setIcon(button, icon);
		button.addEventListener('click', action);
		return button;
	}
}
