import { readKv, writeKv } from '../storage/kv'

export const SHOW_ALL_ARROWS_KEY = 'ai-chess-tutor:calculator-all-arrows'

/** localStorage is the value used before IndexedDB answers, and the fallback when it cannot. */
export function loadShowAllArrows(): boolean {
  try {
    return localStorage.getItem(SHOW_ALL_ARROWS_KEY) === '1'
  } catch {
    return false
  }
}

export function saveShowAllArrows(value: boolean): void {
  try {
    localStorage.setItem(SHOW_ALL_ARROWS_KEY, value ? '1' : '0')
  } catch {
    // The switch still works for this visit.
  }
}

/** IndexedDB wins when it has a saved choice. Null means nothing was stored there. */
export async function hydrateShowAllArrows(): Promise<boolean | null> {
  try {
    const stored = await readKv(SHOW_ALL_ARROWS_KEY)
    if (stored === true || stored === false) return stored
    return null
  } catch {
    return null
  }
}

export function persistShowAllArrows(value: boolean): void {
  saveShowAllArrows(value)
  void writeKv(SHOW_ALL_ARROWS_KEY, value).catch(() => undefined)
}
