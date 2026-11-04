import { Chess, type Color, type Move, type Square } from 'chess.js'
import type { EngineLine, EngineResult, Score } from '../engine/types'
import { PIECE_VALUE, cpFor, czSan, lineToScore, materialBalance, mateInText, parseUci, pieceName, toUci } from '../chess/utils'
import { isClearlyWinning, mateDistance, restrictFacts, restrictScore } from '../tutor/conversion'
import { analyzeMove, enPrise, relativeRank, type MoveFacts } from '../tutor/features'

export type OptionKind = 'good' | 'average' | 'bad' | 'mate' | 'restrict' | 'practical' | 'slow'

export interface CalcBranch {
  reply: string
  answers: string[]
}

export interface CalcOption {
  kind: OptionKind
  letter: 'A' | 'B' | 'C'
  label: string
  san: string
  uci: string
  from: Square
  to: Square
  /** Centipawn loss against the best move, from the side to move. Null when the move was not in the search. */
  loss: number | null
  mover: Color
  /** False when this suggestion gives away a position that was already winning. */
  keeps?: boolean
  explanation: string
  branches: CalcBranch[]
  /** The move, the reply and a possible answer, in UCI – used for the board preview. */
  preview: string[]
  previewSan: string[]
}

export interface FinishInfo {
  title: 'Dokonči partii'
  /** Forced mate length from this position, when one is already on the board. */
  mateIn: number | null
}

export interface CalcResult {
  fen: string
  side: Color
  options: CalcOption[]
  /** Whose turn the suggestions are for, spelled out. */
  turnText: string
  note: string
  /** Set when the side to move is clearly winning and the suggestions chase the king. */
  finish: FinishInfo | null
}

export type Analyze = (fen: string, options: { depth: number; movetime?: number; multipv?: number }) => Promise<EngineResult>

const ROOT = { depth: 10, movetime: 1100, multipv: 6 }
const FINISH = { depth: 16, movetime: 1800, multipv: 4 }
const REPLY = { depth: 8, movetime: 350, multipv: 3 }
/** Show an engine mate as "Matová cesta" up to this distance. */
const MATE_WINDOW = 12
/** A "reasonably good" move stays inside this centipawn window. */
const GOOD_WINDOW = 90
/** Average moves aim at a human inaccuracy of about this size. */
const AVERAGE_TARGET = 120

const LABELS: Record<OptionKind, { letter: CalcOption['letter']; label: string }> = {
  good: { letter: 'A', label: 'Tah A – rozumný' },
  average: { letter: 'B', label: 'Tah B – průměrný' },
  bad: { letter: 'C', label: 'Tah C – riskantní / chybný' },
  mate: { letter: 'A', label: 'Matová cesta' },
  restrict: { letter: 'A', label: 'Tah A – omez krále' },
  practical: { letter: 'B', label: 'Tah B – praktický' },
  slow: { letter: 'C', label: 'Tah C – pomalejší' },
}

interface Rated {
  move: Move
  uci: string
  loss: number | null
  facts: MoveFacts
  /** Material (pawns) of own pieces left en prise. */
  hangValue: number
  /** Material lost when the capturer is worth more than what it took and can be recaptured. */
  badCaptureLoss: number
}

/** Loss in centipawns for the side about to move (mates count as roughly 100 pawns). */
function sideLoss(best: Score, move: Score, side: Color): number {
  const forSide = (score: Score) => (side === 'w' ? score.cp : -score.cp)
  return Math.max(0, forSide(best) - forSide(move))
}

function isRimKnight(move: Move): boolean {
  return move.piece === 'n' && (move.to[0] === 'a' || move.to[0] === 'h')
}

function isPassivePawn(move: Move): boolean {
  return move.piece === 'p' && !move.captured && relativeRank(move.to, move.color) <= 3 && (move.to[0] === 'a' || move.to[0] === 'h')
}

function rate(fen: string, move: Move, history: Move[], loss: number | null): Rated {
  const facts = analyzeMove(fen, move, history)
  const hangValue = facts.hangingAfter.reduce((sum, piece) => sum + PIECE_VALUE[piece.piece], 0)
  const movedHangs = facts.hangingAfter.some((piece) => piece.square === move.to)
  const badCaptureLoss =
    move.captured && movedHangs ? Math.max(0, PIECE_VALUE[move.promotion ?? move.piece] - PIECE_VALUE[move.captured]) : 0
  return { move, uci: toUci(move), loss, facts, hangValue, badCaptureLoss }
}

