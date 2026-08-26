import assert from 'node:assert/strict';
import test from 'node:test';
import {
	changePdfMarkerColor,
	createPdfMarker,
	parsePdfMarkers,
	removePdfMarker,
} from '../src/pdf-marker-format';

const marker = {
	id: 'pdf-marker-abc123456789',
	filePath: 'Books/example.pdf',
	page: 8,
	color: 'blue' as const,
};

void test('parses only valid PDF marker records', () => {
	assert.deepEqual(
		parsePdfMarkers([
			marker,
			{ ...marker, page: 0 },
			{ ...marker, color: 'pink' },
			{ ...marker, id: 'not-owned' },
		]),
		[marker],
	);
});

void test('creates one marker per PDF page', () => {
	const added = createPdfMarker([], marker.filePath, marker.page, marker.color, marker.id);
	assert.equal(added.ok, true);
	assert.deepEqual(added.markers, [marker]);
	assert.equal(
		createPdfMarker([marker], marker.filePath, marker.page, 'red', 'pdf-marker-def123456789').message,
		'already-marked',
	);
});

void test('changes color and removes by plugin-owned ID', () => {
	const changed = changePdfMarkerColor([marker], marker.id, 'red');
	assert.deepEqual(changed.markers, [{ ...marker, color: 'red' }]);
	const removed = removePdfMarker(changed.markers ?? [], marker.id);
	assert.deepEqual(removed.markers, []);
	assert.equal(removePdfMarker([], marker.id).ok, false);
});
