import { Chess, type Move, type Square } from 'chess.js'
import type { EngineResult, Score } from '../engine/types'
import { applyUci, czSan, formatLine, lineToScore, mateInText, plural, pvToSan, toUci } from '../chess/utils'
import { kingFlightSquares } from './conversion'
import type { MatePuzzle } from '../puzzles/matePuzzles'
import { CONCEPTS, type ConceptId } from './concepts'
import type { BetterMove, ConceptMention, MoveQuality, TutorComment } from './types'

export type MateOutcome = 'mated' | 'held' | 'slower' | 'escaped' | 'stalemate'

export interface MateCommentInput {
  plyIndex: number
  puzzle: MatePuzzle
  move: Move
  /** Moves played since the puzzle started (before `move`). */
  history: Move[]
  before: EngineResult | null
  after: EngineResult | null
  conceptSeen: Partial<Record<ConceptId, number>>
}

export interface MateComment {
  comment: TutorComment
  outcome: MateOutcome
  /** White's moves still available to deliver mate after this one. */
  movesLeft: number
}

/** Squares next to Black's king it could step to if it were Black's move. */
export function kingEscapeSquares(fen: string): Square[] {
  return kingFlightSquares(fen, 'b')
}

/** Short note on Black's defensive move in Mating Practice; null = fall back to the generic description. */
export function describeDefence(move: Move): string | null {
  const wasCheck = new Chess(move.before).inCheck()
  const escape = kingEscapeSquares(move.after)
  const room =
    escape.length === 0
      ? 'Teď nemá žádné volné pole.'
      : `Volná pole má teď ${escape.length}: ${joinSquares(escape)}.`
  if (move.piece === 'k') {
    const verb = move.captured ? `bere na ${move.to}` : `uhýbá na ${move.to}`
    return `Černý král ${verb}${wasCheck ? ' před šachem' : ''}. ${room}`
  }
  if (wasCheck && !move.captured) {
    return `Soupeř se brání – ${move.san.startsWith('O') ? 'rošádou' : `zakrývá šach tahem ${czSan(move.san)}`}. ${room}`
  }
  return null
}

function joinSquares(squares: Square[]): string {
  return squares.length <= 1 ? squares.join('') : `${squares.slice(0, -1).join(', ')} a ${squares[squares.length - 1]}`
}

function freeSquaresText(squares: Square[]): string {
  if (squares.length === 0) return 'Černý král teď nemá žádné volné pole – síť je úplně zatažená.'
  const word = plural(squares.length, 'volné pole', 'volná pole', 'volných polí')
  return `Černý král má ${squares.length} ${word}: ${joinSquares(squares)}.`
}

function whiteMate(result: EngineResult | null, fen: string): number | null {
  const line = result?.lines[0]
  if (!line) return null
  const score = lineToScore(line, fen)
  return score.mate !== null && score.mate > 0 ? score.mate : null
}

/** The move White should have played: the stored solution while still on it, otherwise the engine's choice. */
function correctContinuation(input: MateCommentInput, movesLeftBefore: number): BetterMove | null {
  const { puzzle, history, before, move } = input
  const fen = move.before
  const onSolution = history.every((m, i) => puzzle.solution[i] === m.san)
  let sans: string[] = []
  if (onSolution && puzzle.solution[history.length]) {
    sans = puzzle.solution.slice(history.length)
  } else if (before?.lines[0]) {
    sans = pvToSan(fen, before.lines[0].pv, movesLeftBefore * 2 - 1)
  }
  if (sans.length === 0) return null
  const first = new Chess(fen).move(sans[0])
  if (first.san === move.san) return null
  const mateLength = Math.ceil(sans.length / 2)
  return {
    san: czSan(first.san),
    uci: toUci(first),
    explanation: `vede k ${mateLength === 1 ? 'matu okamžitě' : `matu ve ${mateLength} tazích`}. ${puzzle.idea.replace(/\.$/, '')}`,
    line: formatLine(fen, sans),
    minor: false,
  }
}

function headlineFor(outcome: MateOutcome, perfect: boolean, kingFreed: boolean): string {
  switch (outcome) {
    case 'mated':
      return 'Mat! Úloha vyřešena.'
    case 'held':
      return perfect ? 'Výborně – matová síť drží!' : 'Síť drží, mat je stále na dosah.'
    case 'slower':
      return 'Mat ještě je, ale nestihneš ho v limitu.'
    case 'escaped':
      return kingFreed ? 'Král uniká ze sítě!' : 'Tímto tahem se mat ztratil.'
    case 'stalemate':
      return 'Pat! Černý nemá žádný tah.'
  }
}

const QUALITY: Record<MateOutcome, MoveQuality> = {
  mated: 'best',
  held: 'best',
  slower: 'inaccuracy',
  escaped: 'blunder',
  stalemate: 'blunder',
}

