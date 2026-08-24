export const MARKER_COLORS = [
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'purple',
] as const;

export type MarkerColor = (typeof MARKER_COLORS)[number];

export const COLOR_LABELS: Record<MarkerColor, string> = {
	red: '红色',
	orange: '橙色',
	yellow: '黄色',
	green: '绿色',
	blue: '蓝色',
	purple: '紫色',
};

export interface ReadingMarker {
	blockId: string;
	color: MarkerColor;
	uid: string;
	line: number;
	excerpt: string;
}

export interface LineReplacement {
	line: number;
	before: string;
	after: string;
}

export type MutationPlan =
	| { ok: true; replacement: LineReplacement; blockId: string }
	| { ok: false; message: string };
