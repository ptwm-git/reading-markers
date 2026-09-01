export interface NavigationMarker {
	id: string;
	position: number;
}

export function getCenterAfterMarkerAdded(
	currentCenterId: string | null,
	addedMarkerId: string,
): string {
	return currentCenterId ?? addedMarkerId;
}

export function findPreviousMarker(
	markers: NavigationMarker[],
	currentPosition: number,
): NavigationMarker | null {
	return markers
		.filter((marker) => marker.position < currentPosition)
		.sort((left, right) => right.position - left.position)[0] ?? null;
}

export function findNextMarker(
	markers: NavigationMarker[],
	currentPosition: number,
): NavigationMarker | null {
	return markers
		.filter((marker) => marker.position > currentPosition)
		.sort((left, right) => left.position - right.position)[0] ?? null;
}
