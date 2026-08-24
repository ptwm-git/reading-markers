import {
	MARKER_COLORS,
	MarkerColor,
	MutationPlan,
	ReadingMarker,
} from './types';

const MARKER_PREFIX = 'study-marker';
const UID_PATTERN = '[a-z0-9]{8,32}';
const COLOR_PATTERN = MARKER_COLORS.join('|');
const MARKER_PATTERN = new RegExp(
	`\\^(${MARKER_PREFIX}-(${COLOR_PATTERN})-(${UID_PATTERN}))(?![A-Za-z0-9-])`,
);
const ANY_BLOCK_ID_PATTERN = /\s\^[A-Za-z0-9-]+\s*$/;
const LIST_ITEM_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+/;
const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+/;
const BLOCKQUOTE_PATTERN = /^\s{0,3}>/;
const HTML_BLOCK_PATTERN = /^\s{0,3}</;
const TABLE_DELIMITER_PATTERN = /^\s*\|?\s*:?-{3,}/;

export function buildMarkerBlockId(color: MarkerColor, uid: string): string {
	if (!new RegExp(`^${UID_PATTERN}$`).test(uid)) {
		throw new Error('Marker UID must contain 8 to 32 lowercase letters or numbers.');
	}

	return `${MARKER_PREFIX}-${color}-${uid}`;
}

export function parseMarkers(source: string): ReadingMarker[] {
	const lines = source.split('\n');
	const markers: ReadingMarker[] = [];

	for (let line = 0; line < lines.length; line += 1) {
		const text = lines[line] ?? '';
		const match = text.match(MARKER_PATTERN);

		if (!match) {
			continue;
		}

		const blockId = match[1];
		const color = match[2];
		const uid = match[3];

		if (!blockId || !color || !isMarkerColor(color) || !uid) {
			continue;
		}

		markers.push({
			blockId,
			color,
			uid,
			line,
			excerpt: markerExcerpt(lines, line, match[0]),
		});
	}

	return markers;
}

export function planMarkerInsertion(
	source: string,
	targetLine: number,
	blockId: string,
): MutationPlan {
	const lines = source.split('\n');

	if (!Number.isInteger(targetLine) || targetLine < 0 || targetLine >= lines.length) {
		return failure('无法确定要标记的正文位置。');
	}

	if (isInFrontmatter(lines, targetLine)) {
		return failure('不能在文档属性区添加阅读标记。');
	}

	if (isInFencedCodeBlock(lines, targetLine)) {
		return failure('第一版暂不支持在代码块中添加阅读标记。');
	}

	const target = lines[targetLine] ?? '';
	const trimmed = target.trim();

	if (!trimmed) {
		return failure('请在包含正文的行上添加阅读标记。');
	}

	if (BLOCKQUOTE_PATTERN.test(target)) {
		return failure('第一版暂不支持在引用或 Callout 中添加阅读标记。');
	}

	if (isTableLine(lines, targetLine)) {
		return failure('第一版暂不支持在表格中添加阅读标记。');
	}

	if (HTML_BLOCK_PATTERN.test(target)) {
		return failure('第一版暂不支持在 HTML 内容中添加阅读标记。');
	}

	const insertionLine = findInsertionLine(lines, targetLine);
	const before = lines[insertionLine] ?? '';

	if (MARKER_PATTERN.test(before)) {
		return failure('这个正文块已经有阅读标记。');
	}

	if (ANY_BLOCK_ID_PATTERN.test(before)) {
		return failure('这个正文块已经有其他块标识符，暂不自动修改。');
	}

	return {
		ok: true,
		blockId,
		replacement: {
			line: insertionLine,
			before,
			after: `${before} ^${blockId}`,
		},
	};
}

export function planMarkerColorChange(
	source: string,
	blockId: string,
	newColor: MarkerColor,
): MutationPlan {
	const marker = parseBlockId(blockId);

	if (!marker) {
		return failure('找不到有效的阅读标记。');
	}

	const newBlockId = buildMarkerBlockId(newColor, marker.uid);
	return planMarkerReplacement(source, blockId, newBlockId, newBlockId);
}

export function planMarkerRemoval(source: string, blockId: string): MutationPlan {
	if (!parseBlockId(blockId)) {
		return failure('找不到有效的阅读标记。');
	}

	return planMarkerReplacement(source, blockId, '', blockId);
}

export function applyLineReplacement(
	source: string,
	replacement: { line: number; before: string; after: string },
): string | null {
	const lines = source.split('\n');

	if (lines[replacement.line] !== replacement.before) {
		return null;
	}

	lines[replacement.line] = replacement.after;
	return lines.join('\n');
}

