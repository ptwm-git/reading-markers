/** Serializes disk writes and applies every mutation to the last successful state. */
export class DataStore<T> {
	private queue: Promise<void> = Promise.resolve();

	constructor(public value: T, private readonly persist: (value: T) => Promise<void>) {}

	update(mutate: (value: T) => T): Promise<void> {
		const operation = this.queue.then(async () => {
			const next = mutate(this.value);
			if (next === this.value) return;
			await this.persist(next);
			this.value = next;
		});
		this.queue = operation.catch(() => undefined);
		return operation;
	}
}
