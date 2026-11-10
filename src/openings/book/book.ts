import { Chess } from 'chess.js'

/** One row of the generated Lichess table. */
export interface OpeningRecord {
  eco: string
  name: string
  pgn: string
  epd: string
}

export interface CatalogEntry {
  id: string
  eco: string
  name: string
  epd: string
  plies: number
}

export interface Continuation {
  uci: string
  san: string
  resultingName: string | null
  eco: string | null
  variationsBelow: number
}

export interface LineStep {
  uci: string
  san: string
}

export type EcoGroupId = 'A' | 'B' | 'C' | 'D' | 'E'

export const ECO_GROUPS: readonly { id: EcoGroupId; label: string; description: string }[] = [
  { id: 'A', label: 'A · flankové', description: 'Anglická, Réti a další zahájení, která nezačínají tahem 1. e4 ani 1. d4.' },
  { id: 'B', label: 'B · polootevřené', description: 'Sicilská a další obrany proti 1. e4, ve kterých černý nehraje 1… e5.' },
  { id: 'C', label: 'C · otevřené a Francouzská', description: 'Otevřené hry po 1. e4 e5 a Francouzská obrana.' },
  { id: 'D', label: 'D · uzavřené a dámské', description: 'Dámský gambit a uzavřené hry po 1. d4 d5.' },
  { id: 'E', label: 'E · indické', description: 'Indické obrany po 1. d4 Nf6.' },
]

/** FEN without the half-move and full-move counters. Matches the generated epd field. */
export function positionKey(fen: string): string {
  const parts = fen.trim().split(/\s+/)
  return `${parts[0] ?? ''} ${parts[1] ?? 'w'} ${parts[2] ?? '-'} ${parts[3] ?? '-'}`
}

export function playableFen(fen: string): string {
  const parts = fen.trim().split(/\s+/)
  if (parts.length >= 6) return fen.trim()
  return `${positionKey(fen)} 0 1`
}

const ALIASES: readonly (readonly [string, string])[] = [
  ['sicilska', 'sicilian'],
  ['najdorf', 'najdorf'],
  ['kings indian', "king's indian"],
  ['kralovska indicka', "king's indian"],
  ['italska', 'italian'],
  ['spanelska', 'ruy lopez'],
  ['francouzska', 'french'],
  ['damsky gambit', "queen's gambit"],
  ['londynsky', 'london'],
  ['londyn', 'london'],
  ['caro kann', 'caro-kann'],
]

export function foldOpeningText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

interface Node {
  ownName: string | null
  ownEco: string | null
  ownPly: number
  bestName: string | null
  bestEco: string | null
  bestPly: number
  children: Map<string, { uci: string; san: string; epd: string }>
  endingIds: number[]
  variations: number
  list?: number[]
}

export interface Book {
  entries: CatalogEntry[]
}

interface BuiltBook extends Book {
  nodes: Map<string, Node>
  lines: Map<string, LineStep[]>
  start: string
}

function emptyNode(): Node {
  return {
    ownName: null,
    ownEco: null,
    ownPly: -1,
    bestName: null,
    bestEco: null,
    bestPly: -1,
    children: new Map(),
    endingIds: [],
    variations: 0,
  }
}

function openingId(eco: string, name: string): string {
  return `${eco}:${name}`
}