function planMarkerReplacement(
	source: string,
	blockId: string,
	replacementBlockId: string,
	resultBlockId: string,
): MutationPlan {
	const lines = source.split('\n');
	const token = `^${blockId}`;
	const tokenPattern = new RegExp(
		`${escapeRegularExpression(token)}(?![A-Za-z0-9-])`,
	);

	for (let line = 0; line < lines.length; line += 1) {
		const before = lines[line] ?? '';
		const tokenIndex = before.search(tokenPattern);

		if (tokenIndex < 0) {
			continue;
		}

		const after = replacementBlockId
			? `${before.slice(0, tokenIndex)}^${replacementBlockId}${before.slice(tokenIndex + token.length)}`
			: removeMarkerToken(before, tokenIndex, token.length);

		return {
			ok: true,
			blockId: resultBlockId,
			replacement: { line, before, after },
		};
	}

	return failure('这个阅读标记已经不存在。');
}

function escapeRegularExpression(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeMarkerToken(line: string, tokenIndex: number, tokenLength: number): string {
	const beforeToken = line.slice(0, tokenIndex);
	const afterToken = line.slice(tokenIndex + tokenLength);
	const cleanedBefore = beforeToken.endsWith(' ')
		? beforeToken.slice(0, -1)
		: beforeToken;
	return `${cleanedBefore}${afterToken}`.trimEnd();
}

function parseBlockId(
	blockId: string,
): { color: MarkerColor; uid: string } | null {
	const match = `^${blockId}`.match(MARKER_PATTERN);

	if (!match || match[0] !== `^${blockId}`) {
		return null;
	}

	const color = match[2];
	const uid = match[3];
	return color && isMarkerColor(color) && uid ? { color, uid } : null;
}

function findInsertionLine(lines: string[], targetLine: number): number {
	const target = lines[targetLine] ?? '';

	if (HEADING_PATTERN.test(target) || LIST_ITEM_PATTERN.test(target)) {
		return targetLine;
	}

	let line = targetLine;

	while (line + 1 < lines.length) {
		const next = lines[line + 1] ?? '';

		if (
			!next.trim() ||
			HEADING_PATTERN.test(next) ||
			LIST_ITEM_PATTERN.test(next) ||
			BLOCKQUOTE_PATTERN.test(next) ||
			isFenceLine(next) ||
			isTableLine(lines, line + 1)
		) {
			break;
		}

		line += 1;
	}

	return line;
}

function isInFrontmatter(lines: string[], targetLine: number): boolean {
	if ((lines[0] ?? '').trim() !== '---') {
		return false;
	}

	for (let line = 1; line < lines.length; line += 1) {
		const value = (lines[line] ?? '').trim();

		if (value === '---' || value === '...') {
			return targetLine <= line;
		}

		if (line >= targetLine) {
			return true;
		}
	}

	return true;
}

function isInFencedCodeBlock(lines: string[], targetLine: number): boolean {
	let fence: { character: string; length: number } | null = null;

	for (let line = 0; line <= targetLine; line += 1) {
		const value = lines[line] ?? '';
		const match = value.match(/^\s{0,3}(`{3,}|~{3,})/);

		if (!match?.[1]) {
			continue;
		}

		const marker = match[1];
		const character = marker[0] ?? '';

		if (!fence) {
			fence = { character, length: marker.length };
		} else if (character === fence.character && marker.length >= fence.length) {
			fence = null;
		}
	}

	return fence !== null || isFenceLine(lines[targetLine] ?? '');
}

function isFenceLine(line: string): boolean {
	return /^\s{0,3}(?:`{3,}|~{3,})/.test(line);
}

function isTableLine(lines: string[], line: number): boolean {
	const current = lines[line] ?? '';
	const previous = lines[line - 1] ?? '';
	const next = lines[line + 1] ?? '';

	return (
		TABLE_DELIMITER_PATTERN.test(current) ||
		(TABLE_DELIMITER_PATTERN.test(previous) && current.includes('|')) ||
		(TABLE_DELIMITER_PATTERN.test(next) && current.includes('|'))
	);
}

function markerExcerpt(lines: string[], line: number, token: string): string {
	let candidate = (lines[line] ?? '').replace(token, '').trim();

	for (let previous = line - 1; !candidate && previous >= 0; previous -= 1) {
		const value = (lines[previous] ?? '').trim();

		if (!value) {
			break;
		}

		candidate = value.replace(MARKER_PATTERN, '').trim();
	}

	const plain = candidate
		.replace(/^\s{0,3}#{1,6}\s+/, '')
		.replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
		.replace(/^\[[ xX]\]\s+/, '')
		.replace(/[*_`~]/g, '')
		.trim();

	if (!plain) {
		return '未命名位置';
	}

	const characters = Array.from(plain);
	return characters.length > 36
		? `${characters.slice(0, 36).join('')}...`
		: plain;
}

function isMarkerColor(value: string): value is MarkerColor {
	return MARKER_COLORS.some((color) => color === value);
}

function failure(message: string): MutationPlan {
	return { ok: false, message };
}
