import { App, Notice, TFile } from 'obsidian';
import {
	changePdfMarkerColor,
	createPdfMarker,
	removePdfMarker,
	PdfMarkerMutation,
} from './pdf-marker-format';
import { PluginLogger } from './logger';
import { strings } from './i18n';
import { MarkerColor, PdfReadingMarker } from './types';
import { ColorPickerModal } from './ui/color-picker-modal';

type PdfMarkerAddedCallback = (filePath: string, markerId: string) => void;
type PdfMarkerRemovedCallback = (filePath: string, markerId: string) => void;
export class PdfMarkerService {
	constructor(
		readonly app: App,
		private readonly logger: PluginLogger,
		private readonly getMarkers: () => PdfReadingMarker[],
		private readonly saveMarkers: (mutate: (markers: PdfReadingMarker[]) => PdfMarkerMutation) => Promise<boolean>,
		private readonly onMarkersChanged: (filePath: string) => void,
		private readonly notifySuccess: (message: string) => void,
		private readonly onMarkerAdded: PdfMarkerAddedCallback,
		private readonly onMarkerRemoved: PdfMarkerRemovedCallback,
	) {}

	openColorPicker(file: TFile, page: number): void {
		if (!this.isPdfPage(file, page)) {
			new Notice(strings().pdfPageUnavailable);
			return;
		}

		try {
			new ColorPickerModal(this.app, (color) => {
				this.runAsync('add-pdf-marker', () =>
					this.addMarker(file, page, color),
				);
			}).open();
		} catch (error) {
			this.reportUnexpectedError('open-pdf-color-picker', error);
		}
	}

	async changeMarkerColor(
		filePath: string,
		markerId: string,
		color: MarkerColor,
	): Promise<void> {
		const marker = this.findMarker(filePath, markerId);
		if (!marker) {
			new Notice(strings().pdfMarkerMissing);
			return;
		}

		await this.persistMutation(filePath,
			(markers) => changePdfMarkerColor(markers, markerId, color), strings().colorUpdated);
	}

	async removeMarker(filePath: string, markerId: string): Promise<void> {
		const marker = this.findMarker(filePath, markerId);
		if (!marker) {
			new Notice(strings().pdfMarkerMissing);
			return;
		}

		await this.persistMutation(filePath, (markers) => removePdfMarker(markers, markerId), strings().markerRemoved, () => {
			this.onMarkerRemoved(filePath, markerId);
		});
	}

	private async addMarker(file: TFile, page: number, color: MarkerColor): Promise<void> {
		const markerId = this.createUniqueId();
		const mutation = createPdfMarker(
			this.getMarkers(),
			file.path,
			page,
			color,
			markerId,
		);

		if (!mutation.ok) {
			new Notice(
				mutation.message === 'already-marked'
					? strings().pdfPageAlreadyMarked
					: strings().pdfPageUnavailable,
			);
			return;
		}

		await this.persistMutation(file.path,
			(markers) => createPdfMarker(markers, file.path, page, color, markerId), strings().pdfMarkerAdded, () => {
			this.onMarkerAdded(file.path, markerId);
		});
	}

	private async persistMutation(
		filePath: string,
		mutate: (markers: PdfReadingMarker[]) => PdfMarkerMutation,
		successMessage: string,
		onSuccess?: () => void,
	): Promise<void> {
		if (!(await this.saveMarkers(mutate))) {
			return;
		}

		this.onMarkersChanged(filePath);
		onSuccess?.();
		this.notifySuccess(successMessage);
	}

	private findMarker(filePath: string, markerId: string): PdfReadingMarker | undefined {
		return this.getMarkers().find(
			(marker) => marker.filePath === filePath && marker.id === markerId,
		);
	}

	private createUniqueId(): string {
		const markers = this.getMarkers();
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
			const id = `pdf-marker-${uid}`;
			if (!markers.some((marker) => marker.id === id)) {
				return id;
			}
		}

		throw new Error('Unable to create a unique PDF reading marker ID.');
	}

	private isPdfPage(file: TFile, page: number): boolean {
		return file.extension.toLowerCase() === 'pdf' && Number.isInteger(page) && page > 0;
	}

	private runAsync(action: string, operation: () => Promise<void>): void {
		void operation()
			.then(() => this.logger.debug(`${action}:complete`))
			.catch((error: unknown) => this.reportUnexpectedError(action, error));
	}

	private reportUnexpectedError(action: string, error: unknown): void {
		this.logger.error(action, error);
		new Notice(strings().operationFailed);
	}
}
