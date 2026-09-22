export interface MarkdownLocation {
	kind: 'markdown';
	line: number;
	text: string;
	before: string;
	after: string;
	blockId: string;
	offset: number;
}

export interface PdfLocation {
	kind: 'pdf';
	page: number;
	offset: number;
}

export type ReadingLocation = MarkdownLocation | PdfLocation;

export interface ReadingProgress {
	filePath: string;
	location: ReadingLocation;
	updatedAt: number;
}

function cleanLine(line: string): string {
	return line.replace(/\s+\^[a-zA-Z0-9-]+\s*$/, '').trim().slice(0, 240);
}

export function captureMarkdownAnchor(source: string, line: number, offset = 0): MarkdownLocation {
	const lines = source.split('\n');
	const index = Math.min(Math.max(0, Math.floor(line)), lines.length - 1);
	const text = lines[index] ?? '';
	return {
		kind: 'markdown',
		line: index,
		text: cleanLine(text),
		before: cleanLine(lines[index - 1] ?? ''),
		after: cleanLine(lines[index + 1] ?? ''),
		blockId: text.match(/\^([a-zA-Z0-9-]+)\s*$/)?.[1] ?? '',
		offset: Math.min(1, Math.max(0, offset)),
	};
}

export function resolveMarkdownAnchor(source: string, location: MarkdownLocation): {
	line: number; exact: boolean;
} {
	const lines = source.split('\n');
	if (location.blockId) {
		const index = lines.findIndex((line) =>
			line.trimEnd().endsWith(` ^${location.blockId}`),
		);
		if (index >= 0) return { line: index, exact: true };
	}
	const score = (index: number): number =>
		Number(!!location.before && cleanLine(lines[index - 1] ?? '') === location.before) +
		Number(!!location.after && cleanLine(lines[index + 1] ?? '') === location.after);
	const candidates = lines.flatMap((line, index) =>
		cleanLine(line) === location.text && (location.text || score(index) > 0) ? [index] : [],
	);
	candidates.sort((a, b) => {
		return score(b) - score(a) || Math.abs(a - location.line) - Math.abs(b - location.line);
	});
	const match = candidates[0];
	return match !== undefined
		? { line: match, exact: true }
		: { line: Math.min(location.line, lines.length - 1), exact: false };
}

export function parseProgress(value: unknown): ReadingProgress[] {
	if (!Array.isArray(value)) return [];
	const records = new Map<string, ReadingProgress>();
	for (const item of value) {
		if (!isRecord(item) || !isVaultPath(item.filePath) ||
			typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt) ||
			item.updatedAt < 0 || !isRecord(item.location)) continue;
		const location = item.location;
		if (typeof location.offset !== 'number' || !Number.isFinite(location.offset) ||
			location.offset < 0 || location.offset > 1) continue;
		let parsed: ReadingLocation;
		if (location.kind === 'pdf' && /\.pdf$/i.test(item.filePath) &&
			typeof location.page === 'number' && Number.isInteger(location.page) && location.page > 0) {
			parsed = { kind: 'pdf', page: location.page, offset: location.offset };
		} else if (location.kind === 'markdown' && /\.md$/i.test(item.filePath) &&
			typeof location.line === 'number' && Number.isInteger(location.line) && location.line >= 0 &&
			typeof location.text === 'string' && typeof location.before === 'string' &&
			typeof location.after === 'string' && typeof location.blockId === 'string') {
			parsed = {
				kind: 'markdown', line: location.line, offset: location.offset,
				text: location.text.slice(0, 240), before: location.before.slice(0, 240),
				after: location.after.slice(0, 240), blockId: location.blockId.slice(0, 200),
			};
		} else continue;
		const previous = records.get(item.filePath);
		if (!previous || previous.updatedAt <= item.updatedAt) {
			records.set(item.filePath, { filePath: item.filePath, location: parsed, updatedAt: item.updatedAt });
		}
	}
	return [...records.values()];
}

export function isVaultPath(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 &&
		!value.startsWith('/') && !value.includes('\\') &&
		!value.split('/').some((part) => part === '..' || part === '.' || part === '');
}

export function renamedPath(path: string, oldPath: string, newPath: string): string {
	return path === oldPath ? newPath
		: path.startsWith(`${oldPath}/`) ? newPath + path.slice(oldPath.length) : path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Keeps a temporary excursion from replacing the document's saved reading progress. */
export class ReadingSession {
	returnLocation: ReadingLocation | null = null;
	detouring = false;

	constructor(
		public filePath: string,
		private readonly save: (path: string, location: ReadingLocation) => void,
	) {}

	record(location: ReadingLocation): void {
		if (!this.detouring) this.save(this.filePath, location);
	}

	beginDetour(location: ReadingLocation, replaceReturn: boolean): void {
		this.record(location);
		if (replaceReturn) this.returnLocation = location;
		this.detouring = true;
	}

	continueAt(location: ReadingLocation): void {
		this.detouring = false;
		this.record(location);
	}
}
