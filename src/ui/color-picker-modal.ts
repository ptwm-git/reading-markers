import { App, Modal, setIcon } from 'obsidian';
import { strings } from '../i18n';
import { MARKER_COLORS, MarkerColor } from '../types';

export class ColorPickerModal extends Modal {
	constructor(
		app: App,
		private readonly onChoose: (color: MarkerColor) => void,
		private readonly currentColor?: MarkerColor,
	) {
		super(app);
	}

	onOpen(): void {
		const labels = strings();
		this.setTitle(this.currentColor ? labels.changeMarkerColor : labels.chooseMarkerColor);
		this.contentEl.empty();
		this.contentEl.addClass('reading-markers-color-modal');

		const palette = this.contentEl.createDiv({
			cls: 'reading-markers-color-palette',
		});

		for (const color of MARKER_COLORS) {
			const button = palette.createEl('button', {
				cls: 'reading-markers-color-button',
				attr: {
					type: 'button',
					'data-color': color,
					'aria-label': labels.colors[color],
					'aria-pressed': String(color === this.currentColor),
				},
			});
			const icon = button.createSpan({ cls: 'reading-markers-color-icon' });
			setIcon(icon, 'tag');
			button.createSpan({ text: labels.colors[color] });
			button.addEventListener('click', () => {
				this.close();
				this.onChoose(color);
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
