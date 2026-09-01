import assert from 'node:assert/strict';
import test from 'node:test';
import {
	findNextMarker,
	findPreviousMarker,
	getCenterAfterMarkerAdded,
	getNavigationTargets,
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

void test('keeps center navigation independent from adjacent targets', () => {
	const targets = getNavigationTargets(markers, 45, 'top');

	assert.equal(targets.previous?.id, 'middle');
	assert.equal(targets.center?.id, 'top');
	assert.equal(targets.next?.id, 'bottom');
});

void test('has no center target when the session has not established one', () => {
	assert.equal(getNavigationTargets(markers, 45, null).center, null);
});
