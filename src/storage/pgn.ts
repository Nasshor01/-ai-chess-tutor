import { Chess, DEFAULT_POSITION, type Square } from 'chess.js'
import { importDedupKey, insertImported, newGameId } from './games'
import type { Game, GameHeaders, GameResult, MoveRecord, UserColor } from './types'

export interface PgnIdentity {
  color: UserColor
  name?: string
}

export interface PgnExportInput {
  startFen: string
  uci: readonly string[]
  event: string
  site: string
  date: string
  white: string
  black: string
  result: GameResult
}

export interface ImportReport {
  imported: number
  duplicates: number
  skipped: Array<{ index: number; reason: string }>
  variationsDropped: boolean
  error?: string
}

const STANDARD_TAGS = new Set(['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'SetUp', 'FEN'])

export function pgnDate(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}.${month}.${day}`
}

export function exportPgn(input: PgnExportInput): string {
  const chess = new Chess()
  if (input.startFen !== DEFAULT_POSITION) chess.load(input.startFen)
  for (const uci of input.uci) playUci(chess, uci)
  chess.setHeader('Event', input.event)
  chess.setHeader('Site', input.site)
  chess.setHeader('Date', input.date)
  chess.setHeader('Round', '-')
  chess.setHeader('White', input.white)
  chess.setHeader('Black', input.black)
  chess.setHeader('Result', input.result)
  return chess.pgn()
}

export function splitPgnGames(source: string): string[] {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!text) return []
  const games: string[] = []
  let start = 0
  let braces = 0
  let lineComment = false
  let seenMove = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? ''
    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (braces > 0) {
      if (ch === '{') braces += 1
      else if (ch === '}') braces -= 1
      continue
    }
    if (ch === '{') {
      braces = 1
      continue
    }
    if (ch === ';') {
      lineComment = true
      continue
    }
    const atLineStart = i === 0 || text[i - 1] === '\n'
    if (ch === '[' && atLineStart) {
      if (seenMove) {
        const game = text.slice(start, i).trim()
        if (game) games.push(game)
        start = i
        seenMove = false
      }
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }
    if (/[0-9a-z]/i.test(ch)) seenMove = true
  }
  const last = text.slice(start).trim()
  if (last) games.push(last)
  return games
}

export async function importPgnText(
  source: string,
  identity: PgnIdentity,
  options?: { yieldEvery?: number; yieldNow?: () => Promise<void> },
): Promise<ImportReport> {
  if (source.includes('\uFFFD')) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: [],
      variationsDropped: false,
      error: 'Soubor není v kódování UTF-8.',
    }
  }
  const games = splitPgnGames(source)
  const yieldEvery = options?.yieldEvery ?? 20
  const yieldNow = options?.yieldNow ?? (() => new Promise((resolve) => setTimeout(resolve, 0)))
  const report: ImportReport = { imported: 0, duplicates: 0, skipped: [], variationsDropped: false }
  for (let index = 0; index < games.length; index += 1) {
    const text = games[index] ?? ''
    if (hasVariation(text)) report.variationsDropped = true
    try {
      const parsed = readGame(text, identity)
      if (!parsed) report.skipped.push({ index: index + 1, reason: 'Prázdná partie' })
      else if ((await insertImported(parsed.game, parsed.moves)) === 'duplicate') report.duplicates += 1
      else report.imported += 1
    } catch (error) {
      report.skipped.push({ index: index + 1, reason: reasonFor(error) })
    }
    if ((index + 1) % yieldEvery === 0) await yieldNow()
  }
  return report
}

function readGame(text: string, identity: PgnIdentity): { game: Game; moves: MoveRecord[] } | null {
  const chess = new Chess()
  chess.loadPgn(text)
  const verbose = chess.history({ verbose: true })
  if (verbose.length === 0) return null
  const rawHeaders = chess.getHeaders()
  const headers = toHeaders(rawHeaders)
  const startFen = headers.FEN && headers.FEN !== '?' ? headers.FEN : DEFAULT_POSITION
  const result = asResult(headers.Result)
  const userColor = resolveColor(headers, identity)
  const uci = verbose.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
  const id = newGameId()
  const now = Date.now()
  const game: Game = {
    id,
    pgn: chess.pgn(),
    result,
    userColor,
    source: 'import',
    createdAt: now,
    updatedAt: now,
    status: result === '*' ? 'in-progress' : 'finished',
    headers,
    startFen,
    dedupKey: importDedupKey({
      startFen,
      uci,
      white: headers.White,
      black: headers.Black,
      date: headers.Date,
      result,
    }),
    plyCount: uci.length,
  }
  const moves: MoveRecord[] = verbose.map((move, ply) => ({
    gameId: id,
    ply,
    fenBefore: move.before,
    uci: uci[ply] ?? '',
    san: move.san,
    byUser: userColor === 'both' || move.color === userColor,
  }))
  return { game, moves }
}

function toHeaders(raw: Record<string, string>): GameHeaders {
  const extra: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!STANDARD_TAGS.has(key) && value) extra[key] = value
  }
  const headers: GameHeaders = {
    Event: raw.Event || '?',
    Site: raw.Site || '?',
    Date: raw.Date || '????.??.??',
    White: raw.White || '?',
    Black: raw.Black || '?',
    Result: raw.Result || '*',
  }
  if (raw.Round && raw.Round !== '?') headers.Round = raw.Round
  if (raw.SetUp) headers.SetUp = raw.SetUp
  if (raw.FEN) headers.FEN = raw.FEN
  if (Object.keys(extra).length > 0) headers.extra = extra
  return headers
}

function resolveColor(headers: GameHeaders, identity: PgnIdentity): UserColor {
  const name = identity.name?.trim().toLowerCase()
  if (!name) return identity.color
  const white = headers.White.trim().toLowerCase() === name
  const black = headers.Black.trim().toLowerCase() === name
  if (white && black) return 'both'
  if (white) return 'w'
  if (black) return 'b'
  return identity.color
}

function asResult(value: string): GameResult {
  if (value === '1-0' || value === '0-1' || value === '1/2-1/2' || value === '*') return value
  return '*'
}

function playUci(chess: Chess, uci: string): void {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.slice(4)
  if (!isSquare(from) || !isSquare(to)) throw new Error(`Neplatný tah ${uci}`)
  const played = chess.move({
    from,
    to,
    promotion: isPromotion(promotion) ? promotion : undefined,
  })
  if (!played) throw new Error(`Neplatný tah ${uci}`)
}

function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value)
}

function isPromotion(value: string): value is 'n' | 'b' | 'r' | 'q' {
  return value === 'n' || value === 'b' || value === 'r' || value === 'q'
}

function hasVariation(pgn: string): boolean {
  let braces = 0
  let lineComment = false
  for (const ch of pgn) {
    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (braces > 0) {
      if (ch === '{') braces += 1
      else if (ch === '}') braces -= 1
      continue
    }
    if (ch === '{') {
      braces = 1
      continue
    }
    if (ch === ';') {
      lineComment = true
      continue
    }
    if (ch === '(') return true
  }
  return false
}

function reasonFor(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/Invalid move|Neplatný tah/i.test(message)) return 'Nelegální tah'
  return 'Partii nejde přečíst'
}
