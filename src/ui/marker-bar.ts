import { Menu, setIcon } from 'obsidian';
import { strings } from '../i18n';
import { MARKER_COLORS, MarkerColor } from '../types';

export interface MarkerBarEntry {
	markerId: string;
	color: MarkerColor;
	label: string;
}

export interface MarkerBarActions {
	jumpToMarker(markerId: string): void;
	changeMarkerColor(markerId: string, color: MarkerColor): void;
	removeMarker(markerId: string): void;
}

export function renderMarkerBar(
	container: HTMLElement,
	markers: MarkerBarEntry[],
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
					title: labels.markerTitle(labels.colors[color], marker.label),
					'aria-label': labels.jumpToMarker(labels.colors[color], marker.label),
				},
			});
			const icon = button.createSpan({ cls: 'reading-markers-marker-icon' });
			setIcon(icon, 'tag');
			button.createSpan({
				cls: 'reading-markers-marker-excerpt',
				text: marker.label,
			});

			button.addEventListener('click', () => {
				actions.jumpToMarker(marker.markerId);
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
	marker: MarkerBarEntry,
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
				.onClick(() => actions.changeMarkerColor(marker.markerId, color));
		});
	}

	menu.addSeparator();
	menu.addItem((item) => {
		item
			.setTitle(labels.deleteMarker)
			.setIcon('trash-2')
			.setWarning(true)
			.onClick(() => actions.removeMarker(marker.markerId));
	});
	menu.showAtMouseEvent(event);
}
