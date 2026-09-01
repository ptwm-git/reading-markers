import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	MarkdownView,
	Menu,
	TFile,
} from 'obsidian';
import { parseMarkers } from './marker-format';
import { strings } from './i18n';
import { MarkerService } from './marker-service';
import { MarkerBarActions, MarkerBarEntry, renderMarkerBar } from './ui/marker-bar';

const CONTENT_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6';

export async function processReadingSection(
	el: HTMLElement,
	context: MarkdownPostProcessorContext,
	service: MarkerService,
	actions: MarkerBarActions,
): Promise<void> {
	const abstractFile = service.app.vault.getAbstractFileByPath(context.sourcePath);

	if (!(abstractFile instanceof TFile)) {
		return;
	}

	const child = new ReadingMarkerSectionChild(
		el,
		context,
		abstractFile,
		service,
	);
	context.addChild(child);

	const section = context.getSectionInfo(el);

	if (!section) {
		return;
	}

	const source = await service.app.vault.cachedRead(abstractFile);
	const firstBodyLine = findFirstBodyLine(source);

	if (firstBodyLine < section.lineStart || firstBodyLine > section.lineEnd) {
		return;
	}

	const markers = parseMarkers(source);
	const existingBar = el.querySelector<HTMLElement>(
		':scope > .reading-markers-bar-host',
	);

	const bar = existingBar ?? el.createDiv({ cls: 'reading-markers-bar-host' });

	if (!existingBar) {
		el.prepend(bar);
	}

	if (markers.length === 0) {
		bar.empty();
		bar.addClass('reading-markers-bar-host-empty');
		return;
	}

	bar.removeClass('reading-markers-bar-host-empty');
	renderMarkerBar(bar, toMarkerBarEntries(markers), actions);
}

export function refreshReadingMarkerBars(
	app: App,
	file: TFile,
	source: string,
	actions: MarkerBarActions,
): void {
	const markers = parseMarkers(source);

	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (!(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) {
			continue;
		}

		const bars = leaf.view.containerEl.querySelectorAll<HTMLElement>(
			'.reading-markers-bar-host',
		);

		bars.forEach((bar) => {
			if (markers.length === 0) {
				bar.empty();
				bar.addClass('reading-markers-bar-host-empty');
			} else {
				bar.removeClass('reading-markers-bar-host-empty');
				renderMarkerBar(bar, toMarkerBarEntries(markers), actions);
			}
		});
	}
}

function toMarkerBarEntries(markers: ReturnType<typeof parseMarkers>): MarkerBarEntry[] {
	return markers.map((marker) => ({
		markerId: marker.blockId,
		color: marker.color,
		label: marker.excerpt,
	}));
}

class ReadingMarkerSectionChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly context: MarkdownPostProcessorContext,
		private readonly file: TFile,
		private readonly service: MarkerService,
	) {
		super(containerEl);
	}

	onload(): void {
		this.registerDomEvent(this.containerEl, 'contextmenu', (event) => {
			const line = this.getClickedLine(event);

			if (line === null) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			const menu = new Menu();
			menu.addItem((item) => {
				item
					.setTitle(strings().addReadingMarker)
					.setIcon('tag')
					.onClick(() => this.service.openFileColorPicker(this.file, line));
			});
			menu.showAtMouseEvent(event);
		});
	}

	private getClickedLine(event: MouseEvent): number | null {
		const target = event.target;

		if (!(target instanceof HTMLElement)) {
			return null;
		}

		const block = target.closest<HTMLElement>(CONTENT_SELECTOR);

		if (!block || !this.containerEl.contains(block)) {
			return null;
		}

		return this.context.getSectionInfo(block)?.lineStart ?? null;
	}
}

function findFirstBodyLine(source: string): number {
	const lines = source.split('\n');
	let line = 0;

	if ((lines[0] ?? '').trim() === '---') {
		line = 1;

		while (line < lines.length) {
			const value = (lines[line] ?? '').trim();
			line += 1;

			if (value === '---' || value === '...') {
				break;
			}
		}
	}

	while (line < lines.length && !(lines[line] ?? '').trim()) {
		line += 1;
	}

	return line;
}