function uciOf(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

function uniqueNumbers(values: number[], width: number): number[] {
  const seen = new Uint8Array(width)
  const out: number[] = []
  for (const value of values) {
    if (seen[value]) continue
    seen[value] = 1
    out.push(value)
  }
  return out
}

/** Builds the transposition tree. Records that reach one position share a node. */
export function buildBook(records: readonly OpeningRecord[]): Book {
  const nodes = new Map<string, Node>()
  const startChess = new Chess()
  const start = positionKey(startChess.fen())
  nodes.set(start, emptyNode())
  const lines = new Map<string, LineStep[]>()
  const entries = new Map<string, CatalogEntry>()
  const idNumber = new Map<string, number>()

  const intern = (id: string): number => {
    const existing = idNumber.get(id)
    if (existing !== undefined) return existing
    const next = idNumber.size
    idNumber.set(id, next)
    return next
  }

  for (const record of records) {
    const replay = new Chess()
    const pgn = record.pgn.trim()
    if (pgn !== '' && pgn !== '*') replay.loadPgn(pgn)
    const history = replay.history({ verbose: true })
    const id = openingId(record.eco, record.name)
    let node = nodes.get(start) ?? emptyNode()
    const steps: LineStep[] = []
    for (const move of history) {
      const uci = uciOf(move)
      const epd = positionKey(move.after)
      if (!node.children.has(uci)) node.children.set(uci, { uci, san: move.san, epd })
      let child = nodes.get(epd)
      if (!child) {
        child = emptyNode()
        nodes.set(epd, child)
      }
      steps.push({ uci, san: move.san })
      node = child
    }
    const ply = history.length
    if (ply > node.ownPly) {
      node.ownName = record.name
      node.ownEco = record.eco
      node.ownPly = ply
    }
    const number = intern(id)
    if (!node.endingIds.includes(number)) node.endingIds.push(number)
    const previous = lines.get(id)
    if (!previous || steps.length < previous.length) {
      lines.set(id, steps)
      entries.set(id, { id, eco: record.eco, name: record.name, epd: positionKey(replay.fen()), plies: steps.length })
    }
  }

  for (const node of nodes.values()) {
    if (node.ownPly > node.bestPly && node.ownName) {
      node.bestName = node.ownName
      node.bestEco = node.ownEco
      node.bestPly = node.ownPly
    }
  }
  const pending = [...nodes.keys()]
  for (let index = 0; index < pending.length; index += 1) {
    const node = nodes.get(pending[index] ?? '')
    if (!node?.bestName) continue
    for (const child of node.children.values()) {
      const next = nodes.get(child.epd)
      if (!next || node.bestPly <= next.bestPly) continue
      next.bestName = node.bestName
      next.bestEco = node.bestEco
      next.bestPly = node.bestPly
      pending.push(child.epd)
    }
  }

  const stack = new Set<string>()
  const collect = (epd: string): number[] => {
    const node = nodes.get(epd)
    if (!node) return []
    if (node.list) return node.list
    if (stack.has(epd)) return node.endingIds
    stack.add(epd)
    const combined = [...node.endingIds]
    for (const child of node.children.values()) combined.push(...collect(child.epd))
    stack.delete(epd)
    const list = uniqueNumbers(combined, idNumber.size)
    node.variations = list.length
    node.list = list
    return list
  }
  collect(start)
  for (const node of nodes.values()) node.list = undefined

  const book: BuiltBook = { entries: [...entries.values()], nodes, lines, start }
  return book
}

function asBuilt(book: Book): BuiltBook {
  return book as BuiltBook
}

export function hasPosition(book: Book, fen: string): boolean {
  return asBuilt(book).nodes.has(positionKey(fen))
}

/** Deepest named opening reached by this position. A longer line wins on a shared square. */
export function nameForPosition(book: Book, fen: string): string | null {
  return asBuilt(book).nodes.get(positionKey(fen))?.bestName ?? null
}

export function ecoForPosition(book: Book, fen: string): string | null {
  return asBuilt(book).nodes.get(positionKey(fen))?.bestEco ?? null
}

/** Book moves from this position. Only moves chess.js accepts are returned. */
export function continuations(book: Book, fen: string): Continuation[] {
  const node = asBuilt(book).nodes.get(positionKey(fen))
  if (!node || node.children.size === 0) return []
  let legal: Set<string>
  try {
    const chess = new Chess(playableFen(fen))
    legal = new Set(chess.moves({ verbose: true }).map((move) => uciOf(move)))
  } catch {
    return []
  }
  const nodes = asBuilt(book).nodes
  const found: Continuation[] = []
  for (const child of node.children.values()) {
    if (!legal.has(child.uci)) continue
    const next = nodes.get(child.epd)
    found.push({
      uci: child.uci,
      san: child.san,
      resultingName: next?.bestName ?? null,
      eco: next?.bestEco ?? null,
      variationsBelow: next?.variations ?? 0,
    })
  }
  found.sort((a, b) => b.variationsBelow - a.variationsBelow || a.san.localeCompare(b.san))
  return found
}

export function lineTo(book: Book, openingId: string): LineStep[] | null {
  return asBuilt(book).lines.get(openingId) ?? null
}

export function searchOpenings(book: Book, query: string, group: EcoGroupId | null): CatalogEntry[] {
  const folded = foldOpeningText(query).trim()
  const extra = ALIASES.filter(([key]) => folded.length > 0 && (folded === key || folded.includes(key))).map(([, target]) => target)
  const hits = book.entries.filter((entry) => {
    if (group && !entry.eco.startsWith(group)) return false
    if (!folded) return true
    const name = foldOpeningText(entry.name)
    if (name.includes(folded)) return true
    return extra.some((target) => name.includes(target))
  })
  hits.sort((a, b) => a.name.localeCompare(b.name) || a.eco.localeCompare(b.eco))
  return hits.slice(0, 40)
}

/** Random catalog line for a color. Unplayed ids are used first. */
export function surpriseOpening(
  book: Book,
  color: 'w' | 'b',
  avoid: ReadonlySet<string>,
  random: () => number = Math.random,
): CatalogEntry | null {
  const eligible = book.entries.filter((entry) => (color === 'w' ? true : entry.plies >= 2))
  if (eligible.length === 0) return null
  const fresh = eligible.filter((entry) => !avoid.has(entry.id))
  const pool = fresh.length > 0 ? fresh : eligible
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
  return pool[index] ?? null
}

export interface PlayedGame {
  userColor: 'w' | 'b' | 'both'
  result: string
  startFen: string
  uci: readonly string[]
}

export interface MoveStat {
  played: number
  wins: number
  draws: number
  losses: number
}

function outcomeFor(userColor: PlayedGame['userColor'], mover: 'w' | 'b', result: string): 'win' | 'draw' | 'loss' | null {
  if (result === '1/2-1/2' || result === '1/2') return 'draw'
  if (result !== '1-0' && result !== '0-1') return null
  const side = userColor === 'both' ? mover : userColor
  const whiteWon = result === '1-0'
  return (side === 'w') === whiteWon ? 'win' : 'loss'
}

/** How often the user played each book move from this position in saved games. */
export function continuationStats(games: readonly PlayedGame[], fen: string, ucis: readonly string[]): Map<string, MoveStat> {
  const wanted = new Set(ucis)
  const stats = new Map<string, MoveStat>()
  for (const uci of ucis) stats.set(uci, { played: 0, wins: 0, draws: 0, losses: 0 })
  const target = positionKey(fen)
  for (const game of games) {
    let chess: Chess
    try {
      chess = new Chess(playableFen(game.startFen))
    } catch {
      continue
    }
    for (const uci of game.uci) {
      if (positionKey(chess.fen()) === target && wanted.has(uci)) {
        const mover = chess.turn()
        const userPlayed = game.userColor === 'both' || game.userColor === mover
        if (userPlayed) {
          const stat = stats.get(uci)
          if (stat) {
            stat.played += 1
            const outcome = outcomeFor(game.userColor, mover, game.result)
            if (outcome === 'win') stat.wins += 1
            else if (outcome === 'draw') stat.draws += 1
            else if (outcome === 'loss') stat.losses += 1
          }
        }
      }
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined })
      } catch {
        break
      }
    }
  }
  return stats
}

