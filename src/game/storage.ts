import type { ConceptId } from '../tutor/concepts'
import type { GameSettings } from './types'

const SETTINGS_KEY = 'ai-chess-tutor:settings'
const CONCEPTS_KEY = 'ai-chess-tutor:concepts'

export const DEFAULT_SETTINGS: GameSettings = { difficulty: 'beginner', mode: 'free', openingId: null }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage – progress just won't persist.
  }
}

export function loadSettings(): GameSettings {
  const settings = read<GameSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
  if (settings.mode === 'opening' && !settings.openingId) settings.openingId = 'italian'
  return settings
}
export const saveSettings = (settings: GameSettings) => write(SETTINGS_KEY, settings)

export type ConceptProgress = Partial<Record<ConceptId, number>>
export const loadConceptProgress = () => read<ConceptProgress>(CONCEPTS_KEY, {})
export const saveConceptProgress = (progress: ConceptProgress) => write(CONCEPTS_KEY, progress)
