let tail: Promise<unknown> = Promise.resolve()

/** Runs IndexedDB work one after another so a save cannot land in the middle of migration. */
export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job)
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
