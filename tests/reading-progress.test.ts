import assert from 'node:assert/strict';
import test from 'node:test';
import { captureMarkdownAnchor, parseProgress, ReadingSession, resolveMarkdownAnchor } from '../src/reading-position';
import { parseData, renameStoredPaths } from '../src/stored-data';
import { DataStore } from '../src/data-store';

void test('anchors follow inserted lines and color changes without rewriting notes', () => {
	const source = 'Heading\nRead here ^study-marker-blue-abc123456789\nNext';
	const anchor = captureMarkdownAnchor(source, 1, 0.4);
	assert.deepEqual(resolveMarkdownAnchor('New\n' + source, anchor), { line: 2, exact: true });
	assert.deepEqual(resolveMarkdownAnchor(source.replace('blue', 'red'), anchor), { line: 1, exact: true });
	assert.equal(anchor.offset, 0.4);
});

void test('repeated text resolves using neighbors and removed text is marked approximate', () => {
	const source = 'Chapter one\nIntroduction\nFirst\nChapter two\nIntroduction\nSecond';
	const anchor = captureMarkdownAnchor(source, 4);
	assert.deepEqual(resolveMarkdownAnchor('Preface\n' + source, anchor), { line: 5, exact: true });
	assert.deepEqual(resolveMarkdownAnchor('Nothing remains', anchor), { line: 0, exact: false });
});

void test('progress migration rejects malformed records and keeps the newest per document', () => {
	const valid = { filePath: 'Books/a.pdf', location: { kind: 'pdf', page: 4, offset: 0.6 }, updatedAt: 10 };
	const records = parseProgress([
		valid, { ...valid, updatedAt: 5 }, { ...valid, filePath: '../outside.pdf' },
		{ ...valid, location: { ...valid.location, offset: Infinity } },
		{ ...valid, location: { kind: 'pdf', page: 0, offset: 0 } },
		{ ...valid, filePath: 'wrong.md' },
	]);
	assert.deepEqual(records, [valid]);
	assert.deepEqual(parseData({ showSuccessNotices: false }).readingProgress, []);
});

void test('reading in a paragraph gap follows its neighboring text after an insertion', () => {
	const source = 'First paragraph\n\nSecond paragraph';
	const anchor = captureMarkdownAnchor(source, 1, 0.5);
	assert.deepEqual(resolveMarkdownAnchor('Preface\n\n' + source, anchor), { line: 3, exact: true });
	assert.deepEqual(resolveMarkdownAnchor('Unrelated\n\nContent', anchor), { line: 1, exact: false });
});

void test('file and folder renames preserve markers and progress without affecting sibling folders', () => {
	const data = parseData({
		pdfMarkers: [
			{ id: 'pdf-marker-abc123456789', filePath: 'Books/a.pdf', page: 4, color: 'blue' },
			{ id: 'pdf-marker-def123456789', filePath: 'Bookshelf/b.pdf', page: 2, color: 'red' },
		],
		readingProgress: [{ filePath: 'Books/note.md', location: captureMarkdownAnchor('Reading', 0), updatedAt: 1 }],
	});
	const moved = renameStoredPaths(data, 'Books', 'Archive/Books');
	assert.equal(moved.pdfMarkers[0]?.filePath, 'Archive/Books/a.pdf');
	assert.equal(moved.pdfMarkers[1]?.filePath, 'Bookshelf/b.pdf');
	assert.equal(moved.readingProgress[0]?.filePath, 'Archive/Books/note.md');
	assert.equal(renameStoredPaths(moved, 'Archive/Books/a.pdf', 'Archive/new.pdf').pdfMarkers[0]?.filePath, 'Archive/new.pdf');
	assert.equal(data.pdfMarkers[0]?.filePath, 'Books/a.pdf');
});

void test('excursions freeze persisted progress while temporary returns still obey save and skip', () => {
	const saved: number[] = [];
	const session = new ReadingSession('book.pdf', (_path, location) => {
		if (location.kind === 'pdf') saved.push(location.page);
	});
	const page = (number: number) => ({ kind: 'pdf' as const, page: number, offset: 0.5 });
	session.record(page(10));
	session.beginDetour(page(10), true);
	session.record(page(100));
	session.beginDetour(page(100), false);
	assert.deepEqual(session.returnLocation, page(10));
	assert.deepEqual(saved, [10, 10]);
	session.beginDetour(page(50), true);
	assert.deepEqual(session.returnLocation, page(50));
	assert.deepEqual(saved, [10, 10]);
	session.continueAt(page(20));
	session.record(page(21));
	assert.deepEqual(saved, [10, 10, 20, 21]);
});

void test('sessions isolate files and views', () => {
	const one = new ReadingSession('a.pdf', () => undefined);
	const two = new ReadingSession('b.pdf', () => undefined);
	one.beginDetour({ kind: 'pdf', page: 8, offset: 0.5 }, true);
	assert.equal(two.returnLocation, null);
	assert.equal(two.detouring, false);
});

void test('queued progress and PDF writes do not overwrite each other; a failed write can be retried', async () => {
	const disk: { pdf: number; progress: number }[] = [];
	const store = new DataStore({ pdf: 0, progress: 0 }, async (value) => {
		await Promise.resolve();
		if (value.progress === 9) throw new Error('disk unavailable');
		disk.push(value);
	});
	await Promise.all([
		store.update((value) => ({ ...value, pdf: 3 })),
		store.update((value) => ({ ...value, progress: 5 })),
	]);
	await assert.rejects(store.update((value) => ({ ...value, progress: 9 })), /disk unavailable/);
	await store.update((value) => ({ ...value, pdf: 7 }));
	assert.deepEqual(store.value, { pdf: 7, progress: 5 });
	assert.deepEqual(disk.at(-1), store.value);
});
