import {
	App,
	PluginSettingTab,
	SettingDefinitionItem,
} from 'obsidian';
import type ReadingMarkersPlugin from './main';
import { ReadingMarkersSettings } from './settings';

type SettingKey = keyof ReadingMarkersSettings;

export class ReadingMarkersSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: ReadingMarkersPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			{
				name: '显示操作成功提示',
				desc: '添加、改色或删除成功后显示短暂通知。错误提示始终显示。',
				control: {
					type: 'toggle',
					key: 'showSuccessNotices',
				},
			},
			{
				name: '启用调试日志',
				desc: '在开发者控制台的 verbose 级别记录成功动作。排查问题时再开启。',
				control: {
					type: 'toggle',
					key: 'enableDebugLogging',
				},
			},
		];
	}

	getControlValue(key: SettingKey): unknown {
		return this.plugin.settings[key];
	}

	async setControlValue(key: SettingKey, value: unknown): Promise<void> {
		if (typeof value !== 'boolean') {
			return;
		}

		await this.plugin.updateSettings({ [key]: value });
	}

}
