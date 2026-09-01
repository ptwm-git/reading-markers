import assert from 'node:assert/strict';
import test from 'node:test';
import {
	findNextMarker,
	findPreviousMarker,
	getCenterAfterMarkerAdded,
} from '../src/navigation-model';

const markers = [
	{ id: 'top', position: 10 },
	{ id: 'middle', position: 30 },
	{ id: 'bottom', position: 60 },
];

void test('finds the nearest marker strictly above or below the current position', () => {
	assert.equal(findPreviousMarker(markers, 45)?.id, 'middle');
	assert.equal(findNextMarker(markers, 45)?.id, 'bottom');
	assert.equal(findPreviousMarker(markers, 30)?.id, 'top');
	assert.equal(findNextMarker(markers, 30)?.id, 'bottom');
});

void test('returns no adjacent marker at the corresponding boundary', () => {
	assert.equal(findPreviousMarker(markers, 5), null);
	assert.equal(findNextMarker(markers, 65), null);
});

void test('keeps the existing center when adding another navigation marker', () => {
	assert.equal(getCenterAfterMarkerAdded(null, 'first'), 'first');
	assert.equal(getCenterAfterMarkerAdded('first', 'last'), 'first');
});
