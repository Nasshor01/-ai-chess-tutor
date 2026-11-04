import type { ConceptId } from '../tutor/concepts'
import { MATE_PUZZLES, getPuzzle } from '../puzzles/matePuzzles'
import type { GameSettings } from './types'

const SETTINGS_KEY = 'ai-chess-tutor:settings'
const CONCEPTS_KEY = 'ai-chess-tutor:concepts'
const SOLVED_KEY = 'ai-chess-tutor:solved-puzzles'
const CALCULATOR_KEY = 'ai-chess-tutor:calculator'

export const DEFAULT_SETTINGS: GameSettings = { difficulty: 'beginner', mode: 'free', openingId: null, puzzleId: null }

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
  if (settings.mode === 'mate' && !getPuzzle(settings.puzzleId)) settings.puzzleId = MATE_PUZZLES[0].id
  return settings
}
export const saveSettings = (settings: GameSettings) => write(SETTINGS_KEY, settings)

export type ConceptProgress = Partial<Record<ConceptId, number>>
export const loadConceptProgress = () => read<ConceptProgress>(CONCEPTS_KEY, {})
export const saveConceptProgress = (progress: ConceptProgress) => write(CONCEPTS_KEY, progress)

export function loadSolvedPuzzles(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SOLVED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
export const saveSolvedPuzzles = (ids: string[]) => write(SOLVED_KEY, ids)

export function loadCalculatorEnabled(): boolean {
  try {
    return localStorage.getItem(CALCULATOR_KEY) === '1'
  } catch {
    return false
  }
}
export function saveCalculatorEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CALCULATOR_KEY, enabled ? '1' : '0')
  } catch {
    // Not persisted.
  }
}
