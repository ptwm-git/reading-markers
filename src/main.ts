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
import { DEFAULT_DATA, parseData, ReadingMarkersData } from './stored-data';
import { PdfMarkerService } from './pdf-marker-service';
import { getVisiblePdfPage, PdfViewManager } from './pdf-view';
import { MarkerColor, PdfReadingMarker } from './types';

export default class ReadingMarkersPlugin extends Plugin {
	settings: ReadingMarkersSettings = { ...DEFAULT_SETTINGS };
	private data: ReadingMarkersData = { ...DEFAULT_DATA, pdfMarkers: [] };
	private logger!: PluginLogger;
	private service!: MarkerService;
	private pdfService!: PdfMarkerService;
	private pdfViews!: PdfViewManager;

	async onload(): Promise<void> {
		setLocale(moment.locale());
		this.logger = new PluginLogger(
			() => this.settings.enableDebugLogging,
		);
		await this.loadPluginData();
		this.service = new MarkerService(
			this.app,
			this.logger,
			() => this.settings,
		);
		this.pdfService = new PdfMarkerService(
			this.app,
			this.logger,
			() => this.data.pdfMarkers,
			(markers) => this.savePdfMarkers(markers),
			(filePath) => this.pdfViews?.refreshFile(filePath),
			(message) => this.notifySuccess(message),
		);
		const markerBarActions = this.createMarkerBarActions();
		this.pdfViews = new PdfViewManager(
			(el, type, callback, options) => this.registerDomEvent(el, type, callback, options),
			this.pdfService,
			() => this.data.pdfMarkers,
			(file) => this.createPdfMarkerBarActions(file),
			this.logger,
			() => this.app.workspace.getLeavesOfType('pdf'),
		);
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

		const syncPdfViews = (): void => {
			this.pdfViews.syncAll(this.app.workspace.getLeavesOfType('pdf'));
		};
		const schedulePdfSync = (): void => {
			syncPdfViews();
			window.setTimeout(syncPdfViews, 300);
		};
		this.registerEvent(this.app.workspace.on('layout-change', syncPdfViews));
		this.registerEvent(this.app.workspace.on('active-leaf-change', syncPdfViews));
		this.registerEvent(this.app.workspace.on('file-open', schedulePdfSync));
		this.app.workspace.onLayoutReady(schedulePdfSync);

		this.registerMarkdownPostProcessor((el, context) =>
			this.logger.guardBackground('render-reading-view', () =>
				processReadingSection(el, context, this.service, markerBarActions),
			),
		);

		this.registerEvent(
			this.app.metadataCache.on('changed', (file, data) => {
				refreshReadingMarkerBars(this.app, file, data, markerBarActions);
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
	}

	async updateSettings(
		patch: Partial<ReadingMarkersSettings>,
	): Promise<boolean> {
		const previous = this.settings;
		const previousData = this.data;
		const next = parseSettings({ ...previous, ...patch });
		this.settings = next;

		try {
			this.data = { ...this.data, ...next };
			await this.saveData(this.data);
			this.logger.debug('save-settings:complete', next);
			return true;
		} catch (error) {
			this.settings = previous;
			this.data = previousData;
			this.logger.error('save-settings', error);
			new Notice(strings().settingsSaveFailed);
			return false;
		}
	}

	private async loadPluginData(): Promise<void> {
		try {
			this.data = parseData(await this.loadData());
			this.settings = { ...this.data };
		} catch (error) {
			this.data = { ...DEFAULT_DATA, pdfMarkers: [] };
			this.settings = { ...DEFAULT_SETTINGS };
			this.logger.error('load-plugin-data', error);
			new Notice(strings().settingsLoadFailed);
		}
	}

	private async savePdfMarkers(markers: PdfReadingMarker[]): Promise<boolean> {
		const previous = this.data;
		this.data = { ...this.data, pdfMarkers: markers };

		try {
			await this.saveData(this.data);
			return true;
		} catch (error) {
			this.data = previous;
			this.logger.error('save-pdf-markers', error);
			new Notice(strings().pdfDataSaveFailed);
			return false;
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
					this.service.jumpToMarker(file, blockId);
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
			jumpToMarker: (markerId) => this.pdfViews.jumpToMarker(file.path, markerId),
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
