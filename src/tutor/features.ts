import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import { PIECE_VALUE, materialBalance, opposite, parseUci } from '../chess/utils'

export interface PieceOnSquare {
  square: Square
  piece: PieceSymbol
}

export interface MoveFacts {
  move: Move
  mover: Color
  moveNumber: number
  isOpening: boolean
  isCheck: boolean
  isMate: boolean
  castle: 'king' | 'queen' | null
  centerPawn: boolean
  /** Number of central squares (d4, e4, d5, e5) the moved piece now controls. */
  centerControl: number
  development: boolean
  earlyQueen: boolean
  samePieceTwice: boolean
  kingWalk: boolean
  weakensKing: boolean
  rookFile: { square: Square; file: string; open: boolean } | null
  diagonalFor: 'b' | 'q' | null
  seventhRank: boolean
  passedPawn: boolean
  doubledPawns: boolean
  /** Enemy pieces the moved piece now attacks with profit (undefended or worth more). */
  threats: PieceOnSquare[]
  /** Set when the moved piece attacks two or more valuable targets (king included). */
  fork: PieceOnSquare[] | null
  /** Own pieces that were en prise before the move and are safe now. */
  saved: PieceOnSquare[]
  /** Own pieces that were en prise before the move and still are. */
  stillHanging: PieceOnSquare[]
  /** Own pieces en prise after the move. */
  hangingAfter: PieceOnSquare[]
}

const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5']
const MINOR_HOME: Record<Color, Square[]> = {
  w: ['b1', 'g1', 'c1', 'f1'],
  b: ['b8', 'g8', 'c8', 'f8'],
}

export function relativeRank(square: Square, color: Color): number {
  const rank = Number(square[1])
  return color === 'w' ? rank : 9 - rank
}

function pieceSquares(chess: Chess, color: Color): PieceOnSquare[] {
  const result: PieceOnSquare[] = []
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.color === color) result.push({ square: cell.square, piece: cell.type })
    }
  }
  return result
}

/** Pieces of `color` that the opponent can win: undefended, or attacked by something cheaper. */
export function enPrise(chess: Chess, color: Color): PieceOnSquare[] {
  const enemy = opposite(color)
  return pieceSquares(chess, color).filter(({ square, piece }) => {
    if (piece === 'k') return false
    const attackers = chess.attackers(square, enemy)
    if (attackers.length === 0) return false
    const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUE[chess.get(sq)!.type]))
    const defenders = chess.attackers(square, color)
    return defenders.length === 0 || cheapest < PIECE_VALUE[piece]
  })
}

function fileStatus(chess: Chess, file: string, color: Color): 'open' | 'half' | 'closed' {
  let own = false
  let enemy = false
  for (let rank = 1; rank <= 8; rank++) {
    const cell = chess.get(`${file}${rank}` as Square)
    if (cell?.type === 'p') {
      if (cell.color === color) own = true
      else enemy = true
    }
  }
  if (own) return 'closed'
  return enemy ? 'half' : 'open'
}

/** Loads a FEN with the given side to move (used to measure piece mobility). */
function withTurn(fen: string, color: Color): Chess | null {
  const parts = fen.split(' ')
  parts[1] = color
  parts[3] = '-'
  try {
    return new Chess(parts.join(' '), { skipValidation: true })
  } catch {
    return null
  }
}

function mobility(fen: string, color: Color, piece: PieceSymbol): number {
  const chess = withTurn(fen, color)
  if (!chess) return 0
  try {
    return chess.moves({ piece, verbose: true }).length
  } catch {
    return 0
  }
}

function isPassed(chess: Chess, square: Square, color: Color): boolean {
  const file = square.charCodeAt(0)
  const rank = Number(square[1])
  const enemy = opposite(color)
  for (let f = file - 1; f <= file + 1; f++) {
    if (f < 97 || f > 104) continue
    for (let r = 1; r <= 8; r++) {
      const ahead = color === 'w' ? r > rank : r < rank
      if (!ahead) continue
      const cell = chess.get(`${String.fromCharCode(f)}${r}` as Square)
      if (cell?.type === 'p' && cell.color === enemy) return false
    }
  }
  return true
}

function sameSquares(a: PieceOnSquare[], b: PieceOnSquare[]): PieceOnSquare[] {
  return a.filter((x) => b.some((y) => y.square === x.square))
}

/**
 * Describes what a move does on the board. Pure chess.js logic, no engine.
 * `history` = moves played before this one (both colours).
 */
