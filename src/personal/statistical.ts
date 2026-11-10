import { Chess, type Move } from 'chess.js'
import { applyUci, toUci } from '../chess/utils'
import type { StyleProfile } from '../profile/styleProfile'
import { isWeakProfile, resolveMode } from './modes'
import { personalStrength } from './strength'
import type { PersonalCandidate, PersonalHistory, PersonalInput, PersonalLine, PersonalMoveResult } from './types'

const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])

interface Row {
  uci: string
  san: string
  logit: number
  reasons: string[]
}

/**
 * Weights Stockfish MultiPV lines by the eval, the style profile, similar positions
 * and the player's recorded mistakes. A weak profile keeps only a flattened eval.
 */
export function chooseStatistical(input: PersonalInput): PersonalMoveResult {
  const resolved = resolveMode(input)
  if (!resolved.available) {
    return {
      mode: input.mode,
      available: false,
      unavailableReason: resolved.unavailableReason,
      weakModel: true,
      notice: resolved.unavailableReason,
      candidates: [],
      played: null,
    }
  }

  const weak = resolved.weakModel || isWeakProfile(resolved.profile)
  const temperature = weak ? Math.max(personalStrength(input.strength).temperature, 1.8) : personalStrength(input.strength).temperature
  const rows = rowsFrom(input.fen, input.lines, resolved.profile, input.history, temperature, weak)
  const candidates = toProbabilities(rows)
  return {
    mode: input.mode,
    available: true,
    unavailableReason: null,
    weakModel: weak,
    notice: resolved.notice,
    candidates,
    played: pick(candidates, input.rng ?? Math.random),
  }
}

function rowsFrom(
  fen: string,
  lines: PersonalLine[],
  profile: StyleProfile | null,
  history: PersonalHistory[],
  temperature: number,
  weak: boolean,
): Row[] {
  const prepared = uniqueLegal(fen, lines)
  const pool = prepared.length > 0 ? prepared : allLegal(fen)
  const best = pool.reduce((max, row) => Math.max(max, row.cp), Number.NEGATIVE_INFINITY)
  return pool.map((row) => decorate(fen, row.uci, row.move, row.cp, best, profile, history, temperature, weak, prepared.length === 0))
}

function uniqueLegal(fen: string, lines: PersonalLine[]): Array<{ uci: string; move: Move; cp: number }> {
  const seen = new Set<string>()
  const rows: Array<{ uci: string; move: Move; cp: number }> = []
  for (const line of lines) {
    if (seen.has(line.uci)) continue
    const move = applyUci(fen, line.uci)
    if (!move) continue
    seen.add(line.uci)
    rows.push({ uci: line.uci, move, cp: moverCp(line) })
  }
  return rows
}

function allLegal(fen: string): Array<{ uci: string; move: Move; cp: number }> {
  const chess = new Chess(fen)
  return chess.moves({ verbose: true }).map((move) => ({ uci: toUci(move), move, cp: 0 }))
}

function decorate(
  fen: string,
  uci: string,
  move: Move,
  cp: number,
  best: number,
  profile: StyleProfile | null,
  history: PersonalHistory[],
  temperature: number,
  weak: boolean,
  fallback: boolean,
): Row {
  const reasons: string[] = []
  let logit = (Math.tanh(cp / 200) / temperature) * 2
  if (!weak && profile) {
    const style = styleLogit(move, profile)
    if (style.bonus > 0) {
      logit += style.bonus
      reasons.push(style.reason)
    }
  }
  if (!weak && samePosition(fen, uci, history)) {
    logit += Math.log(2.2)
    reasons.push('podobná pozice z tvých partií')
  }
  if (!weak && cp <= best - 15) {
    const mistake = typicalMistake(move, history)
    if (mistake) {
      logit += Math.log(1.45)
      reasons.push(mistake)
    }
  }
  if (reasons.length === 0) reasons.push(fallback || weak ? 'obecný model podle hodnocení' : 'podle hodnocení enginu')
  return { uci, san: move.san, logit, reasons }
}