/** How much a move looks like something a club player reaches for when things are calm. Higher = more natural. */
function naturalScore(r: Rated): number {
  const { facts, move } = r
  let score = 0
  if (facts.isMate) score += 12
  if (facts.castle) score += 5
  if (facts.development) score += 4
  if (facts.centerPawn) score += 4
  if (move.captured && r.badCaptureLoss === 0 && r.hangValue === 0) score += 3
  if (facts.isCheck && !facts.earlyQueen) score += 1
  if (facts.earlyQueen) score -= 3
  if (facts.weakensKing) score -= 3
  if (facts.samePieceTwice) score -= 2
  if (facts.kingWalk) score -= 4
  if (isRimKnight(move)) score -= 2
  score -= (r.loss ?? 40) / 40
  return score
}

/** Lower = a better example of a slightly inaccurate but still human move. */
function averageRank(r: Rated): number {
  const looksHuman =
    r.facts.earlyQueen || r.facts.samePieceTwice || r.facts.weakensKing || isRimKnight(r.move) || isPassivePawn(r.move)
  // Unevaluated quiet moves are not "average" – they might be anything. Known moves and typical inaccuracies are.
  if (r.loss === null && !looksHuman) return 1000
  const loss = r.loss ?? AVERAGE_TARGET
  let distance = Math.abs(loss - AVERAGE_TARGET)
  if (r.facts.earlyQueen) distance -= 35
  if (r.facts.samePieceTwice) distance -= 30
  if (isRimKnight(r.move)) distance -= 20
  if (isPassivePawn(r.move)) distance -= 15
  if (r.facts.weakensKing && (r.loss === null || r.loss < 200)) distance -= 10
  if (r.hangValue >= 3 || r.badCaptureLoss >= 2) distance += 400
  if (r.facts.isMate) distance += 400
  if (r.loss !== null && r.loss < 25) distance += 80
  return distance
}

/** Higher = a more instructive human mistake (a hang or a bad trade beats a random king move). */
function blunderScore(r: Rated, missedMate: boolean): number {
  let score = 0
  if (r.badCaptureLoss >= 1) score += 60 + r.badCaptureLoss * 8
  if (r.hangValue >= 1) score += 45 + r.hangValue * 6
  if (missedMate && !r.facts.isMate) score += 30 + (r.move.captured || r.facts.isCheck ? 8 : 0)
  if (r.facts.weakensKing) score += 20
  if (isRimKnight(r.move)) score += 14
  if (r.facts.kingWalk) score += 9
  if (r.facts.earlyQueen && r.hangValue > 0) score += 8
  if (r.loss !== null && r.loss >= 150) score += Math.min(r.loss, 800) / 80
  return score
}

