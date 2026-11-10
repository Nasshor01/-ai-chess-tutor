/** Four cores or fewer share one worker. The game search cancels background analysis. */
export function preferSharedEngine(cores: number | undefined): boolean {
  return typeof cores === 'number' && cores > 0 && cores <= 4
}

export function coreCount(): number | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.hardwareConcurrency
}

/**
 * On four cores or fewer the game and the analyst share one worker.
 * The opponent cancels background analysis and searches immediately.
 * It never waits for the analysis queue to go idle.
 */
export function beginSharedOpponentTurn(
  shared: boolean,
  cancelAnalysis: () => void,
  markBusy: (active: boolean) => void,
): { waitsForAnalysis: false } {
  if (shared) {
    cancelAnalysis()
    markBusy(true)
  }
  return { waitsForAnalysis: false }
}
