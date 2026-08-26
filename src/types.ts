export const MARKER_COLORS = [
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'purple',
] as const;

export type MarkerColor = (typeof MARKER_COLORS)[number];

export interface ReadingMarker {
	blockId: string;
	color: MarkerColor;
	uid: string;
	line: number;
	excerpt: string;
}

export interface PdfReadingMarker {
	id: string;
	filePath: string;
	page: number;
	color: MarkerColor;
}

export interface LineReplacement {
	line: number;
	before: string;
	after: string;
}

export type MutationPlan =
	| { ok: true; replacement: LineReplacement; blockId: string }
	| { ok: false; message: string };