function moverCp(line: PersonalLine): number {
  if (line.mate != null) {
    if (line.mate === 0) return -10000
    const sign = line.mate > 0 ? 1 : -1
    return sign * (9000 - Math.min(80, Math.abs(line.mate)) * 50)
  }
  return line.cp ?? 0
}

function styleLogit(move: Move, profile: StyleProfile): { bonus: number; reason: string } {
  const value = (id: StyleProfile['metrics'][number]['id']) => profile.metrics.find((metric) => metric.id === id)?.value ?? null
  const options: Array<{ bonus: number; reason: string }> = []
  const castle = value('castle')
  if (castle != null && (move.isKingsideCastle() || move.isQueensideCastle())) {
    options.push({ bonus: (castle / 100) * 1.1, reason: 'shoda se stylem: rošáda' })
  }
  const develop = value('develop')
  if (develop != null && (move.piece === 'n' || move.piece === 'b')) {
    options.push({ bonus: (develop / 100) * 0.45, reason: 'shoda se stylem: vývin' })
  }
  const center = value('center')
  if (center != null && move.piece === 'p' && CENTER.has(move.to)) {
    options.push({ bonus: (center / 100) * 0.5, reason: 'shoda se stylem: střed pěšcem' })
  }
  const capture = value('capture')
  if (capture != null && move.captured) {
    options.push({ bonus: (capture / 100) * 0.4, reason: 'shoda se stylem: braní' })
  }
  const check = value('check')
  if (check != null && (move.san.includes('+') || move.san.includes('#'))) {
    options.push({ bonus: (check / 100) * 0.35, reason: 'shoda se stylem: šach' })
  }
  options.sort((a, b) => b.bonus - a.bonus)
  return options[0] ?? { bonus: 0, reason: '' }
}

function samePosition(fen: string, uci: string, history: PersonalHistory[]): boolean {
  const placement = fen.split(' ')[0] ?? ''
  return history.some((item) => item.placement === placement && item.uci === uci)
}

function typicalMistake(move: Move, history: PersonalHistory[]): string | null {
  const label = mistakeLabel(move)
  if (!label) return null
  const mistakes = history.filter((item) => item.mistake)
  const matching = mistakes.filter((item) => {
    const previous = applyUci(item.fenBefore, item.uci)
    return previous ? mistakeLabel(previous) === label : false
  })
  return matching.length >= 3 ? label : null
}

function mistakeLabel(move: Move): string | null {
  if (move.captured && move.piece !== 'p') return 'typická chyba: braní figurou'
  if (move.captured) return 'typická chyba: braní pěšcem'
  return null
}

function toProbabilities(rows: Row[]): PersonalCandidate[] {
  if (rows.length === 0) return []
  const max = Math.max(...rows.map((row) => row.logit))
  const weights = rows.map((row) => Math.exp(row.logit - max))
  const sum = weights.reduce((total, weight) => total + weight, 0)
  const millis = weights.map((weight) => Math.round((weight / sum) * 1000))
  const gap = 1000 - millis.reduce((total, value) => total + value, 0)
  let largest = 0
  for (let index = 1; index < millis.length; index += 1) {
    if (millis[index] > millis[largest]) largest = index
  }
  millis[largest] += gap
  return rows.map((row, index) => ({
    uci: row.uci,
    san: row.san,
    probability: (millis[index] ?? 0) / 1000,
    reason: row.reasons.join('; '),
  }))
}

function pick(candidates: PersonalCandidate[], rng: () => number): PersonalCandidate | null {
  if (candidates.length === 0) return null
  let acc = 0
  const cursor = rng()
  for (const candidate of candidates) {
    acc += candidate.probability
    if (cursor <= acc) return candidate
  }
  return candidates[candidates.length - 1] ?? null
}
