import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS, parseSettings } from '../src/settings';
import { parseData } from '../src/stored-data';

void test('missing settings use safe defaults', () => {
	assert.deepEqual(parseSettings(undefined), DEFAULT_SETTINGS);
	assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
	assert.deepEqual(parseSettings('invalid'), DEFAULT_SETTINGS);
});

void test('valid saved settings are preserved', () => {
	assert.deepEqual(
		parseSettings({
			showSuccessNotices: false,
			enableDebugLogging: true,
		}),
		{
			showSuccessNotices: false,
			enableDebugLogging: true,
		},
	);
});

void test('invalid fields fall back independently and unknown fields are ignored', () => {
	assert.deepEqual(
		parseSettings({
			showSuccessNotices: 'no',
			enableDebugLogging: true,
			futureSetting: 42,
		}),
		{
			showSuccessNotices: true,
			enableDebugLogging: true,
		},
	);
});

void test('preserves valid PDF markers while migrating old settings data', () => {
	assert.deepEqual(
		parseData({
			showSuccessNotices: false,
			enableDebugLogging: true,
			pdfMarkers: [{
				id: 'pdf-marker-abc123456789',
				filePath: 'Books/example.pdf',
				page: 3,
				color: 'orange',
			}],
		}),
		{
			showSuccessNotices: false,
			enableDebugLogging: true,
			pdfMarkers: [{
				id: 'pdf-marker-abc123456789',
				filePath: 'Books/example.pdf',
				page: 3,
				color: 'orange',
			}],
		},
	);
	assert.deepEqual(parseData({ showSuccessNotices: false }).pdfMarkers, []);
});
