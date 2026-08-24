import assert from 'node:assert/strict';
import test from 'node:test';
import { LogSink, PluginLogger } from '../src/logger';

class MemorySink implements LogSink {
	readonly debugEntries: Array<{ message: string; details?: unknown }> = [];
	readonly errorEntries: Array<{ message: string; error?: unknown }> = [];

	debug(message: string, details?: unknown): void {
		this.debugEntries.push({ message, details });
	}

	error(message: string, error?: unknown): void {
		this.errorEntries.push({ message, error });
	}
}

void test('debug logging follows the runtime switch', () => {
	let enabled = false;
	const sink = new MemorySink();
	const logger = new PluginLogger(() => enabled, sink);

	logger.debug('hidden');
	enabled = true;
	logger.debug('visible', { markerCount: 2 });

	assert.deepEqual(sink.debugEntries, [
		{
			message: '[Reading Markers] visible',
			details: { markerCount: 2 },
		},
	]);
});

void test('errors are always logged with the plugin prefix', () => {
	const sink = new MemorySink();
	const logger = new PluginLogger(() => false, sink);
	const error = new Error('disk unavailable');

	logger.error('save-marker', error);

	assert.deepEqual(sink.errorEntries, [
		{ message: '[Reading Markers] save-marker', error },
	]);
});

void test('background guard records rejected operations', async () => {
	const sink = new MemorySink();
	const logger = new PluginLogger(() => false, sink);
	const error = new Error('render failed');

	await logger.guardBackground('render-reading-view', () => Promise.reject(error));

	assert.deepEqual(sink.errorEntries, [
		{ message: '[Reading Markers] render-reading-view', error },
	]);
});
