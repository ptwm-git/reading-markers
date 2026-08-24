import assert from 'node:assert/strict';
import test from 'node:test';
import { setLocale, strings } from '../src/i18n';
import { buildMarkerBlockId, parseMarkers, planMarkerInsertion } from '../src/marker-format';

void test('uses English for unsupported locales', () => {
	setLocale('fr');
	assert.equal(strings().addReadingMarker, 'Add reading marker');
	assert.equal(strings().colors.purple, 'Purple');
});

void test('uses Chinese for Chinese locale variants', () => {
	setLocale('zh-cn');
	assert.equal(strings().addReadingMarker, '添加阅读标记');
	assert.equal(strings().colors.purple, '紫色');
});

void test('localizes validation messages and unnamed excerpts', () => {
	const blockId = buildMarkerBlockId('blue', 'abc12345');

	setLocale('en');
	const englishPlan = planMarkerInsertion('', 0, blockId);
	assert.equal(englishPlan.ok, false);
	if (!englishPlan.ok) {
		assert.equal(englishPlan.message, 'Add a reading marker to a line that contains note content.');
	}
	assert.equal(parseMarkers(`^${blockId}`)[0]?.excerpt, 'Unnamed position');

	setLocale('zh-tw');
	const chinesePlan = planMarkerInsertion('', 0, blockId);
	assert.equal(chinesePlan.ok, false);
	if (!chinesePlan.ok) {
		assert.equal(chinesePlan.message, '请在包含正文的行上添加阅读标记。');
	}
	assert.equal(parseMarkers(`^${blockId}`)[0]?.excerpt, '未命名位置');

	setLocale('en');
});
