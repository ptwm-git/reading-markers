import { App, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import {
	applyLineReplacement,
	buildMarkerBlockId,
	parseMarkers,
	planMarkerColorChange,
	planMarkerInsertion,
	planMarkerRemoval,
} from './marker-format';
import { PluginLogger } from './logger';
import { strings } from './i18n';
import { MarkerColor, MutationPlan } from './types';
import { ColorPickerModal } from './ui/color-picker-modal';
import { ReadingMarkersSettings } from './settings';

type SourcePlanner = (source: string) => MutationPlan;

export class MarkerService {
	private editorContextLine: { line: number; timestamp: number } | null = null;

	constructor(
		readonly app: App,
		private readonly logger: PluginLogger,
		private readonly getSettings: () => ReadingMarkersSettings,
	) {}

	rememberEditorContextLine(line: number): void {
		this.editorContextLine = { line, timestamp: Date.now() };
	}

	consumeEditorContextLine(editor: Editor): number {
		const context = this.editorContextLine;
		this.editorContextLine = null;

		if (context && Date.now() - context.timestamp < 1500) {
			return context.line;
		}

		return editor.getCursor().line;
	}

	openEditorColorPicker(editor: Editor, file: TFile, line: number): void {
		this.runUserAction('open-editor-color-picker', () => {
			new ColorPickerModal(this.app, (color) => {
				this.runUserAction('add-marker-in-editor', () => {
					this.addMarkerInEditor(editor, file, line, color);
				});
			}).open();
		});
	}

	openFileColorPicker(file: TFile, line: number): void {
		this.runUserAction('open-reading-color-picker', () => {
			new ColorPickerModal(this.app, (color) => {
				this.runAsyncUserAction('add-marker-in-reading-view', () =>
					this.addMarkerInFile(file, line, color),
				);
			}).open();
		});
	}

	jumpToMarker(file: TFile, blockId: string): void {
		this.runAsyncUserAction('jump-to-marker', () => this.jump(file, blockId));
	}

	changeMarkerColor(file: TFile, blockId: string, color: MarkerColor): void {
		const editor = this.getActiveEditor(file);

		if (editor) {
			this.runUserAction('change-marker-color-in-editor', () => {
				const plan = planMarkerColorChange(editor.getValue(), blockId, color);
				this.applyEditorPlan(editor, plan, strings().colorUpdated);
			});
			return;
		}

		this.runAsyncUserAction('change-marker-color-in-file', () =>
			this.applyFilePlan(
				file,
				(source) => planMarkerColorChange(source, blockId, color),
				strings().colorUpdated,
			),
		);
	}

	removeMarker(file: TFile, blockId: string): void {
		const editor = this.getActiveEditor(file);

		if (editor) {
			this.runUserAction('remove-marker-in-editor', () => {
				const plan = planMarkerRemoval(editor.getValue(), blockId);
				this.applyEditorPlan(editor, plan, strings().markerRemoved);
			});
			return;
		}

		this.runAsyncUserAction('remove-marker-in-file', () =>
			this.applyFilePlan(
				file,
				(source) => planMarkerRemoval(source, blockId),
				strings().markerRemoved,
			),
		);
	}

	private addMarkerInEditor(
		editor: Editor,
		file: TFile,
		line: number,
		color: MarkerColor,
	): void {
		if (!this.isActiveFile(file)) {
			new Notice(strings().documentSwitched);
			return;
		}

		const source = editor.getValue();
		const blockId = this.createUniqueBlockId(source, color);
		const plan = planMarkerInsertion(source, line, blockId);
		this.applyEditorPlan(editor, plan, strings().markerAdded);
	}

	private async addMarkerInFile(
		file: TFile,
		line: number,
		color: MarkerColor,
	): Promise<void> {
		await this.applyFilePlan(
			file,
			(source) => {
				const blockId = this.createUniqueBlockId(source, color);
				return planMarkerInsertion(source, line, blockId);
			},
			strings().markerAdded,
		);
	}

	private applyEditorPlan(
		editor: Editor,
		plan: MutationPlan,
		successMessage: string,
	): void {
		if (!plan.ok) {
			new Notice(plan.message);
			return;
		}

		const { replacement } = plan;

		if (editor.getLine(replacement.line) !== replacement.before) {
			new Notice(strings().documentChanged);
			return;
		}

		editor.replaceRange(
			replacement.after,
			{ line: replacement.line, ch: 0 },
			{ line: replacement.line, ch: replacement.before.length },
		);
		this.notifySuccess(successMessage);
	}

	private async applyFilePlan(
		file: TFile,
		planner: SourcePlanner,
		successMessage: string,
	): Promise<void> {
		const state: {
			outcome: MutationPlan | null;
			changed: boolean;
		} = {
			outcome: null,
			changed: false,
		};

		await this.app.vault.process(file, (source) => {
			state.outcome = planner(source);

			if (!state.outcome.ok) {
				return source;
			}

			const updated = applyLineReplacement(
				source,
				state.outcome.replacement,
			);

			if (updated === null) {
				state.outcome = {
					ok: false,
					message: strings().documentChanged,
				};
				return source;
			}

			state.changed = updated !== source;
			return updated;
		});

		if (!state.outcome || !state.outcome.ok) {
			new Notice(state.outcome?.message ?? strings().operationFailed);
			return;
		}

		if (state.changed) {
			this.notifySuccess(successMessage);
		}
	}

	private async jump(file: TFile, blockId: string): Promise<void> {
		const editor = this.getActiveEditor(file);
		const source = editor?.getValue() ?? (await this.app.vault.cachedRead(file));
		const marker = parseMarkers(source).find(
			(candidate) => candidate.blockId === blockId,
		);

		if (!marker) {
			new Notice(strings().markerMissing);
			return;
		}

		if (editor) {
			const position = { line: marker.line, ch: 0 };
			editor.setCursor(position);
			editor.scrollIntoView({ from: position, to: position }, true);
			editor.focus();
			return;
		}

		await this.app.workspace.openLinkText(`#^${blockId}`, file.path, false);
	}

	private createUniqueBlockId(source: string, color: MarkerColor): string {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
			const blockId = buildMarkerBlockId(color, uid);

			if (!source.includes(`^${blockId}`)) {
				return blockId;
			}
		}

		throw new Error('Unable to create a unique reading marker ID.');
	}

	private getActiveEditor(file: TFile): Editor | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (view?.file?.path !== file.path || view.getMode() !== 'source') {
			return null;
		}

		return view.editor;
	}

	private isActiveFile(file: TFile): boolean {
		return this.app.workspace.getActiveFile()?.path === file.path;
	}

	private runUserAction(action: string, operation: () => void): void {
		try {
			operation();
			this.logger.debug(`${action}:complete`);
		} catch (error) {
			this.reportUnexpectedError(action, error);
		}
	}

	private runAsyncUserAction(
		action: string,
		operation: () => Promise<void>,
	): void {
		void operation()
			.then(() => this.logger.debug(`${action}:complete`))
			.catch((error: unknown) => this.reportUnexpectedError(action, error));
	}

	private reportUnexpectedError(action: string, error: unknown): void {
		this.logger.error(action, error);
		new Notice(strings().operationFailed);
	}

	private notifySuccess(message: string): void {
		if (this.getSettings().showSuccessNotices) {
			new Notice(message);
		}
	}
}
