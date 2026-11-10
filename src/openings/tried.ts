import { readKv, writeKv } from '../storage/kv'

export const TRIED_OPENINGS_KEY = 'ai-chess-tutor:openings-tried'

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
}

/** localStorage answers before IndexedDB, and it remains the fallback. */
export function loadTriedOpenings(): string[] {
  try {
    return parseIds(JSON.parse(localStorage.getItem(TRIED_OPENINGS_KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function saveTriedOpenings(ids: readonly string[]): void {
  try {
    localStorage.setItem(TRIED_OPENINGS_KEY, JSON.stringify(parseIds(ids)))
  } catch {
    // The visit still remembers the opening in memory.
  }
}

export async function hydrateTriedOpenings(): Promise<string[] | null> {
  try {
    const stored = await readKv(TRIED_OPENINGS_KEY)
    if (stored === null) return null
    return parseIds(stored)
  } catch {
    return null
  }
}

export function persistTriedOpenings(ids: readonly string[]): void {
  const next = parseIds(ids)
  saveTriedOpenings(next)
  void writeKv(TRIED_OPENINGS_KEY, next).catch(() => undefined)
}

export function markTriedOpening(id: string): string[] {
  const next = parseIds([...loadTriedOpenings(), id])
  persistTriedOpenings(next)
  return next
}
