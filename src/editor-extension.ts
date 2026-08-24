import {
	Extension,
	StateEffect,
	StateField,
} from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	WidgetType,
} from '@codemirror/view';
import { parseMarkers } from './marker-format';
import { RefreshScheduler } from './refresh-scheduler';
import { ReadingMarker } from './types';
import { MarkerBarActions, renderMarkerBar } from './ui/marker-bar';

export function createEditorExtensions(
	actions: MarkerBarActions,
	onContextLine: (line: number) => void,
): Extension[] {
	const updateMarkerBar = StateEffect.define<ReadingMarker[]>();
	const contextPositionExtension = EditorView.domEventHandlers({
		contextmenu: (event, view) => {
			const position = view.posAtCoords({
				x: event.clientX,
				y: event.clientY,
			});

			if (position !== null) {
				onContextLine(view.state.doc.lineAt(position).number - 1);
			}

			return false;
		},
	});

	const markerBarExtension = StateField.define<DecorationSet>({
		create: (state) =>
			buildDecorations(parseMarkers(state.doc.toString()), actions),
		update: (decorations, transaction) => {
			for (const effect of transaction.effects) {
				if (effect.is(updateMarkerBar)) {
					return buildDecorations(effect.value, actions);
				}
			}

			return decorations;
		},
		provide: (field) => EditorView.decorations.from(field),
	});

	const markerBarRefreshExtension = ViewPlugin.fromClass(
		class {
			private readonly scheduler = new RefreshScheduler(120);

			constructor(private readonly view: EditorView) {}

			update(update: { docChanged: boolean }): void {
				if (!update.docChanged) {
					return;
				}

				this.scheduler.request(() => {
					const markers = parseMarkers(this.view.state.doc.toString());
					this.view.dispatch({ effects: updateMarkerBar.of(markers) });
				});
			}

			destroy(): void {
				this.scheduler.cancel();
			}
		},
	);

	return [
		contextPositionExtension,
		markerBarExtension,
		markerBarRefreshExtension,
	];
}

function buildDecorations(
	markers: ReadingMarker[],
	actions: MarkerBarActions,
): DecorationSet {
	if (markers.length === 0) {
		return Decoration.none;
	}

	const widget = Decoration.widget({
		widget: new MarkerBarWidget(markers, actions),
		block: true,
		side: -1,
	});

	return Decoration.set([widget.range(0)]);
}

class MarkerBarWidget extends WidgetType {
	private readonly signature: string;

	constructor(
		private readonly markers: ReadingMarker[],
		private readonly actions: MarkerBarActions,
	) {
		super();
		this.signature = markers
			.map((marker) => `${marker.blockId}:${marker.excerpt}`)
			.join('|');
	}

	eq(other: MarkerBarWidget): boolean {
		return this.signature === other.signature;
	}

	toDOM(): HTMLElement {
		const container = createDiv();
		renderMarkerBar(container, this.markers, this.actions);
		return container;
	}
}
