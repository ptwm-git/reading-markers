import { Menu, setIcon } from 'obsidian';
import {
	COLOR_LABELS,
	MARKER_COLORS,
	MarkerColor,
	ReadingMarker,
} from '../types';

export interface MarkerBarActions {
	jumpToMarker(blockId: string): void;
	changeMarkerColor(blockId: string, color: MarkerColor): void;
	removeMarker(blockId: string): void;
}

export function renderMarkerBar(
	container: HTMLElement,
	markers: ReadingMarker[],
	actions: MarkerBarActions,
): void {
	container.empty();
	container.addClass('reading-markers-bar');
	container.setAttribute('aria-label', '当前文档的阅读标记');

	const groups = container.createDiv({ cls: 'reading-markers-groups' });

	for (const color of MARKER_COLORS) {
		const colorMarkers = markers.filter((marker) => marker.color === color);

		if (colorMarkers.length === 0) {
			continue;
		}

		const group = groups.createDiv({
			cls: 'reading-markers-group',
			attr: {
				'data-color': color,
				'aria-label': `${COLOR_LABELS[color]}阅读标记`,
			},
		});
		group.createSpan({
			cls: 'reading-markers-group-swatch',
			attr: { title: COLOR_LABELS[color] },
		});

		for (const marker of colorMarkers) {
			const button = group.createEl('button', {
				cls: 'reading-markers-marker-button',
				attr: {
					type: 'button',
					'data-color': color,
					title: `${COLOR_LABELS[color]}：${marker.excerpt}`,
					'aria-label': `跳转到${COLOR_LABELS[color]}阅读标记：${marker.excerpt}`,
				},
			});
			const icon = button.createSpan({ cls: 'reading-markers-marker-icon' });
			setIcon(icon, 'tag');
			button.createSpan({
				cls: 'reading-markers-marker-excerpt',
				text: marker.excerpt,
			});

			button.addEventListener('click', () => {
				actions.jumpToMarker(marker.blockId);
			});
			button.addEventListener('contextmenu', (event) => {
				event.preventDefault();
				event.stopPropagation();
				showMarkerMenu(event, marker, actions);
			});
		}
	}
}

function showMarkerMenu(
	event: MouseEvent,
	marker: ReadingMarker,
	actions: MarkerBarActions,
): void {
	const menu = new Menu();

	for (const color of MARKER_COLORS) {
		menu.addItem((item) => {
			item
				.setTitle(`改为${COLOR_LABELS[color]}`)
				.setIcon('tag')
				.setChecked(color === marker.color)
				.onClick(() => actions.changeMarkerColor(marker.blockId, color));
		});
	}

	menu.addSeparator();
	menu.addItem((item) => {
		item
			.setTitle('删除阅读标记')
			.setIcon('trash-2')
			.setWarning(true)
			.onClick(() => actions.removeMarker(marker.blockId));
	});
	menu.showAtMouseEvent(event);
}
