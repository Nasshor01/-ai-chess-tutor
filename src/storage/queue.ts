let tail: Promise<unknown> = Promise.resolve()
let pending = 0

/** Drops a write left hanging when a test clears timers before IndexedDB finishes. */
export function resetQueue(): void {
  tail = Promise.resolve()
  pending = 0
}

export function queueDepth(): number {
  return pending
}

/** Runs IndexedDB work one after another so a save cannot land in the middle of migration. */
export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  pending += 1
  const run = tail.then(job, job)
  tail = run.then(
    () => {
      pending -= 1
    },
    () => {
      pending -= 1
    },
  )
  return run
}
