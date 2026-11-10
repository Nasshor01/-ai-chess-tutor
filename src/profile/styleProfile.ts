import { Chess } from 'chess.js'
import { parseUci } from '../chess/utils'

export interface StyleGame {
  updatedAt: number
  moves: Array<{ fenBefore: string; uci: string; byUser: boolean }>
}

export interface StyleMetric {
  id: 'develop' | 'castle' | 'center' | 'capture' | 'check'
  label: string
  /** Share of the player's moves, or of games for castling. Null below the minimum sample. */
  value: number | null
  samples: number
  explain: string
}

export interface StyleProfile {
  metrics: StyleMetric[]
  /** Sum of the recency weights of the games that had a user move. */
  weight: number
}

const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])
const MIN_MOVES = 20
const MIN_GAMES = 8

/**
 * The same events the calculator counts in one game, here across many games.
 * A newer game weighs more: half the weight every 30 days.
 * The value is a real share, 0–100. It is null when the sample is too small.
 */
export function styleProfile(games: StyleGame[], now: number): StyleProfile {
  let moveWeight = 0
  let moveSamples = 0
  let gameWeight = 0
  let gameSamples = 0
  let castleWeight = 0
  const totals = { develop: 0, center: 0, capture: 0, check: 0 }

  for (const game of games) {
    const weight = recency(game.updatedAt, now)
    let userMoves = 0
    let castled = false
    for (const record of game.moves) {
      if (!record.byUser) continue
      const move = play(record.fenBefore, record.uci)
      if (!move) continue
      userMoves += 1
      moveWeight += weight
      if (move.piece === 'n' || move.piece === 'b') totals.develop += weight
      if (move.piece === 'p' && CENTER.has(move.to)) totals.center += weight
      if (move.captured) totals.capture += weight
      if (move.san.includes('+') || move.san.includes('#')) totals.check += weight
      if (move.isKingsideCastle() || move.isQueensideCastle()) castled = true
    }
    if (userMoves > 0) {
      gameSamples += 1
      gameWeight += weight
      moveSamples += userMoves
      if (castled) castleWeight += weight
    }
  }

  const share = (part: number) => (moveSamples < MIN_MOVES || moveWeight === 0 ? null : Math.round((100 * part) / moveWeight))
  return {
    weight: Math.round(gameWeight * 10) / 10,
    metrics: [
      { id: 'develop', label: 'Vývin figur', value: share(totals.develop), samples: moveSamples, explain: 'Podíl tvých tahů, kterými táhla jezdcem nebo střelcem.' },
      {
        id: 'castle',
        label: 'Rošáda',
        value: gameSamples < MIN_GAMES || gameWeight === 0 ? null : Math.round((100 * castleWeight) / gameWeight),
        samples: gameSamples,
        explain: 'Podíl partií, ve kterých jsi udělal rošádu. Počítá se až od osmi partií.',
      },
      { id: 'center', label: 'Střed pěšci', value: share(totals.center), samples: moveSamples, explain: 'Podíl tvých tahů, které postavily pěšce na d4, e4, d5 nebo e5.' },
      { id: 'capture', label: 'Braní', value: share(totals.capture), samples: moveSamples, explain: 'Podíl tvých tahů, které něco sebraly.' },
      { id: 'check', label: 'Šach', value: share(totals.check), samples: moveSamples, explain: 'Podíl tvých tahů, které daly šach.' },
    ],
  }
}

function recency(updatedAt: number, now: number): number {
  const days = Math.max(0, (now - updatedAt) / 86_400_000)
  return 0.5 ** (days / 30)
}

function play(fen: string, uci: string) {
  try {
    const chess = new Chess(fen)
    return chess.move(parseUci(uci))
  } catch {
    return null
  }
}

export function profileSnapshot(profile: StyleProfile, createdAt: number): { id: string; createdAt: number; payload: string } {
  return { id: `style_${createdAt}`, createdAt, payload: JSON.stringify(profile) }
}
