import assert from 'node:assert/strict';
import test from 'node:test';
import {
	applyLineReplacement,
	buildMarkerBlockId,
	parseMarkers,
	planMarkerColorChange,
	planMarkerInsertion,
	planMarkerRemoval,
} from '../src/marker-format';

const BLUE_ID = buildMarkerBlockId('blue', 'abc12345');

void test('adds a marker to the end of a paragraph', () => {
	const source = '# Title\n\nA paragraph that spans\ntwo source lines.\n\nNext paragraph.';
	const plan = planMarkerInsertion(source, 2, BLUE_ID);

	assert.equal(plan.ok, true);
	if (!plan.ok) return;
	assert.equal(plan.replacement.line, 3);
	assert.equal(plan.replacement.after, `two source lines. ^${BLUE_ID}`);
	assert.equal(
		applyLineReplacement(source, plan.replacement),
		`# Title\n\nA paragraph that spans\ntwo source lines. ^${BLUE_ID}\n\nNext paragraph.`,
	);
});

void test('adds a marker directly to a list item', () => {
	const source = '- First item\n- Second item';
	const plan = planMarkerInsertion(source, 1, BLUE_ID);

	assert.equal(plan.ok, true);
	if (!plan.ok) return;
	assert.equal(plan.replacement.after, `- Second item ^${BLUE_ID}`);
});

void test('rejects frontmatter, fenced code, tables, blockquotes, and blank lines', () => {
	const frontmatter = '---\ntags: [study]\n---\nText';
	assert.equal(planMarkerInsertion(frontmatter, 1, BLUE_ID).ok, false);

	const code = '```ts\nconst value = 1;\n```';
	assert.equal(planMarkerInsertion(code, 1, BLUE_ID).ok, false);

	const table = '| A | B |\n| --- | --- |\n| 1 | 2 |';
	assert.equal(planMarkerInsertion(table, 2, BLUE_ID).ok, false);

	assert.equal(planMarkerInsertion('> Quote', 0, BLUE_ID).ok, false);
	assert.equal(planMarkerInsertion('Text\n\nMore', 1, BLUE_ID).ok, false);
});

void test('does not overwrite an existing block ID or reading marker', () => {
	assert.equal(planMarkerInsertion('Text ^existing-id', 0, BLUE_ID).ok, false);
	assert.equal(
		planMarkerInsertion(`Text ^${BLUE_ID}`, 0, BLUE_ID).ok,
		false,
	);
});

void test('parses markers in document order and creates excerpts', () => {
	const greenId = buildMarkerBlockId('green', 'def67890');
	const source = `# Title\n\nFirst important idea ^${BLUE_ID}\n\n- [ ] Review this example ^${greenId}`;
	const markers = parseMarkers(source);

	assert.deepEqual(
		markers.map(({ blockId, color, line, excerpt }) => ({
			blockId,
			color,
			line,
			excerpt,
		})),
		[
			{
				blockId: BLUE_ID,
				color: 'blue',
				line: 2,
				excerpt: 'First important idea',
			},
			{
				blockId: greenId,
				color: 'green',
				line: 4,
				excerpt: 'Review this example',
			},
		],
	);
});

void test('changes marker color without changing its unique ID', () => {
	const source = `Text ^${BLUE_ID}`;
	const plan = planMarkerColorChange(source, BLUE_ID, 'red');

	assert.equal(plan.ok, true);
	if (!plan.ok) return;
	assert.equal(plan.blockId, 'study-marker-red-abc12345');
	assert.equal(
		applyLineReplacement(source, plan.replacement),
		'Text ^study-marker-red-abc12345',
	);
});

void test('removes only the marker token and preserves the paragraph', () => {
	const source = `Keep this text. ^${BLUE_ID}`;
	const plan = planMarkerRemoval(source, BLUE_ID);

	assert.equal(plan.ok, true);
	if (!plan.ok) return;
	assert.equal(applyLineReplacement(source, plan.replacement), 'Keep this text.');
});

void test('does not replace a marker ID that is only a prefix', () => {
	const longerId = `${BLUE_ID}extra`;
	const source = `Keep this text. ^${longerId}`;

	assert.equal(parseMarkers(source)[0]?.blockId, longerId);
	assert.equal(planMarkerRemoval(source, BLUE_ID).ok, false);
	assert.equal(planMarkerColorChange(source, BLUE_ID, 'red').ok, false);
});

void test('rejects malformed marker IDs during removal', () => {
	assert.equal(planMarkerRemoval(`Text ^${BLUE_ID}`, 'not-a-marker').ok, false);
});

void test('rejects stale replacements instead of overwriting changed content', () => {
	const source = 'Original text';
	const plan = planMarkerInsertion(source, 0, BLUE_ID);

	assert.equal(plan.ok, true);
	if (!plan.ok) return;
	assert.equal(applyLineReplacement('Changed text', plan.replacement), null);
});
