import { App, Modal, Setting } from 'obsidian';
import { strings } from '../i18n';

export class ReturnPositionModal extends Modal {
	constructor(
		app: App,
		private readonly onSave: () => void,
		private readonly onSkip: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const labels = strings();
		this.setTitle(labels.navigationSaveReturnTitle);
		this.contentEl.empty();
		this.contentEl.createEl('p', {
			text: labels.navigationSaveReturnDescription,
			cls: 'reading-markers-return-position-description',
		});

		new Setting(this.contentEl)
			.addButton((button) =>
				button
					.setButtonText(labels.navigationSaveReturn)
					.setCta()
					.onClick(() => {
						this.close();
						this.onSave();
					}),
			)
			.addButton((button) =>
				button.setButtonText(labels.navigationSkipReturn).onClick(() => {
					this.close();
					this.onSkip();
				}),
			)
			.addButton((button) =>
				button.setButtonText(labels.navigationCancel).onClick(() => this.close()),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