function explain(kind: 'good' | 'average' | 'bad', r: Rated, missedMate: boolean): string {
  const { facts, move } = r
  if (kind === 'good') {
    if (facts.isMate) return 'Rozumná volba: tohle je mat. Ostatní tahy ho pouštějí.'
    if (facts.castle) return 'Rozumná volba: rošáda schová krále a zapojí věž. Přesně takový tah se na téhle úrovni vyplatí.'
    if (move.captured && r.badCaptureLoss === 0 && r.hangValue === 0) {
      return `Rozumná volba: bereš ${pieceName(move.captured, 'acc')} a nezůstane ti nic viset.`
    }
    if (facts.development) return `Rozumná volba: vyvíjíš ${pieceName(move.piece, 'acc')} a držíš se základů – vývin, potom útok.`
    if (facts.centerPawn) return 'Rozumná volba: bereš si střed pěšcem a otevíráš cestu figurám.'
    if (facts.isCheck) return 'Rozumná volba: šach, který soupeř musí řešit a nic ti za něj nevisí.'
    return 'Rozumná volba: klidný tah, který drží figury kryté a nic nepouští.'
  }
  if (kind === 'average') {
    if (facts.earlyQueen) return 'Průměrný tah: dáma vyráží brzy. Soupeř ji může honit a ty zatím nevyvíjíš ostatní figury.'
    if (facts.samePieceTwice) return 'Průměrný tah: stejná figura táhne podruhé, zatímco ostatní ještě stojí doma.'
    if (facts.weakensKing) return 'Průměrný tah: pěšec před králem se pohne. Hned to neprohraje, ale král bude zranitelnější.'
    if (isRimKnight(move)) return `Průměrný tah: jezdec na ${move.to} stojí na okraji a má málo polí. Ve středu by byl užitečnější.`
    if (isPassivePawn(move)) return 'Průměrný tah: krajní pěšec nic neřeší. Figury zatím stojí a soupeř má snazší hru.'
    return 'Průměrný tah: nic hned nevisí, ale pozice se zhorší. Silnější pokračování je mezi ostatními návrhy.'
  }
  if (missedMate && !facts.isMate) return 'Přehlížíš mat. Po tomhle tahu soupeř vyvázne a šance je pryč.'
  if (r.badCaptureLoss >= 1) {
    return `Špatná výměna: bereš ${pieceName(move.captured!, 'acc')}, ale ${pieceName(move.promotion ?? move.piece)} na ${move.to} zůstane viset.`
  }
  const hung = facts.hangingAfter[0]
  if (hung) {
    const pronoun = hung.piece === 'q' || hung.piece === 'r' ? 'ji' : 'ho'
    return `Riskantní: ${pieceName(hung.piece)} na ${hung.square} zůstane bez krytí a soupeř ${pronoun} může vzít.`
  }
  if (facts.weakensKing) return 'Riskantní: oslabuješ pěšce před králem a nic za to nezískáš.'
  if (facts.kingWalk) return 'Chybný tah: král vyjde ven a ztratí rošádu. Na téhle úrovni to bývá drahé.'
  if (isRimKnight(move)) return `Riskantní: jezdec na ${move.to} vypadává ze hry a soupeř získá čas.`
  return 'Chybný tah: pouštíš výhodu a dáváš soupeři snadný plán. Rozumnější je některý z ostatních návrhů.'
}

function freeCapture(fen: string): Move | null {
  const chess = new Chess(fen)
  if (chess.isGameOver()) return null
  const hanging = enPrise(chess, chess.turn() === 'w' ? 'b' : 'w')
  if (hanging.length === 0) return null
  const takes = chess.moves({ verbose: true }).filter((move) => hanging.some((piece) => piece.square === move.to))
  takes.sort((a, b) => PIECE_VALUE[b.captured!] - PIECE_VALUE[a.captured!])
  return takes[0] ?? null
}

/** A club-level reply: the obvious grab of a free piece, otherwise a move a bit worse than the engine's top choice. */
function pickReply(lines: EngineLine[], fen: string): { main: string; alt: string | null; answer: string | null } | null {
  if (lines.length === 0 || !lines[0].pv[0]) return null
  const side = fen.split(' ')[1] as Color
  const best = lineToScore(lines[0], fen)
  const scored = lines
    .filter((line) => line.pv[0])
    .map((line) => ({ line, loss: sideLoss(best, lineToScore(line, fen), side) }))
  const band = scored.filter((entry) => entry.loss >= 30 && entry.loss <= 160)
  const chosen = band.sort((a, b) => Math.abs(a.loss - 60) - Math.abs(b.loss - 60))[0] ?? scored[0]
  const alt = scored.find((entry) => entry.line !== chosen.line && entry.loss <= 200)
  return { main: chosen.line.pv[0], alt: alt?.line.pv[0] ?? null, answer: chosen.line.pv[1] ?? null }
}

function playSan(fen: string, uci: string): { san: string; after: string } | null {
  const chess = new Chess(fen)
  try {
    const move = chess.move(parseUci(uci))
    return { san: czSan(move.san), after: chess.fen() }
  } catch {
    return null
  }
}

function walkPv(fen: string, pv: string[], limit = 16): { uci: string[]; san: string[] } {
  const uci: string[] = []
  const san: string[] = []
  let cursor = fen
  for (const move of pv) {
    if (uci.length >= limit) break
    const played = playSan(cursor, move)
    if (!played) break
    uci.push(move)
    san.push(played.san)
    cursor = played.after
    if (played.san.includes('#')) break
  }
  return { uci, san }
}

