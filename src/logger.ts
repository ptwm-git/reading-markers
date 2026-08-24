export interface LogSink {
	debug(message: string, details?: unknown): void;
	error(message: string, error?: unknown): void;
}

export class PluginLogger {
	constructor(
		private readonly isDebugEnabled: () => boolean,
		private readonly sink: LogSink = console,
	) {}

	debug(action: string, details?: unknown): void {
		if (!this.isDebugEnabled()) {
			return;
		}

		this.sink.debug(this.format(action), details);
	}

	error(action: string, error: unknown): void {
		this.sink.error(this.format(action), error);
	}

	async guardBackground(
		action: string,
		operation: () => Promise<void>,
	): Promise<void> {
		try {
			await operation();
		} catch (error) {
			this.error(action, error);
		}
	}

	private format(action: string): string {
		return `[Reading Markers] ${action}`;
	}
}
