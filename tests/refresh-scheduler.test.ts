import assert from 'node:assert/strict';
import test from 'node:test';
import { RefreshScheduler, SchedulerClock } from '../src/refresh-scheduler';

class FakeClock implements SchedulerClock<number> {
	private nextHandle = 1;
	private readonly tasks = new Map<number, () => void>();
	readonly delays: number[] = [];

	schedule(task: () => void, delayMs: number): number {
		const handle = this.nextHandle;
		this.nextHandle += 1;
		this.tasks.set(handle, task);
		this.delays.push(delayMs);
		return handle;
	}

	cancel(handle: number): void {
		this.tasks.delete(handle);
	}

	runAll(): void {
		const tasks = Array.from(this.tasks.values());
		this.tasks.clear();
		tasks.forEach((task) => task());
	}

	get pendingCount(): number {
		return this.tasks.size;
	}
}

void test('multiple requests collapse into the latest refresh', () => {
	const clock = new FakeClock();
	const scheduler = new RefreshScheduler(120, clock);
	const completed: string[] = [];

	scheduler.request(() => completed.push('first'));
	scheduler.request(() => completed.push('second'));
	scheduler.request(() => completed.push('latest'));

	assert.equal(clock.pendingCount, 1);
	assert.deepEqual(clock.delays, [120, 120, 120]);
	clock.runAll();
	assert.deepEqual(completed, ['latest']);
});

void test('cancel prevents a pending refresh from running', () => {
	const clock = new FakeClock();
	const scheduler = new RefreshScheduler(120, clock);
	let completed = false;

	scheduler.request(() => {
		completed = true;
	});
	scheduler.cancel();
	clock.runAll();

	assert.equal(completed, false);
	assert.equal(clock.pendingCount, 0);
});