/** Centipawn eval of a move for the side to move, reconstructed from its loss against `best`. */
function scoreAfter(entry: Rated, best: Score, side: Color): number {
  return cpFor(best, side) - (entry.loss ?? 0)
}

function keepsWin(entry: Rated, best: Score, side: Color): boolean {
  if (entry.facts.isMate) return true
  if (entry.hangValue >= 3 || entry.badCaptureLoss >= 2) return false
  if (entry.loss === null) return false
  const cp = scoreAfter(entry, best, side)
  if (cp >= 450) return true
  const material = materialBalance(new Chess(entry.move.after), side)
  if (material >= 5 && cp >= 50) return true
  if (material >= 3 && cp >= 150) return true
  if (material >= 2 && cp >= 250) return true
  return false
}

function squeeze(fen: string, entry: Rated): number {
  return restrictScore(restrictFacts(fen, entry.move)) - entry.hangValue * 5 - entry.badCaptureLoss * 5
}

function mostRestricting(fen: string, pool: Rated[]): Rated | null {
  if (pool.length === 0) return null
  return pool.reduce((best, entry) => {
    const diff = squeeze(fen, entry) - squeeze(fen, best)
    if (diff !== 0) return diff > 0 ? entry : best
    return (entry.loss ?? 0) < (best.loss ?? 0) ? entry : best
  })
}

function leastRestricting(fen: string, pool: Rated[]): Rated | null {
  if (pool.length === 0) return null
  return pool.reduce((best, entry) => {
    const diff = squeeze(fen, entry) - squeeze(fen, best)
    if (diff !== 0) return diff < 0 ? entry : best
    return (entry.loss ?? 0) > (best.loss ?? 0) ? entry : best
  })
}

function explainFinish(kind: OptionKind, entry: Rated, fen: string, keeps: boolean, mateIn: number | null): string {
  const facts = restrictFacts(fen, entry.move)
  if (kind === 'mate') {
    if (entry.facts.isMate || mateIn === 1) return 'Mat hned. Král nemá kam uhnout.'
    return `Matová cesta: ${mateInText(mateIn ?? 2)}. V náhledu uvidíš, jak krále postupně uzavřít.`
  }
  if (!keeps) return 'Tenhle tah výhodu pouští. Zůstaň u tahů, které krále dál omezují.'
  if (kind === 'slow') {
    if (facts.isCheck || facts.closed > 0 || facts.seventh || facts.cutsKing) {
      return 'Pořád to vyhrává, ale krále to omezí míň. Mat přijde, jen pomaleji.'
    }
    return 'Pořád vyhráváš, ale krále tím skoro neomezíš. Mat přijde, jen pomaleji.'
  }
  if (facts.seventh) return 'Praktické dokončení: věž na sedmé řadě bere králi prostor. Takhle partii dodělává hráč kolem 1400.'
  if (facts.cutsKing) return 'Praktické dokončení: odřízneš krále a zužuješ mu pole. Materiál teď není důležitý.'
  if (facts.queenNear) return 'Praktické dokončení: dáma se přiblíží ke králi a spolu s ostatními figurami ho uzavře.'
  if (facts.kingCloser) return 'Praktické dokončení: vlastní král se přiblíží. V koncovce bez něj mat často nejde.'
  if (facts.isCheck) return 'Praktické dokončení: šach bere králi tempo a omezuje útěk.'
  if (facts.closed > 0) return 'Praktické dokončení: bereš králi útěková pole a držíš výhru.'
  return 'Praktické dokončení: klidný tah, který drží výhru a nenechá krále utéct.'
}

interface PlayedLine {
  preview: string[]
  previewSan: string[]
  branches: CalcBranch[]
}

function lineFromPv(fen: string, entry: Rated, pv: string[]): PlayedLine {
  const walked = walkPv(fen, pv)
  const preview = walked.uci.length > 0 ? walked.uci : [entry.uci]
  const previewSan = walked.san.length > 0 ? walked.san : [czSan(entry.move.san)]
  const branches: CalcBranch[] = []
  if (previewSan.length >= 2) branches.push({ reply: previewSan[1], answers: previewSan[2] ? [previewSan[2]] : [] })
  return { preview, previewSan, branches }
}

