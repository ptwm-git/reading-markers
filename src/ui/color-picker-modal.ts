import { App, Modal, setIcon } from 'obsidian';
import { COLOR_LABELS, MARKER_COLORS, MarkerColor } from '../types';

export class ColorPickerModal extends Modal {
	constructor(
		app: App,
		private readonly onChoose: (color: MarkerColor) => void,
		private readonly currentColor?: MarkerColor,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.currentColor ? '更改阅读标记颜色' : '选择阅读标记颜色');
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
					'aria-label': COLOR_LABELS[color],
					'aria-pressed': String(color === this.currentColor),
				},
			});
			const icon = button.createSpan({ cls: 'reading-markers-color-icon' });
			setIcon(icon, 'tag');
			button.createSpan({ text: COLOR_LABELS[color] });
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
