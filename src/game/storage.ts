import type { ConceptId } from '../tutor/concepts'
import { MATE_PUZZLES, getPuzzle } from '../puzzles/matePuzzles'
import { reportStorageFailure } from '../storage/errors'
import {
  loadMigratedSettings,
  migrateFromLocalStorage,
  rememberCalculator,
  rememberConcepts,
  rememberSettings,
  rememberSolved,
  type MigratedSettings,
} from '../storage/migrate'
import type { GameSettings } from './types'

const SETTINGS_KEY = 'ai-chess-tutor:settings'
const CONCEPTS_KEY = 'ai-chess-tutor:concepts'
const SOLVED_KEY = 'ai-chess-tutor:solved-puzzles'
const CALCULATOR_KEY = 'ai-chess-tutor:calculator'

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'beginner',
  mode: 'free',
  openingId: null,
  puzzleId: null,
  playerColor: 'w',
}

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
  if (settings.mode !== 'opening' || settings.playerColor !== 'b') settings.playerColor = 'w'
  return settings
}
export const saveSettings = (settings: GameSettings) => {
  write(SETTINGS_KEY, settings)
  mirror(rememberSettings(settings))
}

export type ConceptProgress = Partial<Record<ConceptId, number>>

/** Concept ids are stored as plain strings. Unknown ids are kept so a newer build can still read them. */
export function conceptProgressFrom(value: Record<string, number>): ConceptProgress {
  const progress: ConceptProgress = {}
  for (const [key, count] of Object.entries(value)) progress[key as ConceptId] = count
  return progress
}
export const loadConceptProgress = () => read<ConceptProgress>(CONCEPTS_KEY, {})
export const saveConceptProgress = (progress: ConceptProgress) => {
  write(CONCEPTS_KEY, progress)
  const clean: Record<string, number> = {}
  for (const [key, value] of Object.entries(progress)) {
    if (typeof value === 'number') clean[key] = value
  }
  mirror(rememberConcepts(clean))
}

export function loadSolvedPuzzles(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SOLVED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
export const saveSolvedPuzzles = (ids: string[]) => {
  write(SOLVED_KEY, ids)
  mirror(rememberSolved(ids))
}

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
  mirror(rememberCalculator(enabled))
}

/** Copies the four localStorage keys into IndexedDB, then reads them back. localStorage is never deleted. */
export async function bootstrapStorage(): Promise<MigratedSettings | null> {
  try {
    await migrateFromLocalStorage(localStorage)
    return await loadMigratedSettings()
  } catch (error) {
    reportStorageFailure(error)
    return null
  }
}

function mirror(job: Promise<void>): void {
  void job.catch((error: unknown) => {
    reportStorageFailure(error)
  })
}