async function completeMatePv(
  fen: string,
  pv: string[],
  mateIn: number,
  analyze: Analyze,
  isCancelled: () => boolean,
): Promise<string[] | null> {
  const walked = walkPv(fen, pv)
  if (walked.san.at(-1)?.includes('#')) return walked.uci
  let cursor = fen
  for (const uci of walked.uci) {
    const played = playSan(cursor, uci)
    if (!played) return walked.uci
    cursor = played.after
  }
  const line = [...walked.uci]
  const target = Math.min(16, Math.max(line.length + 2, mateIn * 2))
  let searches = 0
  while (line.length < target && searches < 2) {
    if (isCancelled()) return null
    if (new Chess(cursor).isGameOver()) break
    searches += 1
    const search = await analyze(cursor, { depth: 12, movetime: 500, multipv: 1 })
    if (isCancelled()) return null
    const extra = search.lines[0]?.pv ?? []
    if (!extra[0] && search.bestMove) extra.push(search.bestMove)
    if (extra.length === 0) break
    let progressed = false
    for (const uci of extra) {
      if (line.length >= target) break
      const played = playSan(cursor, uci)
      if (!played) break
      line.push(uci)
      cursor = played.after
      progressed = true
      if (played.san.includes('#')) return line
    }
    if (!progressed) break
  }
  return line
}

async function followUp(
  entry: Rated,
  analyze: Analyze,
  isCancelled: () => boolean,
  punish: boolean,
  accurate: boolean,
): Promise<PlayedLine | null> {
  const preview = [entry.uci]
  const previewSan = [czSan(entry.move.san)]
  const branches: CalcBranch[] = []
  if (new Chess(entry.move.after).isGameOver()) return { preview, previewSan, branches }

  const grab = punish ? freeCapture(entry.move.after) : null
  let replyUci = grab ? toUci(grab) : null
  let altUci: string | null = null
  let answerUci: string | null = null
  const search = await analyze(entry.move.after, accurate ? { depth: 10, movetime: 500, multipv: 2 } : REPLY)
  if (isCancelled()) return null
  if (accurate) {
    const pv = search.lines[0]?.pv ?? []
    if (!replyUci && pv[0]) replyUci = pv[0]
    answerUci = grab ? null : (pv[1] ?? null)
    const alt = search.lines[1]?.pv[0]
    if (alt && alt !== replyUci) altUci = alt
  } else {
    const choice = pickReply(search.lines, entry.move.after)
    if (!replyUci && choice) replyUci = choice.main
    if (choice) {
      altUci = choice.alt !== replyUci ? choice.alt : null
      if (!grab) answerUci = choice.answer
    }
  }
  if (grab && !answerUci) {
    const follow = await analyze(grab.after, { depth: 6, movetime: 220, multipv: 2 })
    if (isCancelled()) return null
    answerUci = pickReply(follow.lines, grab.after)?.main ?? null
  }
  const reply = replyUci ? playSan(entry.move.after, replyUci) : null
  if (reply && replyUci) {
    preview.push(replyUci)
    previewSan.push(reply.san)
    const answer = answerUci ? playSan(reply.after, answerUci) : null
    if (answer && answerUci) {
      preview.push(answerUci)
      previewSan.push(answer.san)
    }
    const alt = altUci ? playSan(entry.move.after, altUci) : null
    branches.push({ reply: reply.san, answers: answer ? [answer.san] : [] })
    if (alt && alt.san !== reply.san) branches.push({ reply: alt.san, answers: [] })
  }
  return { preview, previewSan, branches }
}

interface FinishChoice {
  kind: OptionKind
  entry: Rated
  keeps: boolean
  mateIn: number | null
  pv: string[] | null
}

