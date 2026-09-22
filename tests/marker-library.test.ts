import assert from 'node:assert/strict';
import test from 'node:test';
import { filterLibraryMarkers, LibraryMarker } from '../src/marker-library';

const markers: LibraryMarker[] = [
	{ kind: 'pdf', filePath: 'Books/学习.pdf', markerId: 'one', color: 'red', label: '第 10 页', position: 10 },
	{ kind: 'markdown', filePath: 'Notes/Study.md', markerId: 'two', color: 'blue', label: 'A useful example', position: 30 },
	{ kind: 'markdown', filePath: 'Notes/Study.md', markerId: 'three', color: 'blue', label: 'Opening', position: 2 },
];

void test('library combines path, text, and color filters in document order', () => {
	assert.deepEqual(filterLibraryMarkers(markers, 'STUDY', 'blue').map((m) => m.markerId), ['three', 'two']);
	assert.deepEqual(filterLibraryMarkers(markers, '学习 10', 'red').map((m) => m.markerId), ['one']);
	assert.deepEqual(filterLibraryMarkers(markers, 'study useful', null).map((m) => m.markerId), ['two']);
	assert.deepEqual(filterLibraryMarkers(markers, 'absent', null), []);
	assert.equal(markers[1]?.markerId, 'two');
});