/** Openings whose final position appears in a saved game. */
export function playedOpeningIds(book: Book, games: readonly PlayedGame[]): Set<string> {
  const byPosition = new Map<string, string[]>()
  for (const entry of book.entries) {
    const ids = byPosition.get(entry.epd) ?? []
    ids.push(entry.id)
    byPosition.set(entry.epd, ids)
  }
  const played = new Set<string>()
  for (const game of games) {
    let chess: Chess
    try {
      chess = new Chess(playableFen(game.startFen))
    } catch {
      continue
    }
    const mark = () => {
      const ids = byPosition.get(positionKey(chess.fen()))
      if (ids) for (const id of ids) played.add(id)
    }
    mark()
    for (const uci of game.uci) {
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined })
      } catch {
        break
      }
      mark()
    }
  }
  return played
}

export function toPlayedGames(
  games: readonly { id: string; userColor: 'w' | 'b' | 'both'; result: string; startFen: string }[],
  moves: readonly { gameId: string; ply: number; uci: string }[],
): PlayedGame[] {
  const byGame = new Map<string, { ply: number; uci: string }[]>()
  for (const move of moves) {
    const list = byGame.get(move.gameId) ?? []
    list.push({ ply: move.ply, uci: move.uci })
    byGame.set(move.gameId, list)
  }
  return games.map((game) => ({
    userColor: game.userColor,
    result: game.result,
    startFen: game.startFen,
    uci: (byGame.get(game.id) ?? []).sort((a, b) => a.ply - b.ply).map((move) => move.uci),
  }))
}

function czechCount(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `1 ${one}`
  if (count >= 2 && count <= 4) return `${count} ${few}`
  return `${count} ${many}`
}

/** Wording for a continuation. Zero games is explicit, never a made-up count. */
export function describeMoveStat(stat: MoveStat | undefined): { label: string; fresh: boolean } {
  if (!stat || stat.played === 0) return { label: 'zatím nehráno', fresh: true }
  const unfinished = stat.played - stat.wins - stat.draws - stat.losses
  const parts = [
    czechCount(stat.wins, 'výhra', 'výhry', 'výher'),
    czechCount(stat.draws, 'remíza', 'remízy', 'remíz'),
    czechCount(stat.losses, 'prohra', 'prohry', 'proher'),
  ]
  if (unfinished > 0) parts.push(czechCount(unfinished, 'nedohraná', 'nedohrané', 'nedohraných'))
  return { label: `${stat.played}× · ${parts.join(', ')}`, fresh: false }
}