export function analyzeMove(fenBefore: string, move: Move, history: Move[]): MoveFacts {
  const mover = move.color
  const enemy = opposite(mover)
  const before = new Chess(fenBefore)
  const after = new Chess(move.after)
  const moveNumber = Number(fenBefore.split(' ')[5]) || 1
  const isOpening = moveNumber <= 12
  const piece = move.piece

  const castle = move.isKingsideCastle() ? 'king' : move.isQueensideCastle() ? 'queen' : null

  const centerPawn = piece === 'p' && CENTER.includes(move.to)
  const centerControl = CENTER.filter((sq) => after.attackers(sq, mover).includes(move.to)).length

  const development = (piece === 'n' || piece === 'b') && MINOR_HOME[mover].includes(move.from) && moveNumber <= 15

  const undevelopedMinors = MINOR_HOME[mover].filter((sq) => {
    const cell = before.get(sq)
    return cell && cell.color === mover && (cell.type === 'n' || cell.type === 'b')
  }).length
  const earlyQueen = piece === 'q' && moveNumber <= 7 && undevelopedMinors >= 3 && !move.captured

  const previousOwn = history.length >= 2 ? history[history.length - 2] : null
  const samePieceTwice =
    isOpening &&
    moveNumber <= 10 &&
    !!previousOwn &&
    previousOwn.color === mover &&
    previousOwn.to === move.from &&
    piece !== 'p' &&
    !move.captured &&
    !castle &&
    !before.isAttacked(move.from, enemy)

  const rightsBefore = before.getCastlingRights(mover)
  const queensOn = pieceSquares(before, 'w').some((p) => p.piece === 'q') || pieceSquares(before, 'b').some((p) => p.piece === 'q')
  const kingWalk = piece === 'k' && !castle && (rightsBefore.k || rightsBefore.q) && queensOn && !before.inCheck()

  const kingOnHome = before.get(mover === 'w' ? 'e1' : 'e8')?.type === 'k'
  const weakensKing =
    piece === 'p' &&
    isOpening &&
    !move.captured &&
    ((move.from[0] === 'f' && relativeRank(move.to, mover) === 3) ||
      (move.from[0] === 'g' && move.isBigPawn() && kingOnHome))

  let rookFile: MoveFacts['rookFile'] = null
  for (const { square, piece: p } of pieceSquares(after, mover)) {
    if (p !== 'r') continue
    const file = square[0]
    const statusAfter = fileStatus(after, file, mover)
    if (statusAfter === 'closed') continue
    const rookMoved = move.to === square || (castle && (square === 'f1' || square === 'd1' || square === 'f8' || square === 'd8'))
    const statusBefore = fileStatus(before, file, mover)
    if (rookMoved || statusBefore === 'closed') {
      rookFile = { square, file, open: statusAfter === 'open' }
      break
    }
  }

  let diagonalFor: MoveFacts['diagonalFor'] = null
  if (piece === 'p' && moveNumber <= 15) {
    const bishopGain = mobility(move.after, mover, 'b') - mobility(fenBefore, mover, 'b')
    const queenGain = mobility(move.after, mover, 'q') - mobility(fenBefore, mover, 'q')
    if (bishopGain >= 2) diagonalFor = 'b'
    else if (queenGain >= 2) diagonalFor = 'q'
  }

  const seventhRank = piece === 'r' && relativeRank(move.to, mover) === 7 && relativeRank(move.from, mover) !== 7
  const passedPawn = piece === 'p' && relativeRank(move.to, mover) >= 5 && isPassed(after, move.to, mover)
  const doubledPawns =
    piece === 'p' &&
    !!move.captured &&
    pieceSquares(after, mover).filter((p) => p.piece === 'p' && p.square[0] === move.to[0]).length >= 2

  const movedValue = PIECE_VALUE[move.promotion ?? piece]
  const targets = pieceSquares(after, enemy).filter(({ square }) => after.attackers(square, mover).includes(move.to))
  const threats = targets.filter(({ square, piece: target }) => {
    if (target === 'k') return false
    const defended = after.attackers(square, enemy).length > 0
    return !defended || PIECE_VALUE[target] > movedValue
  })
  const forkTargets = targets.filter(
    ({ square, piece: target }) => target === 'k' || (threats.some((t) => t.square === square) && PIECE_VALUE[target] >= 3),
  )
  const fork = forkTargets.length >= 2 ? forkTargets : null

  const hangingBefore = enPrise(before, mover)
  const hangingAfter = enPrise(after, mover)
  const saved = hangingBefore
    .filter((h) => h.square !== move.from)
    .filter((h) => !hangingAfter.some((a) => a.square === h.square))
  if (hangingBefore.some((h) => h.square === move.from) && !hangingAfter.some((a) => a.square === move.to)) {
    saved.push({ square: move.to, piece })
  }
  const stillHanging = sameSquares(hangingAfter, hangingBefore)

  return {
    move,
    mover,
    moveNumber,
    isOpening,
    isCheck: after.inCheck(),
    isMate: after.isCheckmate(),
    castle,
    centerPawn,
    centerControl,
    development,
    earlyQueen,
    samePieceTwice,
    kingWalk,
    weakensKing,
    rookFile,
    diagonalFor,
    seventhRank,
    passedPawn,
    doubledPawns,
    threats,
    fork,
    saved,
    stillHanging,
    hangingAfter,
  }
}

/**
 * Material change for `color` after playing `line` from `fen`.
 * Extends the line while captures continue, so we don't stop in the middle of an exchange.
 */
export function materialSwing(fen: string, line: string[], color: Color, plies = 4): number {
  const chess = new Chess(fen)
  const start = materialBalance(chess, color)
  for (let i = 0; i < line.length && i < 10; i++) {
    try {
      chess.move(parseUci(line[i]))
    } catch {
      break
    }
    if (i + 1 >= plies) {
      const next = line[i + 1]
      const nextIsCapture = next ? !!chess.get(parseUci(next).to) : false
      if (!nextIsCapture) break
    }
  }
  return materialBalance(chess, color) - start
}
