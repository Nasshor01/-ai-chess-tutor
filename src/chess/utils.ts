import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { EngineLine, Score } from '../engine/types'

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

interface PieceName {
  /** 1. pád – kdo, co: jezdec */
  nom: string
  /** 2. pád – bez koho, čeho: jezdce */
  gen: string
  /** 4. pád – koho, co: jezdce */
  acc: string
  /** 7. pád – s kým, čím: jezdcem */
  ins: string
  feminine: boolean
}

export const PIECE_NAMES: Record<PieceSymbol, PieceName> = {
  p: { nom: 'pěšec', gen: 'pěšce', acc: 'pěšce', ins: 'pěšcem', feminine: false },
  n: { nom: 'jezdec', gen: 'jezdce', acc: 'jezdce', ins: 'jezdcem', feminine: false },
  b: { nom: 'střelec', gen: 'střelce', acc: 'střelce', ins: 'střelcem', feminine: false },
  r: { nom: 'věž', gen: 'věže', acc: 'věž', ins: 'věží', feminine: true },
  q: { nom: 'dáma', gen: 'dámy', acc: 'dámu', ins: 'dámou', feminine: true },
  k: { nom: 'král', gen: 'krále', acc: 'krále', ins: 'králem', feminine: false },
}

export function pieceName(piece: PieceSymbol, form: 'nom' | 'gen' | 'acc' | 'ins' = 'nom'): string {
  return PIECE_NAMES[piece][form]
}

/** Picks the masculine or feminine adjective ending, e.g. "nechráněný" / "nechráněná". */
export function adj(piece: PieceSymbol, masculine: string, feminine: string): string {
  return PIECE_NAMES[piece].feminine ? feminine : masculine
}

const CZECH_SAN: Record<string, string> = { N: 'J', B: 'S', R: 'V', Q: 'D' }

/** Converts English SAN to Czech notation (J = jezdec, S = střelec, V = věž, D = dáma). */
export function czSan(san: string): string {
  return san.replace(/[NBRQ]/g, (letter) => CZECH_SAN[letter] ?? letter)
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export function parseUci(uci: string): { from: Square; to: Square; promotion?: PieceSymbol } {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
  }
}

export function toUci(move: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

/** Plays a UCI move on a copy of the position; returns null if illegal. */
export function applyUci(fen: string, uci: string): Move | null {
  const chess = new Chess(fen)
  try {
    return chess.move(parseUci(uci))
  } catch {
    return null
  }
}

/** Converts a principal variation to SAN moves (stops at the first illegal move). */
export function pvToSan(fen: string, pv: string[], limit = pv.length): string[] {
  const chess = new Chess(fen)
  const result: string[] = []
  for (const uci of pv.slice(0, limit)) {
    try {
      result.push(chess.move(parseUci(uci)).san)
    } catch {
      break
    }
  }
  return result
}

/** Formats a SAN line with move numbers, e.g. "12. Jf3 Sc5 13. O-O". */
export function formatLine(fen: string, sans: string[]): string {
  const [, turn, , , , fullmove] = fen.split(' ')
  let moveNumber = Number(fullmove) || 1
  let whiteToMove = turn === 'w'
  const parts: string[] = []
  sans.forEach((san, i) => {
    if (whiteToMove) parts.push(`${moveNumber}. ${czSan(san)}`)
    else parts.push(i === 0 ? `${moveNumber}… ${czSan(san)}` : czSan(san))
    if (!whiteToMove) moveNumber++
    whiteToMove = !whiteToMove
  })
  return parts.join(' ')
}

export function materialCount(chess: Chess, color: Color): number {
  let total = 0
  for (const row of chess.board()) {
    for (const square of row) {
      if (square && square.color === color && square.type !== 'k') total += PIECE_VALUE[square.type]
    }
  }
  return total
}

/** Material balance from `color`'s perspective. */
export function materialBalance(chess: Chess, color: Color): number {
  return materialCount(chess, color) - materialCount(chess, opposite(color))
}

const MATE_CP = 10000

/** Converts an engine line (side-to-move POV) into a White-POV score. */
export function lineToScore(line: EngineLine | undefined, fen: string): Score {
  if (!line) return { cp: 0, mate: null }
  const whiteToMove = fen.split(' ')[1] === 'w'
  const sign = whiteToMove ? 1 : -1
  if (line.mate !== null) {
    // "mate 0" means the side to move is already mated.
    if (line.mate === 0) return { cp: whiteToMove ? -MATE_CP : MATE_CP, mate: 0 }
    const whiteMate = sign * line.mate
    const cp = whiteMate > 0 ? MATE_CP - Math.abs(whiteMate) : -MATE_CP + Math.abs(whiteMate)
    return { cp, mate: whiteMate }
  }
  return { cp: sign * (line.cp ?? 0), mate: null }
}

/** Score from a given colour's perspective in centipawns (mates clamped). */
export function cpFor(score: Score, color: Color): number {
  return color === 'w' ? score.cp : -score.cp
}

/** Win probability in % for White (Lichess model). */
export function winChance(score: Score): number {
  if (score.mate !== null) return score.cp > 0 ? 100 : 0
  const cp = Math.max(-1000, Math.min(1000, score.cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

export function winChanceFor(score: Score, color: Color): number {
  const white = winChance(score)
  return color === 'w' ? white : 100 - white
}

export function formatScore(score: Score): string {
  if (score.mate !== null) {
    if (score.mate === 0) return score.cp > 0 ? '1-0' : '0-1'
    return `${score.mate > 0 ? '+' : '-'}M${Math.abs(score.mate)}`
  }
  const pawns = score.cp / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`
}

/** Human description of who stands better, phrased for a player who plays White. */
export function describeScore(score: Score): string {
  if (score.mate !== null) {
    if (score.mate === 0) return score.cp > 0 ? 'Mat – vyhrál jsi!' : 'Mat – partie skončila.'
    return score.mate > 0
      ? `Máš vynucený ${mateInText(score.mate)}!`
      : `Soupeř má vynucený ${mateInText(-score.mate)}.`
  }
  const cp = score.cp
  const abs = Math.abs(cp)
  if (abs < 35) return 'Pozice je vyrovnaná.'
  const you = cp > 0
  if (abs < 100) return you ? 'Máš malou výhodu.' : 'Soupeř má malou výhodu.'
  if (abs < 250) return you ? 'Máš jasnou výhodu.' : 'Soupeř má jasnou výhodu.'
  return you ? 'Máš rozhodující výhodu.' : 'Soupeř má rozhodující výhodu.'
}

/** "mat příštím tahem", "mat ve 3 tazích", "mat v 5 tazích" */
export function mateInText(n: number): string {
  if (n <= 1) return 'mat hned příštím tahem'
  return `mat ${n <= 4 ? 've' : 'v'} ${n} tazích`
}

/** Czech plural helper: plural(3, 'tah', 'tahy', 'tahů'). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  if (n >= 2 && n <= 4) return few
  return many
}
