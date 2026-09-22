import { MarkdownView, moment, Notice, Plugin, TFile } from 'obsidian';
import type { FileView } from 'obsidian';
import { createEditorExtensions } from './editor-extension';
import { setLocale, strings } from './i18n';
import { PluginLogger } from './logger';
import { MarkerService } from './marker-service';
import {
	processReadingSection,
	refreshReadingMarkerBars,
} from './reading-view';
import { MarkerBarActions } from './ui/marker-bar';
import {
	DEFAULT_SETTINGS,
	parseSettings,
	ReadingMarkersSettings,
} from './settings';
import { ReadingMarkersSettingTab } from './settings-tab';
import { parseData, ReadingMarkersData, renameStoredPaths } from './stored-data';
import { PdfMarkerService } from './pdf-marker-service';
import { getVisiblePdfPage, PdfViewManager } from './pdf-view';
import { MarkerColor, PdfReadingMarker } from './types';
import { MarkdownNavigationManager } from './markdown-navigation';
import { getCenterAfterMarkerAdded } from './navigation-model';
import { DataStore } from './data-store';
import { ReadingLocation, renamedPath } from './reading-position';
import { ReadingNavigationServices } from './reading-tracker';
import { MarkerBrowser } from './ui/marker-browser';
import { LibraryMarker } from './marker-library';
import { PdfMarkerMutation } from './pdf-marker-format';

export default class ReadingMarkersPlugin extends Plugin {
	settings: ReadingMarkersSettings = { ...DEFAULT_SETTINGS };
	private store = new DataStore(parseData(undefined), (data) => this.saveData(data));
	private get data(): ReadingMarkersData { return this.store.value; }
	private logger!: PluginLogger;
	private service!: MarkerService;
	private pdfService!: PdfMarkerService;
	private pdfViews!: PdfViewManager;
	private markdownNavigation!: MarkdownNavigationManager;
	private readonly navigationCenters = new Map<string, string>();
	private readonly browsers = new Map<FileView, MarkerBrowser>();
	private active = false;

