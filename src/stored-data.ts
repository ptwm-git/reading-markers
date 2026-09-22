import { parsePdfMarkers } from './pdf-marker-format';
import { DEFAULT_SETTINGS, parseSettings, ReadingMarkersSettings } from './settings';
import { PdfReadingMarker } from './types';
import { parseProgress, ReadingProgress, renamedPath } from './reading-position';

export interface ReadingMarkersData extends ReadingMarkersSettings {
	pdfMarkers: PdfReadingMarker[];
	readingProgress: ReadingProgress[];
}

export const DEFAULT_DATA: ReadingMarkersData = {
	...DEFAULT_SETTINGS,
	pdfMarkers: [],
	readingProgress: [],
};

export function parseData(value: unknown): ReadingMarkersData {
	if (typeof value !== 'object' || value === null) {
		return { ...DEFAULT_DATA, pdfMarkers: [], readingProgress: [] };
	}

	const saved = value as Record<string, unknown>;
	return {
		...parseSettings(saved),
		pdfMarkers: parsePdfMarkers(saved.pdfMarkers),
		readingProgress: parseProgress(saved.readingProgress),
	};
}

export function renameStoredPaths(data: ReadingMarkersData, oldPath: string, newPath: string): ReadingMarkersData {
	return {
		...data,
		pdfMarkers: data.pdfMarkers.map((marker) => ({
			...marker, filePath: renamedPath(marker.filePath, oldPath, newPath),
		})),
		readingProgress: parseProgress(data.readingProgress.map((progress) => ({
			...progress, filePath: renamedPath(progress.filePath, oldPath, newPath),
		}))),
	};
}
