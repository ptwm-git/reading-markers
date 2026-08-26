import { MARKER_COLORS, MarkerColor, PdfReadingMarker } from './types';

export interface PdfMarkerMutation {
	readonly ok: boolean;
	readonly markers?: PdfReadingMarker[];
	readonly message?: string;
}

export function parsePdfMarkers(value: unknown): PdfReadingMarker[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((candidate) => {
		if (!isRecord(candidate)) {
			return [];
		}

		const filePath = candidate.filePath;
		const page = candidate.page;
		const color = candidate.color;
		const id = candidate.id;

		if (
			typeof filePath !== 'string' ||
			filePath.length === 0 ||
			typeof page !== 'number' ||
			!Number.isInteger(page) ||
			page < 1 ||
			typeof color !== 'string' ||
			!MARKER_COLORS.includes(color as MarkerColor) ||
			typeof id !== 'string' ||
			!/^pdf-marker-[a-z0-9]{12}$/.test(id)
		) {
			return [];
		}

		return [{
			id,
			filePath,
			page,
			color: color as MarkerColor,
		}];
	});
}

export function createPdfMarker(
	markers: PdfReadingMarker[],
	filePath: string,
	page: number,
	color: MarkerColor,
	id: string,
): PdfMarkerMutation {
	if (!filePath || !Number.isInteger(page) || page < 1) {
		return { ok: false, message: 'invalid-page' };
	}

	if (markers.some((marker) => marker.filePath === filePath && marker.page === page)) {
		return { ok: false, message: 'already-marked' };
	}

	return {
		ok: true,
		markers: [
			...markers,
			{ id, filePath, page, color },
		],
	};
}

export function changePdfMarkerColor(
	markers: PdfReadingMarker[],
	id: string,
	color: MarkerColor,
): PdfMarkerMutation {
	let found = false;
	const next = markers.map((marker) => {
		if (marker.id !== id) {
			return marker;
		}

		found = true;
		return { ...marker, color };
	});

	return found ? { ok: true, markers: next } : { ok: false, message: 'missing' };
}

export function removePdfMarker(
	markers: PdfReadingMarker[],
	id: string,
): PdfMarkerMutation {
	const next = markers.filter((marker) => marker.id !== id);
	return next.length === markers.length
		? { ok: false, message: 'missing' }
		: { ok: true, markers: next };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
