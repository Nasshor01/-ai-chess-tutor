import type { Verbosity } from '../tutor/types'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface DifficultyConfig {
  id: Difficulty
  label: string
  description: string
  /** Stockfish Skill Level (0–20). */
  skill: number
  depth: number
  movetime: number
  /** Chance that the opponent plays a random legal move instead (beginner only). */
  randomMoveChance: number
  verbosity: Verbosity
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  beginner: {
    id: 'beginner',
    label: 'Začátečník',
    description: 'Počítač hraje slabě a dělá chyby. Trenér vysvětluje hodně a podrobně.',
    skill: 0,
    depth: 1,
    movetime: 200,
    randomMoveChance: 0.15,
    verbosity: 'high',
  },
  intermediate: {
    id: 'intermediate',
    label: 'Středně pokročilý',
    description: 'Počítač hraje rozumně, občas chybuje. Trenér komentuje hlavní myšlenky.',
    skill: 6,
    depth: 6,
    movetime: 500,
    randomMoveChance: 0,
    verbosity: 'medium',
  },
  advanced: {
    id: 'advanced',
    label: 'Pokročilý',
    description: 'Počítač hraje naplno. Trenér komentuje stručně a k věci.',
    skill: 16,
    depth: 14,
    movetime: 1200,
    randomMoveChance: 0,
    verbosity: 'low',
  },
}

/** Depth used by the tutor's analysis engine. */
export const ANALYSIS_DEPTH = 13
export const ANALYSIS_MOVETIME = 1800
export const ANALYSIS_MULTIPV = 3
