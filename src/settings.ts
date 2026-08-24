export interface ReadingMarkersSettings {
	showSuccessNotices: boolean;
	enableDebugLogging: boolean;
}

export const DEFAULT_SETTINGS: ReadingMarkersSettings = {
	showSuccessNotices: true,
	enableDebugLogging: false,
};

export function parseSettings(value: unknown): ReadingMarkersSettings {
	if (typeof value !== 'object' || value === null) {
		return { ...DEFAULT_SETTINGS };
	}

	const saved = value as Record<string, unknown>;
	return {
		showSuccessNotices:
			typeof saved.showSuccessNotices === 'boolean'
				? saved.showSuccessNotices
				: DEFAULT_SETTINGS.showSuccessNotices,
		enableDebugLogging:
			typeof saved.enableDebugLogging === 'boolean'
				? saved.enableDebugLogging
				: DEFAULT_SETTINGS.enableDebugLogging,
	};
}