	async onload(): Promise<void> {
		setLocale(moment.locale());
		this.logger = new PluginLogger(
			() => this.settings.enableDebugLogging,
		);
		await this.loadPluginData();
		this.active = true;
		this.service = new MarkerService(
			this.app,
			this.logger,
			() => this.settings,
			(filePath, blockId) => this.initializeNavigationCenter(filePath, blockId),
			(filePath, previousBlockId, nextBlockId) =>
				this.updateNavigationCenter(filePath, previousBlockId, nextBlockId),
			(filePath, blockId) => this.clearNavigationCenter(filePath, blockId),
		);
		this.pdfService = new PdfMarkerService(
			this.app,
			this.logger,
			() => this.data.pdfMarkers,
			(markers) => this.savePdfMarkers(markers),
			(filePath) => {
				this.pdfViews?.refreshFile(filePath);
				this.refreshBrowsers(filePath);
			},
			(message) => this.notifySuccess(message),
			(filePath, markerId) => this.initializeNavigationCenter(filePath, markerId),
			(filePath, markerId) => this.clearNavigationCenter(filePath, markerId),
		);
		const markerBarActions = this.createMarkerBarActions();
		const navigationServices: ReadingNavigationServices = {
			getProgress: (path) => this.settings.rememberReadingPosition
				? this.data.readingProgress.find((item) => item.filePath === path)?.location ?? null : null,
			saveProgress: (path, location) => this.saveProgress(path, location),
			openMarkers: (view) => this.toggleMarkerBrowser(view),
		};
		this.pdfViews = this.addChild(new PdfViewManager(
			this.pdfService,
			() => this.data.pdfMarkers,
			(filePath) => this.navigationCenters.get(filePath) ?? null,
			(file) => this.createPdfMarkerBarActions(file),
			this.logger,
			() => this.app.workspace.getLeavesOfType('pdf'),
			navigationServices,
		));
		this.markdownNavigation = this.addChild(new MarkdownNavigationManager(
			this.service,
			(filePath) => this.navigationCenters.get(filePath) ?? null,
			() => this.app.workspace.getLeavesOfType('markdown'),
			navigationServices,
		));
		this.addSettingTab(new ReadingMarkersSettingTab(this.app, this));

		this.registerEditorExtension(
			createEditorExtensions(markerBarActions, (line) => {
				this.service.rememberEditorContextLine(line);
			}),
		);

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, info) => {
				const file = info.file;

				if (!file) {
					return;
				}

				const line = this.service.consumeEditorContextLine(editor);
				menu.addItem((item) => {
					item
						.setTitle(strings().addReadingMarker)
						.setIcon('tag')
						.onClick(() =>
							this.service.openEditorColorPicker(editor, file, line),
						);
				});
			}),
		);

		const syncViews = (): void => {
			if (!this.active) return;
			const openViews = [
				...this.app.workspace.getLeavesOfType('pdf'),
				...this.app.workspace.getLeavesOfType('markdown'),
			].map((leaf) => leaf.view);
			for (const [view, browser] of this.browsers) {
				if (!openViews.includes(view)) {
					this.removeChild(browser);
					this.browsers.delete(view);
				}
			}
			this.pdfViews.syncAll(this.app.workspace.getLeavesOfType('pdf'));
			this.markdownNavigation.syncAll(this.app.workspace.getLeavesOfType('markdown'));
		};
		const schedulePdfSync = (): void => {
			syncViews();
			window.setTimeout(syncViews, 300);
		};
		this.registerEvent(this.app.workspace.on('layout-change', syncViews));
		this.registerEvent(this.app.workspace.on('active-leaf-change', syncViews));
		this.registerEvent(this.app.workspace.on('file-open', schedulePdfSync));
		this.registerEvent(this.app.workspace.on('file-open', () => this.refreshBrowsers()));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			const newPath = file.path;
			for (const [path, center] of [...this.navigationCenters]) {
				const next = renamedPath(path, oldPath, newPath);
				if (next !== path) {
					this.navigationCenters.delete(path);
					this.navigationCenters.set(next, center);
				}
			}
			this.markdownNavigation.rename(oldPath, newPath);
			this.pdfViews.rename(oldPath, newPath);
			void this.store.update((data) => renameStoredPaths(data, oldPath, newPath))
				.then(() => { syncViews(); this.refreshBrowsers(); })
				.catch((error: unknown) => this.reportDataError(error));
		}));
		this.registerEvent(this.app.vault.on('delete', () => this.refreshBrowsers()));
		this.app.workspace.onLayoutReady(schedulePdfSync);

		this.registerMarkdownPostProcessor((el, context) =>
			this.logger.guardBackground('render-reading-view', () =>
				processReadingSection(el, context, this.service, markerBarActions),
			),
		);

		this.registerEvent(
			this.app.metadataCache.on('changed', (file, data) => {
				refreshReadingMarkerBars(this.app, file, data, markerBarActions);
				this.markdownNavigation.refreshFile(file.path);
				this.refreshBrowsers(file.path);
			}),
		);

		this.addCommand({
			id: 'add-reading-marker',
			name: strings().addReadingMarker,
			editorCallback: (editor, context) => {
				const file = context.file;

				if (!file) {
					new Notice(strings().noMarkdownFile);
					return;
				}

				this.service.openEditorColorPicker(
					editor,
					file,
					editor.getCursor().line,
				);
			},
		});

		this.addCommand({
			id: 'add-pdf-reading-marker',
			name: strings().addPdfReadingMarker,
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				const view = activeFile
					? this.app.workspace
							.getLeavesOfType('pdf')
							.map((leaf) => leaf.view as FileView)
							.find((candidate) => candidate.file?.path === activeFile.path) ?? null
					: null;
				const file = view?.file;
				if (!view || !file || view.getViewType() !== 'pdf' || file.extension.toLowerCase() !== 'pdf') {
					new Notice(strings().noPdfFile);
					return;
				}

				const page = this.pdfViews ? getVisiblePdfPage(view.containerEl) : null;
				if (page === null) {
					new Notice(strings().pdfPageUnavailable);
					return;
				}
				this.pdfService.openColorPicker(file, page);
			},
		});
		this.addCommand({
			id: 'open-reading-marker-list', name: strings().openMarkerList,
			callback: () => {
				const view = this.activeReadingView();
				if (view) this.toggleMarkerBrowser(view);
			},
		});
		const actions = [
			['previous', strings().navigationPrevious],
			['next', strings().navigationNext],
			['center', strings().navigationReturnPosition],
			['resume', strings().resumeReading],
			['continue', strings().continueReadingHere],
		] as const;
		for (const [action, name] of actions) this.addCommand({
			id: `reading-${action}`, name,
			callback: () => {
				const view = this.activeReadingView();
				if (view instanceof MarkdownView) this.markdownNavigation.navigate(view, action);
				else if (view) this.pdfViews.navigate(view, action);
			},
		});
	}

	onunload(): void { this.active = false; }

	private initializeNavigationCenter(filePath: string, markerId: string): void {
		const centerId = getCenterAfterMarkerAdded(
			this.navigationCenters.get(filePath) ?? null,
			markerId,
		);
		if (centerId === this.navigationCenters.get(filePath)) {
			return;
		}

		this.navigationCenters.set(filePath, centerId);
		this.markdownNavigation?.refreshFile(filePath);
		this.pdfViews?.refreshFile(filePath);
	}

	private updateNavigationCenter(
		filePath: string,
		previousMarkerId: string,
		nextMarkerId: string,
	): void {
		if (this.navigationCenters.get(filePath) !== previousMarkerId) {
			return;
		}

		this.navigationCenters.set(filePath, nextMarkerId);
		this.markdownNavigation?.refreshFile(filePath);
		this.pdfViews?.refreshFile(filePath);
	}

	private clearNavigationCenter(filePath: string, markerId: string): void {
		if (this.navigationCenters.get(filePath) !== markerId) {
			return;
		}

		this.navigationCenters.delete(filePath);
		this.markdownNavigation?.refreshFile(filePath);
		this.pdfViews?.refreshFile(filePath);
	}

	async updateSettings(
		patch: Partial<ReadingMarkersSettings>,
	): Promise<boolean> {
		try {
			await this.store.update((data) => ({ ...data, ...parseSettings({ ...data, ...patch }) }));
			this.settings = parseSettings(this.data);
			this.markdownNavigation.syncAll(this.app.workspace.getLeavesOfType('markdown'));
			this.pdfViews.syncAll(this.app.workspace.getLeavesOfType('pdf'));
			this.logger.debug('save-settings:complete', this.settings);
			return true;
		} catch (error) {
			this.logger.error('save-settings', error);
			new Notice(strings().settingsSaveFailed);
			return false;
		}
	}

	private async loadPluginData(): Promise<void> {
		try {
			this.store = new DataStore(parseData(await this.loadData()), (data) => this.saveData(data));
			this.settings = parseSettings(this.data);
		} catch (error) {
			this.settings = { ...DEFAULT_SETTINGS };
			this.logger.error('load-plugin-data', error);
			new Notice(strings().settingsLoadFailed);
		}
	}

	private async savePdfMarkers(mutate: (markers: PdfReadingMarker[]) => PdfMarkerMutation): Promise<boolean> {
		let applied = false;
		try {
			await this.store.update((data) => {
				const mutation = mutate(data.pdfMarkers);
				if (!mutation.ok || !mutation.markers) {
					new Notice(mutation.message === 'already-marked' ? strings().pdfPageAlreadyMarked : strings().pdfMarkerMissing);
					return data;
				}
				applied = true;
				return { ...data, pdfMarkers: mutation.markers };
			});
			return applied;
		} catch (error) {
			this.logger.error('save-pdf-markers', error);
			new Notice(strings().pdfDataSaveFailed);
			return false;
		}
	}

	private saveProgress(path: string, location: ReadingLocation): void {
		if (!this.settings.rememberReadingPosition) return;
		void this.store.update((data) => {
			if (!this.settings.rememberReadingPosition || !(this.app.vault.getAbstractFileByPath(path) instanceof TFile)) return data;
			const previous = data.readingProgress.find((item) => item.filePath === path);
			if (previous && JSON.stringify(previous.location) === JSON.stringify(location)) return data;
			return {
				...data,
				readingProgress: [
					...data.readingProgress.filter((item) => item.filePath !== path),
					{ filePath: path, location, updatedAt: Date.now() },
				],
			};
		}).then(() => {
			if (!this.active) return;
			this.markdownNavigation.refreshFile(path);
			this.pdfViews.refreshFile(path);
			for (const browser of this.browsers.values()) browser.refreshProgress();
		}).catch((error: unknown) => this.reportDataError(error));
	}

	private reportDataError(error: unknown): void {
		this.logger.error('save-reading-data', error);
		new Notice(strings().progressSaveFailed);
	}

	private activeReadingView(): FileView | null {
		const view = this.app.workspace.getMostRecentLeaf()?.view;
		return view && ['markdown', 'pdf'].includes(view.getViewType()) ? view as FileView : null;
	}

	private refreshBrowsers(path?: string): void {
		if (!this.active) return;
		for (const browser of this.browsers.values()) browser.refresh(path);
	}

	private toggleMarkerBrowser(view: FileView): void {
		const existing = this.browsers.get(view);
		if (existing) { this.removeChild(existing); this.browsers.delete(view); return; }
		const browser = new MarkerBrowser(this.app, () => this.data.pdfMarkers, {
			jump: (sourceView, marker) => this.jumpFromBrowser(sourceView, marker),
			change: (marker, color) => {
				const file = this.app.vault.getAbstractFileByPath(marker.filePath);
				if (!(file instanceof TFile)) return;
				if (marker.kind === 'pdf') void this.pdfService.changeMarkerColor(file.path, marker.markerId, color);
				else this.service.changeMarkerColor(file, marker.markerId, color);
			},
			remove: (marker) => {
				const file = this.app.vault.getAbstractFileByPath(marker.filePath);
				if (!(file instanceof TFile)) return;
				if (marker.kind === 'pdf') void this.pdfService.removeMarker(file.path, marker.markerId);
				else this.service.removeMarker(file, marker.markerId);
			},
			resume: (target) => {
				if (target instanceof MarkdownView) this.markdownNavigation.navigate(target, 'resume');
				else this.pdfViews.navigate(target, 'resume');
			},
			hasProgress: (path) => this.settings.rememberReadingPosition &&
				this.data.readingProgress.some((item) => item.filePath === path),
		}, view, () => {
			this.removeChild(browser);
			this.browsers.delete(view);
			view.containerEl.querySelector<HTMLButtonElement>('[data-navigation-action="list"]')?.focus();
		});
		this.browsers.set(view, browser);
		this.addChild(browser);
	}

	private async jumpFromBrowser(view: FileView, marker: LibraryMarker): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(marker.filePath);
		if (!(file instanceof TFile)) { new Notice(strings().markerMissing); return; }
		if (view instanceof MarkdownView) this.markdownNavigation.beginExternalJump(view);
		else this.pdfViews.beginExternalJump(view);
		if (view.file !== file) await view.leaf.openFile(file, { active: true });
		const target = view.leaf.view;
		if (target instanceof MarkdownView) {
			this.markdownNavigation.syncView(target);
			this.service.jumpToMarker(file, marker.markerId, target);
		} else if (target.getViewType() === 'pdf') {
			this.pdfViews.syncView(target as FileView);
			this.pdfViews.jumpToMarker(file.path, marker.markerId, target as FileView);
		}
	}

	private notifySuccess(message: string): void {
		if (this.settings.showSuccessNotices) {
			new Notice(message);
		}
	}

	private createMarkerBarActions(): MarkerBarActions {
		return {
			jumpToMarker: (blockId) => {
				const file = this.getActiveMarkdownFile();

				if (file) {
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view) this.markdownNavigation.beginExternalJump(view);
					this.service.jumpToMarker(file, blockId, view ?? undefined);
				}
			},
			changeMarkerColor: (blockId, color) => {
				const file = this.getActiveMarkdownFile();

				if (file) {
					this.service.changeMarkerColor(file, blockId, color);
				}
			},
			removeMarker: (blockId) => {
				const file = this.getActiveMarkdownFile();

				if (file) {
					this.service.removeMarker(file, blockId);
				}
			},
		};
	}

	private createPdfMarkerBarActions(file: TFile): MarkerBarActions {
		return {
			jumpToMarker: (markerId) => {
				const view = this.activeReadingView();
				if (view?.getViewType() === 'pdf' && view.file === file) this.pdfViews.beginExternalJump(view);
				this.pdfViews.jumpToMarker(file.path, markerId, view?.file === file ? view : undefined);
			},
			changeMarkerColor: (markerId, color: MarkerColor) => {
				void this.pdfService.changeMarkerColor(file.path, markerId, color);
			},
			removeMarker: (markerId) => {
				void this.pdfService.removeMarker(file.path, markerId);
			},
		};
	}

	private getActiveMarkdownFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;

		if (!file || file.extension !== 'md') {
			new Notice(strings().noMarkdownFile);
			return null;
		}

		return file;
	}
}
