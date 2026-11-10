let depth = 0

/** The live game sets this while it is searching, so background analysis waits. */
export function markGameSearch(active: boolean): void {
  depth = Math.max(0, depth + (active ? 1 : -1))
}

export function gameSearchBusy(): boolean {
  return depth > 0
}

export function resetGameSearch(): void {
  depth = 0
}
