import { freshSchedule } from './sm2'

export interface SourceMove {
  gameId: string
  ply: number
  fenBefore: string
  uci: string
  san: string
  byUser: boolean
  category?: string | null
  bestUci?: string | null
}

export interface TrainingCard {
  id: string
  gameId: string
  ply: number
  fen: string
  playedSan: string
  solutionUci: string
  theme: string
  repetition: number
  intervalDays: number
  ease: number
  dueAt: number
  createdAt: number
  lapses: number
}

const MISTAKE = new Set(['mistake', 'blunder'])

/**
 * A card exists only for a real user move that analysis called a mistake or a blunder,
 * and only when that theme happened at least twice. The position is the one the user had.
 */
export function cardsFromMoves(moves: SourceMove[], now: number): TrainingCard[] {
  const mistakes = moves.filter((move) => {
    if (!move.byUser || !move.bestUci || move.bestUci === move.uci) return false
    return MISTAKE.has(qualityOf(move.category))
  })
  const counts = new Map<string, number>()
  for (const move of mistakes) {
    const theme = themeOf(move.category)
    counts.set(theme, (counts.get(theme) ?? 0) + 1)
  }
  return mistakes
    .filter((move) => (counts.get(themeOf(move.category)) ?? 0) >= 2)
    .map((move) => {
      const schedule = freshSchedule(now)
      return {
        id: `train_${move.gameId}_${move.ply}`,
        gameId: move.gameId,
        ply: move.ply,
        fen: move.fenBefore,
        playedSan: move.san,
        solutionUci: move.bestUci ?? '',
        theme: themeOf(move.category),
        createdAt: now,
        lapses: 0,
        ...schedule,
      }
    })
}

/** Keeps the review schedule of a card the player has already seen. */
export function mergeCards(existing: TrainingCard[], fresh: TrainingCard[]): TrainingCard[] {
  const previous = new Map(existing.map((card) => [card.id, card]))
  const seen = new Set<string>()
  const merged = fresh.map((card) => {
    seen.add(card.id)
    const prior = previous.get(card.id)
    if (!prior) return card
    return {
      ...card,
      repetition: prior.repetition,
      intervalDays: prior.intervalDays,
      ease: prior.ease,
      dueAt: prior.dueAt,
      createdAt: prior.createdAt,
      lapses: prior.lapses,
    }
  })
  for (const card of existing) {
    if (!seen.has(card.id)) merged.push(card)
  }
  return merged
}

export function dueCards(cards: TrainingCard[], now: number): TrainingCard[] {
  return cards.filter((card) => card.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt || a.ply - b.ply)
}

export function themeOf(category: string | null | undefined): string {
  const motif = category?.split('|').slice(1).find((part) => part.length > 0)
  return motif ?? qualityOf(category) ?? 'chyba'
}

function qualityOf(category: string | null | undefined): string {
  return category?.split('|')[0] ?? ''
}