function finishChoices(fen: string, side: Color, rated: Rated[], lines: EngineLine[], best: Score | null): { choices: FinishChoice[]; mateIn: number | null } {
  const engineMates = lines
    .map((line) => ({ line, dist: mateDistance(lineToScore(line, fen), side) }))
    .filter((entry) => entry.dist !== null && entry.dist <= MATE_WINDOW && entry.line.pv[0])
    .sort((a, b) => a.dist! - b.dist!)
  const mateNow = rated.find((entry) => entry.facts.isMate) ?? null

  let mateEntry: Rated | null = null
  let matePv: string[] | null = null
  let mateIn: number | null = null
  if (mateNow && (!engineMates[0] || engineMates[0].dist! > 1)) {
    mateEntry = mateNow
    matePv = [mateNow.uci]
    mateIn = 1
  } else if (engineMates[0]) {
    mateEntry = rated.find((entry) => entry.uci === engineMates[0].line.pv[0]) ?? null
    matePv = engineMates[0].line.pv
    mateIn = engineMates[0].dist
  }

  const used = new Set<string>()
  if (mateEntry) used.add(mateEntry.uci)
  const comfortable = materialBalance(new Chess(fen), side) >= 5 && enPrise(new Chess(fen), side).length === 0
  const keeps = (entry: Rated) =>
    (best ? keepsWin(entry, best, side) : entry.facts.isMate) ||
    (entry.loss === null && comfortable && entry.hangValue < 3 && entry.badCaptureLoss < 2)
  const unused = () => rated.filter((entry) => !used.has(entry.uci))
  const safe = (entry: Rated) => entry.hangValue < 3 && entry.badCaptureLoss < 2

  const choices: FinishChoice[] = []
  if (mateEntry && matePv) {
    choices.push({ kind: 'mate', entry: mateEntry, keeps: true, mateIn, pv: matePv })
  } else {
    const pool = unused().filter((entry) => keeps(entry))
    const lead = mostRestricting(fen, pool.length > 0 ? pool : unused().filter(safe))
    if (lead) {
      used.add(lead.uci)
      choices.push({ kind: 'restrict', entry: lead, keeps: keeps(lead), mateIn: null, pv: null })
    }
  }

  const practicalPool = unused().filter((entry) => keeps(entry))
  const practical = mostRestricting(fen, practicalPool.length > 0 ? practicalPool : unused().filter(safe))
  if (practical) {
    used.add(practical.uci)
    choices.push({ kind: 'practical', entry: practical, keeps: keeps(practical), mateIn: null, pv: null })
  }

  const slowPool = unused().filter((entry) => keeps(entry))
  let slow = leastRestricting(fen, slowPool)
  let slowKeeps = slow ? keeps(slow) : false
  if (!slow) {
    const fillers = unused().filter(safe)
    const source = fillers.length > 0 ? fillers : unused()
    slow = source.reduce((a, b) => (blunderScore(b, mateIn !== null) >= blunderScore(a, mateIn !== null) ? b : a))
    slowKeeps = false
  }
  if (slow) choices.push({ kind: 'slow', entry: slow, keeps: slowKeeps, mateIn: null, pv: null })
  return { choices, mateIn }
}

/**
 * Three legal moves of mixed quality, the way a ~1200 player looks at a position:
 * one sensible move, one slight inaccuracy, one real mistake (a hang, a bad trade, a missed mate).
 * Continuations are imperfect too – obvious captures are taken, quiet replies are a bit off.
 */
