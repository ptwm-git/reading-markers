import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { createEditorExtensions } from './editor-extension';
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

export default class ReadingMarkersPlugin extends Plugin {
	settings: ReadingMarkersSettings = { ...DEFAULT_SETTINGS };
	private logger!: PluginLogger;
	private service!: MarkerService;

	async onload(): Promise<void> {
		this.logger = new PluginLogger(
			() => this.settings.enableDebugLogging,
		);
		await this.loadSettings();
		this.service = new MarkerService(
			this.app,
			this.logger,
			() => this.settings,
		);
		const markerBarActions = this.createMarkerBarActions();
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
						.setTitle('添加阅读标记')
						.setIcon('tag')
						.onClick(() =>
							this.service.openEditorColorPicker(editor, file, line),
						);
				});
			}),
		);

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
			name: '添加阅读标记',
			editorCallback: (editor, context) => {
				const file = context.file;

				if (!file) {
					new Notice('请先打开 Markdown 文档。');
					return;
				}

				this.service.openEditorColorPicker(
					editor,
					file,
					editor.getCursor().line,
				);
			},
		});
	}

	async updateSettings(
		patch: Partial<ReadingMarkersSettings>,
	): Promise<boolean> {
		const previous = this.settings;
		const next = parseSettings({ ...previous, ...patch });
		this.settings = next;

		try {
			await this.saveData(next);
			this.logger.debug('save-settings:complete', next);
			return true;
		} catch (error) {
			this.settings = previous;
			this.logger.error('save-settings', error);
			new Notice('阅读标记设置保存失败，已恢复之前的设置。');
			return false;
		}
	}

	private async loadSettings(): Promise<void> {
		try {
			this.settings = parseSettings(await this.loadData());
		} catch (error) {
			this.settings = { ...DEFAULT_SETTINGS };
			this.logger.error('load-settings', error);
			new Notice('阅读标记设置加载失败，已使用默认设置。');
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

	private getActiveMarkdownFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;

		if (!file || file.extension !== 'md') {
			new Notice('请先打开 Markdown 文档。');
			return null;
		}

		return file;
	}
}
