import { parsePdfMarkers } from './pdf-marker-format';
import { DEFAULT_SETTINGS, parseSettings, ReadingMarkersSettings } from './settings';
import { PdfReadingMarker } from './types';

export interface ReadingMarkersData extends ReadingMarkersSettings {
	pdfMarkers: PdfReadingMarker[];
}

export const DEFAULT_DATA: ReadingMarkersData = {
	...DEFAULT_SETTINGS,
	pdfMarkers: [],
};

export function parseData(value: unknown): ReadingMarkersData {
	if (typeof value !== 'object' || value === null) {
		return { ...DEFAULT_DATA };
	}

	const saved = value as Record<string, unknown>;
	return {
		...parseSettings(saved),
		pdfMarkers: parsePdfMarkers(saved.pdfMarkers),
	};
}