/** Tutor comment for a move in Mating Practice: does the move keep the mating net, or does the king slip away? */
export function buildMateComment(input: MateCommentInput): MateComment {
  const { puzzle, move, history, after } = input
  const userMovesBefore = history.filter((m) => m.color === 'w').length
  const movesLeftBefore = puzzle.mateIn - userMovesBefore
  const movesLeft = movesLeftBefore - 1
  const board = new Chess(move.after)
  const onSolution = history.every((m, i) => puzzle.solution[i] === m.san) && puzzle.solution[history.length] === move.san
  const mate = whiteMate(after, move.after)

  let outcome: MateOutcome
  if (board.isCheckmate()) outcome = 'mated'
  else if (board.isStalemate()) outcome = 'stalemate'
  else if (movesLeft > 0 && (onSolution || (mate !== null && mate <= movesLeft))) outcome = 'held'
  else if (mate !== null) outcome = 'slower'
  else outcome = 'escaped'

  const escapeBefore = kingEscapeSquares(move.before)
  const escapeAfter = kingEscapeSquares(move.after)
  const freed = escapeAfter.filter((sq) => !escapeBefore.includes(sq))
  const closed = escapeBefore.filter((sq) => !escapeAfter.includes(sq))
  const reasons: string[] = []
  const mine: string[] = []
  const againstText: string[] = []
  const concepts: ConceptId[] = []

  if (outcome === 'mated') {
    reasons.push(`Použil jsi vzor: ${puzzle.pattern}.`, puzzle.idea)
  } else if (outcome === 'stalemate') {
    reasons.push(
      'Král není v šachu, ale nemá kam táhnout a černý nemá jiný tah – partie končí remízou.',
      'Při matování vždy nech králi aspoň jedno pole, dokud nemáš připravenou poslední ránu.',
    )
  } else {
    if (outcome === 'held') {
      if (closed.length > 0) reasons.push(`Zavřel jsi králi ${plural(closed.length, 'pole', 'pole', 'polí')} ${joinSquares(closed)}.`)
      if (move.san.includes('+')) reasons.push('Dáváš šach – soupeř musí reagovat a nemá čas na obranu.')
      if (move.captured) reasons.push('Braním obránce trháš soupeřovu obranu.')
      reasons.push(freeSquaresText(escapeAfter))
      reasons.push(
        movesLeft === 1
          ? 'Teď už stačí jediný tah – po soupeřově odpovědi najdi mat.'
          : `Do matu ti zbývají ${movesLeft} tahy – drž krále v síti.`,
      )
      mine.push(`Máš vynucený ${mateInText(Math.min(mate ?? movesLeft, movesLeft))}.`)
    } else if (outcome === 'slower') {
      reasons.push(
        `Po tomhle tahu vede k matu až ${mateInText(mate!)}, ale úloha chtěla mat ${movesLeftBefore === 1 ? 'hned tímto tahem' : `do ${movesLeftBefore} tahů`}.`,
      )
      if (freed.length > 0) reasons.push(`Král získal ${plural(freed.length, 'pole', 'pole', 'polí')} ${joinSquares(freed)} a síť se uvolnila.`)
      else reasons.push(freeSquaresText(escapeAfter))
    } else {
      if (freed.length > 0) reasons.push(`Pustil jsi krále na ${plural(freed.length, 'pole', 'pole', 'polí')} ${joinSquares(freed)} – odtud se může vymanit.`)
      reasons.push('Vynucený mat už není – soupeř se teď dokáže ubránit nebo utéct.')
    }
    if (outcome !== 'held') {
      const reply = after?.lines[0]?.pv[0] ? applyUci(move.after, after.lines[0].pv[0]) : null
      if (reply) againstText.push(`Soupeř může odpovědět ${czSan(reply.san)}.`)
    }
    concepts.push('matingNet')
  }

  const failed = outcome === 'slower' || outcome === 'escaped' || outcome === 'stalemate'
  const better = failed ? correctContinuation(input, movesLeftBefore) : null
  const perfect = onSolution || mate === movesLeft
  const quality = outcome === 'held' && !perfect ? 'excellent' : QUALITY[outcome]

  const evalAfter: Score =
    outcome === 'mated'
      ? { cp: 10000, mate: 0 }
      : outcome === 'stalemate'
        ? { cp: 0, mate: null }
        : after?.lines[0]
          ? lineToScore(after.lines[0], move.after)
          : { cp: 0, mate: null }

  const mentions: ConceptMention[] = concepts.map((id) => {
    const seen = input.conceptSeen[id] ?? 0
    return { concept: CONCEPTS[id], isNew: seen === 0, showExplanation: seen < 1 }
  })

  const fullmove = Number(move.before.split(' ')[5]) || 1
  const comment: TutorComment = {
    plyIndex: input.plyIndex,
    san: czSan(move.san),
    uci: toUci(move),
    color: move.color,
    byUser: true,
    moveNumber: fullmove,
    quality,
    verdict: failed ? 'bad' : 'good',
    headline: headlineFor(outcome, perfect, freed.length > 0),
    reasons,
    better,
    threats: { mine, against: againstText },
    concepts: mentions,
    evalAfter,
    winLoss: failed ? 50 : 0,
    issues: failed ? ['mate:missed'] : [],
  }
  return { comment, outcome, movesLeft }
}
