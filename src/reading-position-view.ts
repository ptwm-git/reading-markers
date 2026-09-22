import { EditorView } from '@codemirror/view';
import type { MarkdownView } from 'obsidian';
import { captureMarkdownAnchor, MarkdownLocation, resolveMarkdownAnchor } from './reading-position';

export function markdownScroller(view: MarkdownView): HTMLElement {
	return view.getMode() === 'source'
		? view.contentEl.querySelector<HTMLElement>('.cm-scroller') ?? view.contentEl
		: view.contentEl.querySelector<HTMLElement>('.markdown-preview-view') ?? view.contentEl;
}

function editorView(view: MarkdownView): EditorView | null {
	const dom = view.contentEl.querySelector<HTMLElement>('.cm-editor');
	return dom ? EditorView.findFromDOM(dom) : null;
}

export function captureMarkdownLocation(view: MarkdownView, source: string): MarkdownLocation | null {
	const scroller = markdownScroller(view);
	const top = scroller.getBoundingClientRect().top;
	if (view.getMode() === 'source') {
		const editor = editorView(view);
		if (!editor || scroller.clientHeight === 0) return null;
		const block = editor.lineBlockAtHeight(Math.max(0, top + 1 - editor.documentTop));
		const line = editor.state.doc.lineAt(Math.min(block.from, editor.state.doc.length)).number - 1;
		return captureMarkdownAnchor(view.editor.getValue(), line,
			(top - editor.documentTop - block.top) / Math.max(1, block.height));
	}
	const sections = Array.from(scroller.querySelectorAll<HTMLElement>('[data-reading-marker-line]'))
		.filter((el) => el.getBoundingClientRect().height > 0);
	const visible = sections.filter((el) => el.getBoundingClientRect().bottom > top + 8);
	const covering = visible.filter((el) => el.getBoundingClientRect().top <= top + 8);
	const target = (covering.length ? covering : visible).sort((a, b) =>
		Math.abs(a.getBoundingClientRect().top - top) - Math.abs(b.getBoundingClientRect().top - top),
	)[0];
	if (!target) return null;
	const bounds = target.getBoundingClientRect();
	return captureMarkdownAnchor(source, Number(target.dataset.readingMarkerLine),
		(top - bounds.top) / Math.max(1, bounds.height));
}

export async function restoreMarkdownLocation(
	view: MarkdownView, source: string, location: MarkdownLocation,
): Promise<boolean> {
	const resolved = resolveMarkdownAnchor(source, location);
	const file = view.file;
	if (view.getMode() === 'source') {
		const editor = editorView(view);
		if (!editor) return false;
		const line = editor.state.doc.line(Math.min(resolved.line + 1, editor.state.doc.lines));
		view.editor.setCursor({ line: line.number - 1, ch: 0 });
		editor.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 0 }) });
		await nextFrame(view.containerEl);
		await nextFrame(view.containerEl);
		if (view.file !== file) return false;
		const block = editor.lineBlockAt(line.from);
		editor.scrollDOM.scrollTop += editor.documentTop + block.top -
			editor.scrollDOM.getBoundingClientRect().top + location.offset * block.height;
	} else {
		view.setEphemeralState({ line: resolved.line });
		await nextFrame(view.containerEl);
		await nextFrame(view.containerEl);
		if (view.file !== file) return false;
		const scroller = markdownScroller(view);
		const target = Array.from(scroller.querySelectorAll<HTMLElement>('[data-reading-marker-line]'))
			.filter((el) => Number(el.dataset.readingMarkerLine) <= resolved.line &&
				Number(el.dataset.readingMarkerEnd) >= resolved.line)
			.sort((a, b) => Number(b.dataset.readingMarkerLine) - Number(a.dataset.readingMarkerLine))[0];
		if (target) {
			const bounds = target.getBoundingClientRect();
			scroller.scrollTop += bounds.top - scroller.getBoundingClientRect().top + location.offset * bounds.height;
		}
	}
	return resolved.exact;
}

function nextFrame(el: HTMLElement): Promise<void> {
	return new Promise((resolve) => {
		const owner = el.ownerDocument.defaultView;
		if (!owner) { resolve(); return; }
		let frame = 0;
		// Background Electron windows can suspend animation frames indefinitely.
		const timeout = owner.setTimeout(() => { owner.cancelAnimationFrame(frame); resolve(); }, 100);
		frame = owner.requestAnimationFrame(() => { owner.clearTimeout(timeout); resolve(); });
	});
}
