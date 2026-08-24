import { Menu, setIcon } from 'obsidian';
import { strings } from '../i18n';
import { MARKER_COLORS, MarkerColor, ReadingMarker } from '../types';

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
	const labels = strings();
	container.setAttribute('aria-label', labels.markerBarLabel);

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
				'aria-label': labels.markerGroupLabel(labels.colors[color]),
			},
		});
		group.createSpan({
			cls: 'reading-markers-group-swatch',
			attr: { title: labels.colors[color] },
		});

		for (const marker of colorMarkers) {
			const button = group.createEl('button', {
				cls: 'reading-markers-marker-button',
				attr: {
					type: 'button',
					'data-color': color,
					title: labels.markerTitle(labels.colors[color], marker.excerpt),
					'aria-label': labels.jumpToMarker(labels.colors[color], marker.excerpt),
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
	const labels = strings();

	for (const color of MARKER_COLORS) {
		menu.addItem((item) => {
			item
				.setTitle(labels.changeToColor(labels.colors[color]))
				.setIcon('tag')
				.setChecked(color === marker.color)
				.onClick(() => actions.changeMarkerColor(marker.blockId, color));
		});
	}

	menu.addSeparator();
	menu.addItem((item) => {
		item
			.setTitle(labels.deleteMarker)
			.setIcon('trash-2')
			.setWarning(true)
			.onClick(() => actions.removeMarker(marker.blockId));
	});
	menu.showAtMouseEvent(event);
}
