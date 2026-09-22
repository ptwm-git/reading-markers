import type { MarkerColor } from './types';

export interface LibraryMarker {
	kind: 'markdown' | 'pdf';
	filePath: string;
	markerId: string;
	color: MarkerColor;
	label: string;
	position: number;
}

export function filterLibraryMarkers(markers: LibraryMarker[], query: string, color: MarkerColor | null): LibraryMarker[] {
	const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	return markers.filter((marker) =>
		(!color || marker.color === color) &&
		words.every((word) => `${marker.filePath}\n${marker.label}`.toLocaleLowerCase().includes(word)),
	).sort((a, b) => a.filePath.localeCompare(b.filePath) || a.position - b.position);
}
