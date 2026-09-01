export interface NavigationMarker {
	id: string;
	position: number;
}

export interface NavigationTargets {
	previous: NavigationMarker | null;
	center: NavigationMarker | null;
	next: NavigationMarker | null;
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

export function getNavigationTargets(
	markers: NavigationMarker[],
	currentPosition: number,
	centerId: string | null,
): NavigationTargets {
	return {
		previous: findPreviousMarker(markers, currentPosition),
		center: markers.find((marker) => marker.id === centerId) ?? null,
		next: findNextMarker(markers, currentPosition),
	};
}
