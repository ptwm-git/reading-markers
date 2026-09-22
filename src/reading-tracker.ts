import { Component } from 'obsidian';
import type { FileView } from 'obsidian';
import { ReadingLocation, ReadingSession } from './reading-position';

export interface ReadingNavigationServices {
	getProgress(path: string): ReadingLocation | null;
	saveProgress(path: string, location: ReadingLocation): void;
	openMarkers(view: FileView): void;
}

export class ReadingTracker extends Component {
	private timer: number | null = null;
	private inputAt = 0;
	private pending: ReadingLocation | null = null;

	constructor(
		private readonly view: FileView,
		readonly session: ReadingSession,
		private readonly capture: () => ReadingLocation | null,
		private readonly refresh: () => void,
	) { super(); }

	onload(): void {
		const interact = (event: Event): void => {
			const target = event.target;
			if (target instanceof Element && target.closest(
				'.reading-markers-navigation-host, .reading-markers-browser, .reading-markers-bar',
			)) return;
			if (event instanceof KeyboardEvent &&
				!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) return;
			this.inputAt = Date.now();
			this.schedule();
		};
		this.registerDomEvent(this.view.contentEl, 'wheel', interact, { passive: true });
		this.registerDomEvent(this.view.contentEl, 'touchmove', interact, { passive: true });
		this.registerDomEvent(this.view.contentEl, 'pointerdown', interact);
		this.registerDomEvent(this.view.contentEl, 'keydown', interact);
		this.registerDomEvent(this.view.contentEl, 'scroll', () => {
			if (Date.now() - this.inputAt < 5000) this.schedule();
		}, true);
	}

	suppress(): void {
		this.flush();
		this.inputAt = 0;
	}

	flush(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
		if (this.pending) this.session.record(this.pending);
		this.pending = null;
	}

	onunload(): void { this.flush(); }

	private schedule(): void {
		if (this.session.detouring) return;
		this.pending = this.capture();
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			if (this.view.file?.path === this.session.filePath) this.pending = this.capture() ?? this.pending;
			this.flush();
			this.refresh();
		}, 800);
	}
}
