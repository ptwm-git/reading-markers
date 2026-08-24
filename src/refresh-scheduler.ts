export interface SchedulerClock<Handle> {
	schedule(task: () => void, delayMs: number): Handle;
	cancel(handle: Handle): void;
}

const DEFAULT_CLOCK: SchedulerClock<number> = {
	schedule: (task, delayMs) => window.setTimeout(task, delayMs),
	cancel: (handle) => window.clearTimeout(handle),
};

export class RefreshScheduler<Handle = number> {
	private handle: Handle | null = null;
	private pendingTask: (() => void) | null = null;

	constructor(
		private readonly delayMs: number,
		private readonly clock: SchedulerClock<Handle> =
			DEFAULT_CLOCK as SchedulerClock<Handle>,
	) {}

	request(task: () => void): void {
		this.pendingTask = task;

		if (this.handle !== null) {
			this.clock.cancel(this.handle);
		}

		this.handle = this.clock.schedule(() => {
			this.handle = null;
			const latestTask = this.pendingTask;
			this.pendingTask = null;
			latestTask?.();
		}, this.delayMs);
	}

	cancel(): void {
		if (this.handle !== null) {
			this.clock.cancel(this.handle);
		}

		this.handle = null;
		this.pendingTask = null;
	}
}