export async function calculate(
  fen: string,
  history: Move[],
  analyze: Analyze,
  isCancelled: () => boolean = () => false,
): Promise<CalcResult | null> {
  const chess = new Chess(fen)
  if (chess.isGameOver()) return null
  const side = chess.turn()
  // chess.js sometimes lists capturing the king; that move has no legal FEN after it.
  const legal = chess.moves({ verbose: true }).filter((move) => move.captured !== 'k')
  if (legal.length === 0) return null

  let root = await analyze(fen, ROOT)
  if (isCancelled()) return null
  let best = root.lines[0] ? lineToScore(root.lines[0], fen) : null
  const mateNow = legal.some((move) => move.san.includes('#'))
  const shortMate = mateDistance(best, side)
  // A longer search is only worth it once the shallow score already looks won, and it has not found a short mate.
  if ((mateNow || isClearlyWinning(best, side, fen)) && !mateNow && (shortMate === null || shortMate > 4)) {
    const deep = await analyze(fen, FINISH)
    if (isCancelled()) return null
    const deepBest = deep.lines[0] ? lineToScore(deep.lines[0], fen) : null
    if (deep.lines.length > 0 && deepBest && (isClearlyWinning(deepBest, side, fen) || mateDistance(deepBest, side) !== null)) {
      root = deep
      best = deepBest
    }
  }
  const lossOf = new Map<string, number>()
  if (best) {
    for (const line of root.lines) {
      if (!line.pv[0]) continue
      lossOf.set(line.pv[0], sideLoss(best, lineToScore(line, fen), side))
    }
  }

  const rated = legal.map((move) => rate(fen, move, history, lossOf.get(toUci(move)) ?? null))
  const sideIsWinningMate = !!best && best.mate !== null && best.mate > 0 && (side === 'w' ? best.cp > 0 : best.cp < 0)
  const missedMate = rated.some((entry) => entry.facts.isMate) || sideIsWinningMate
  const finishOn = mateNow || rated.some((entry) => entry.facts.isMate) || isClearlyWinning(best, side, fen)

  if (finishOn) {
    const { choices, mateIn } = finishChoices(fen, side, rated, root.lines, best)
    const options: CalcOption[] = []
    for (const choice of choices) {
      if (isCancelled()) return null
      let played: PlayedLine | null
      if (choice.pv) {
        const full = await completeMatePv(fen, choice.pv, choice.mateIn ?? mateIn ?? 1, analyze, isCancelled)
        if (full === null) return null
        played = lineFromPv(fen, choice.entry, full)
      } else {
        const punish = !choice.keeps && choice.entry.hangValue + choice.entry.badCaptureLoss >= 1
        played = await followUp(choice.entry, analyze, isCancelled, punish, choice.keeps && choice.kind !== 'slow')
        if (!played) return null
      }
      const base = LABELS[choice.kind]
      const label = !choice.keeps && choice.kind === 'practical'
        ? 'Tah B – slabší'
        : !choice.keeps && choice.kind === 'slow'
          ? 'Tah C – pouští výhru'
          : base.label
      options.push({
        kind: choice.kind,
        letter: base.letter,
        label,
        keeps: choice.keeps,
        san: czSan(choice.entry.move.san),
        uci: choice.entry.uci,
        from: choice.entry.move.from,
        to: choice.entry.move.to,
        loss: choice.entry.loss,
        mover: side,
        explanation: explainFinish(choice.kind, choice.entry, fen, choice.keeps, choice.kind === 'mate' ? mateIn : null),
        ...played,
      })
    }
    const who = side === 'w' ? 'bílého' : 'černého'
    const others = choices.filter((choice) => choice.kind === 'practical' || choice.kind === 'slow')
    const allKeep = others.every((choice) => choice.keeps)
    const noneKeep = others.every((choice) => !choice.keeps)
    const note = !mateIn
      ? allKeep
        ? `Dokonči partii za ${who}. Teď omezuj krále. Druhý návrh je praktické dokončení, třetí je pomalejší, ale pořád vyhrává.`
        : `Dokonči partii za ${who}. Teď omezuj krále. Drž se tahů, které výhodu nepouštějí.`
      : noneKeep
        ? `Dokonči partii za ${who}. Přesná je jen matová cesta – ostatní návrhy mat nedají.`
        : allKeep
          ? `Dokonči partii za ${who}. Matová cesta je přesná. Druhý návrh krále omezí pomaleji a třetí výhru jen drží.`
          : `Dokonči partii za ${who}. Matová cesta je přesná. Alespoň jeden další návrh výhru ještě drží, poslední už ji pouští.`
    return {
      fen,
      side,
      options,
      turnText: side === 'w' ? 'Na tahu je bílý' : 'Na tahu je černý',
      note,
      finish: { title: 'Dokonči partii', mateIn },
    }
  }

  const known = rated.filter((entry) => entry.loss !== null).sort((a, b) => a.loss! - b.loss!)
  const decent = known.filter((entry) => entry.loss! <= GOOD_WINDOW && entry.badCaptureLoss === 0)
  const goodPool = decent.length > 0 ? decent : known.slice(0, 1)
  const good = (goodPool.length > 0 ? goodPool : rated).reduce((a, b) => (naturalScore(b) > naturalScore(a) ? b : a))

  const afterGood = rated.filter((entry) => entry.uci !== good.uci)
  const average = afterGood.length > 0 ? afterGood.reduce((a, b) => (averageRank(b) < averageRank(a) ? b : a)) : null
  const afterAverage = afterGood.filter((entry) => entry.uci !== average?.uci)
  const bad =
    afterAverage.length > 0
      ? afterAverage.reduce((a, b) => (blunderScore(b, missedMate) > blunderScore(a, missedMate) ? b : a))
      : null

  const picked: Array<['good' | 'average' | 'bad', Rated]> = [
    ['good', good],
    ...(average ? [['average', average] as ['average', Rated]] : []),
    ...(bad ? [['bad', bad] as ['bad', Rated]] : []),
  ]

  const options: CalcOption[] = []
  for (const [kind, entry] of picked) {
    if (isCancelled()) return null
    const preview = [entry.uci]
    const previewSan = [czSan(entry.move.san)]
    const branches: CalcBranch[] = []

    if (!new Chess(entry.move.after).isGameOver()) {
      const punish = (entry.loss === null || entry.loss >= 150 || kind === 'bad') && entry.hangValue + entry.badCaptureLoss >= 1
      const grab = punish ? freeCapture(entry.move.after) : null
      let replyUci = grab ? toUci(grab) : null
      let altUci: string | null = null
      let answerUci: string | null = null
      const search = await analyze(entry.move.after, REPLY)
      if (isCancelled()) return null
      const choice = pickReply(search.lines, entry.move.after)
      if (!replyUci && choice) replyUci = choice.main
      if (choice) {
        altUci = choice.alt !== replyUci ? choice.alt : null
        if (!grab) answerUci = choice.answer
      }
      if (grab && !answerUci) {
        const follow = await analyze(grab.after, { depth: 6, movetime: 220, multipv: 2 })
        if (isCancelled()) return null
        answerUci = pickReply(follow.lines, grab.after)?.main ?? null
      }
      const reply = replyUci ? playSan(entry.move.after, replyUci) : null
      if (reply && replyUci) {
        preview.push(replyUci)
        previewSan.push(reply.san)
        const answer = answerUci ? playSan(reply.after, answerUci) : null
        if (answer && answerUci) {
          preview.push(answerUci)
          previewSan.push(answer.san)
        }
        const alt = altUci ? playSan(entry.move.after, altUci) : null
        branches.push({ reply: reply.san, answers: answer ? [answer.san] : [] })
        if (alt && alt.san !== reply.san) branches.push({ reply: alt.san, answers: [] })
      }
    }

    options.push({
      kind,
      ...LABELS[kind],
      san: czSan(entry.move.san),
      uci: entry.uci,
      from: entry.move.from,
      to: entry.move.to,
      loss: entry.loss,
      mover: side,
      explanation: explain(kind, entry, missedMate),
      branches,
      preview,
      previewSan,
    })
  }

  const mateHint = missedMate ? ' V pozici je mat – rozumný tah ho dá, ostatní ho přehlédnou.' : ''
  const turnText = side === 'w' ? 'Na tahu je bílý' : 'Na tahu je černý'
  const who = side === 'w' ? 'bílého' : 'černého'
  return {
    fen,
    side,
    options,
    turnText,
    note: `Hraješ za ${who}. Jeden návrh je rozumný, jeden průměrný a jeden chybný – jako když pozici vidí hráč kolem 1200 Elo.${mateHint}`,
    finish: null,
  }
}

/** "Černý: Jf6 (nebo d6) → bílý: e5" */
export function branchText(option: CalcOption): string {
  const [main, alt] = option.branches
  if (!main) return 'Po tomto tahu partie končí.'
  const other = option.mover === 'w' ? 'Černý' : 'Bílý'
  const self = option.mover === 'w' ? 'bílý' : 'černý'
  const answers = main.answers.length ? ` → ${self}: ${main.answers.join(' / ')}` : ''
  return `${other}: ${main.reply}${alt ? ` (nebo ${alt.reply})` : ''}${answers}`
}
