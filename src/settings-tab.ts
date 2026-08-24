import {
	App,
	PluginSettingTab,
	SettingDefinitionItem,
} from 'obsidian';
import type ReadingMarkersPlugin from './main';
import { strings } from './i18n';
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
				name: strings().showSuccessNotices,
				desc: strings().showSuccessNoticesDescription,
				control: {
					type: 'toggle',
					key: 'showSuccessNotices',
				},
			},
			{
				name: strings().enableDebugLogging,
				desc: strings().enableDebugLoggingDescription,
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
