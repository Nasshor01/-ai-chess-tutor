import { Chess, type Move, type Square } from 'chess.js'
import type { EngineLine, EngineResult, Score } from '../engine/types'
import { applyUci, czSan, formatScore, lineToScore, mateInText, pieceName, winChanceFor } from '../chess/utils'
import { analyzeMove, relativeRank } from '../tutor/features'
import type { TutorComment } from '../tutor/types'
import type { PlyRecord } from '../game/types'

export type PlayStyle = 'aggressive' | 'solid' | 'neutral'
export type OptionKind = 'options' | 'tactical' | 'safe'

export interface StyleProfile {
  style: PlayStyle
  label: string
  text: string
}

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
  score: Score
  scoreText: string
  explanation: string
  branches: CalcBranch[]
  /** Candidate move, the main reply and a short follow-up, in UCI – used for the board preview. */
  preview: string[]
  /** Preview moves in Czech SAN (same length as `preview`). */
  previewSan: string[]
  goodFollowUps: number
  recommended: boolean
}

export interface CalcResult {
  fen: string
  options: CalcOption[]
  style: StyleProfile
  note: string | null
}

export type Analyze = (fen: string, options: { depth: number; movetime?: number; multipv?: number }) => Promise<EngineResult>

const ROOT = { depth: 12, movetime: 1500, multipv: 6 }
const REPLIES = { depth: 10, movetime: 500, multipv: 3 }
const FOLLOW_UPS = { depth: 9, movetime: 400, multipv: 4 }
const MAX_CANDIDATES = 5
/** Follow-ups within this many centipawns of the best one count as "good practical choices". */
const FOLLOW_UP_WINDOW = 40
const REPLY_WINDOW = 60

const LABELS: Record<OptionKind, { letter: CalcOption['letter']; label: string }> = {
  options: { letter: 'A', label: 'Tah A – více možností' },
  tactical: { letter: 'B', label: 'Tah B – agresivní / taktický' },
  safe: { letter: 'C', label: 'Tah C – bezpečný' },
}

const STYLES: Record<PlayStyle, StyleProfile> = {
  aggressive: {
    style: 'aggressive',
    label: 'Útočný styl',
    text: 'Hraješ aktivně a nebojíš se komplikací, proto upřednostňuji taktické varianty a tahy s mnoha možnostmi.',
  },
  solid: {
    style: 'solid',
    label: 'Solidní styl',
    text: 'Hraješ klidně a pevně, proto doporučuji bezpečnou variantu. Aktivnější volby ti ale ukážu taky.',
  },
  neutral: {
    style: 'neutral',
    label: 'Vyvážený styl',
    text: 'Doporučuji tah, po kterém budeš mít nejvíc dobrých pokračování.',
  },
}

const RECOMMENDED: Record<PlayStyle, OptionKind> = { aggressive: 'tactical', solid: 'safe', neutral: 'options' }

/** Reads the player's style from the current game: checks, captures, raids and offbeat moves vs. calm development. */
export function detectStyle(plies: PlyRecord[], comments: Record<number, TutorComment>): StyleProfile {
  const own = plies.filter((p) => p.byUser)
  if (own.length < 3) return { ...STYLES.neutral, text: `Zatím jsi zahrál málo tahů na odhad stylu. ${STYLES.neutral.text}` }
  let aggressive = 0
  let solid = 0
  for (const ply of own) {
    const { move } = ply
    const comment = comments[ply.index]
    const rank = Number(move.to[1])
    if (move.san.includes('+')) aggressive += 1
    if (move.captured) aggressive += 0.5
    if (move.piece !== 'p' && move.piece !== 'k' && rank >= 5) aggressive += 0.5
    if (move.piece === 'p' && 'fgh'.includes(move.to[0]) && rank >= 4 && ply.index > 8) aggressive += 0.75
    if (move.piece === 'q' && ply.index < 16) aggressive += 0.75
    if (comment && comment.quality !== 'book' && comment.winLoss >= 6 && (move.captured || move.san.includes('+'))) aggressive += 1
    if (comment && (comment.quality === 'inaccuracy' || comment.quality === 'mistake') && !move.captured) aggressive += 0.25
    if (move.san.startsWith('O-O')) solid += 1.5
    if (comment?.issues.includes('good:development')) solid += 0.5
    if (comment?.quality === 'book') solid += 0.3
    if (!move.captured && !move.san.includes('+') && move.piece !== 'q' && rank <= 4) solid += 0.4
  }
  const a = aggressive / own.length
  const s = solid / own.length
  if (a >= 0.4 && a >= s * 0.8) return STYLES.aggressive
  if (s >= 0.5 && a < 0.3) return STYLES.solid
  return STYLES.neutral
}

interface Candidate {
  line: EngineLine
  move: Move
  score: Score
  loss: number
  replies: { move: Move; answer: Move | null }[]
  followUps: Move[]
  goodFollowUps: number
  preview: string[]
  metrics: Record<OptionKind, number>
  notes: Record<OptionKind, string[]>
}

function lossThreshold(style: PlayStyle): number {
  return style === 'aggressive' ? 14 : style === 'solid' ? 7 : 10
}

function kingSquare(chess: Chess, color: 'w' | 'b'): Square | null {
  for (const row of chess.board()) for (const cell of row) if (cell?.type === 'k' && cell.color === color) return cell.square
  return null
}

function distance(a: Square, b: Square): number {
  return Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])))
}

function neighbours(square: Square): Square[] {
  const result: Square[] = []
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const file = square.charCodeAt(0) + df
      const rank = Number(square[1]) + dr
      if ((df || dr) && file >= 97 && file <= 104 && rank >= 1 && rank <= 8) result.push(`${String.fromCharCode(file)}${rank}` as Square)
    }
  }
  return result
}

/** Number of legal White moves in the position, as if it were White's turn. */
function whiteMobility(fen: string): number {
  const parts = fen.split(' ')
  parts[1] = 'w'
  parts[3] = '-'
  try {
    return new Chess(parts.join(' ')).moves().length
  } catch {
    return 0
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

async function expand(fen: string, line: EngineLine, rootScore: Score, history: Move[], analyze: Analyze): Promise<Candidate | null> {
  const move = applyUci(fen, line.pv[0])
  if (!move) return null
  const score = lineToScore(line, fen)
  const loss = Math.max(0, winChanceFor(rootScore, 'w') - winChanceFor(score, 'w'))
  const afterBoard = new Chess(move.after)
  const facts = analyzeMove(fen, move, history)

  const replies: Candidate['replies'] = []
  let followUps: Move[] = []
  let goodFollowUps = 0
  let preview = line.pv.slice(0, 4)

  if (!afterBoard.isGameOver()) {
    const replyResult = await analyze(move.after, REPLIES)
    const best = replyResult.lines[0]
    const whiteCp = (l: EngineLine) => lineToScore(l, move.after).cp
    for (const l of replyResult.lines.slice(0, 2)) {
      if (best && l !== best && whiteCp(l) - whiteCp(best) > REPLY_WINDOW) continue
      const reply = applyUci(move.after, l.pv[0])
      if (!reply) continue
      replies.push({ move: reply, answer: l.pv[1] ? applyUci(reply.after, l.pv[1]) : null })
    }
    const main = replies[0]?.move
    if (main && !new Chess(main.after).isGameOver()) {
      const follow = await analyze(main.after, FOLLOW_UPS)
      const top = follow.lines[0] ? lineToScore(follow.lines[0], main.after).cp : 0
      const good = follow.lines.filter((l) => top - lineToScore(l, main.after).cp <= FOLLOW_UP_WINDOW)
      goodFollowUps = good.length
      followUps = good.map((l) => applyUci(main.after, l.pv[0])).filter((m): m is Move => !!m)
      if (follow.lines[0]) preview = [line.pv[0], main.lan, ...follow.lines[0].pv.slice(0, 3)]
    }
  }

  const blackKing = kingSquare(afterBoard, 'b')
  const nearKing = blackKing ? distance(move.to, blackKing) <= 2 : false
  const kingZone = blackKing ? [blackKing, ...neighbours(blackKing)] : []
  const kingPressure = kingZone.filter((sq) => afterBoard.attackers(sq, 'w').includes(move.to)).length
  const attacked = afterBoard
    .board()
    .flat()
    .filter((cell) => cell && cell.color === 'b' && cell.type !== 'k' && afterBoard.attackers(cell.square, 'w').includes(move.to))
  const advance = relativeRank(move.to, 'w') - relativeRank(move.from, 'w')
  const pawnStorm = move.piece === 'p' && !!blackKing && Math.abs(move.to.charCodeAt(0) - blackKing.charCodeAt(0)) <= 1 && advance > 0
  const mobilityGain = whiteMobility(move.after) - whiteMobility(fen)
  const forcing = replies.length <= 1 && !afterBoard.isGameOver()
  const legalAfterReply = replies[0] ? new Chess(replies[0].move.after).moves().length : 0
  const replyIsAggressive = replies.some((r) => r.move.captured || r.move.san.includes('+'))

  const tacticalNotes: string[] = []
  if (score.mate !== null && score.mate > 0) tacticalNotes.push(`vede k vynucenému matu (${mateInText(score.mate)})`)
  if (facts.fork) tacticalNotes.push('dává vidličku')
  else if (facts.isCheck) tacticalNotes.push('dává šach a bere soupeři iniciativu')
  if (move.captured) tacticalNotes.push(`bere ${pieceName(move.captured, 'acc')}`)
  if (facts.threats.length > 0 && !facts.fork) tacticalNotes.push(`hrozí sebrat ${pieceName(facts.threats[0].piece, 'acc')} na ${facts.threats[0].square}`)
  if (!facts.isCheck && (kingPressure >= 2 || nearKing)) tacticalNotes.push('míří na soupeřova krále')
  else if (pawnStorm) tacticalNotes.push('pěšcem otevírá útok na krále')
  if (facts.threats.length === 0 && attacked[0] && !move.captured) {
    tacticalNotes.push(`napadá ${pieceName(attacked[0].type, 'acc')} na ${attacked[0].square}`)
  }
  if (forcing) tacticalNotes.push('soupeř má v podstatě jedinou dobrou odpověď')

  const safeNotes: string[] = []
  if (facts.castle) safeNotes.push('schovává krále rošádou')
  if (facts.development) safeNotes.push(`vyvíjí ${pieceName(move.piece, 'acc')}`)
  if (facts.saved.length > 0) safeNotes.push(`kryje ${pieceName(facts.saved[0].piece, 'acc')} na ${facts.saved[0].square}`)
  if (facts.hangingAfter.length === 0) safeNotes.push('nic ti nevisí')
  if (!replyIsAggressive) safeNotes.push('soupeř nemá žádné nepříjemné šachy ani braní')

  const optionNotes: string[] = []
  if (facts.centerPawn || facts.centerControl >= 2) optionNotes.push('posiluje střed')
  if (facts.development && !facts.castle) optionNotes.push(`zapojuje ${pieceName(move.piece, 'acc')}`)
  if (facts.rookFile) optionNotes.push('otevírá cestu věži')

  return {
    line,
    move,
    score,
    loss,
    replies,
    followUps,
    goodFollowUps,
    preview,
    metrics: {
      options:
        goodFollowUps * 1.5 +
        Math.min(legalAfterReply, 40) / 20 +
        Math.max(-3, Math.min(mobilityGain, 8)) / 3 -
        loss / 3 +
        optionNotes.length * 0.4,
      tactical:
        (facts.isCheck ? 2 : 0) +
        (move.captured ? 1.5 : 0) +
        (facts.fork ? 3 : 0) +
        facts.threats.length +
        (nearKing ? 1 : 0) +
        kingPressure * 0.75 +
        attacked.length * 0.5 +
        (pawnStorm ? 0.75 : 0) +
        (advance > 0 && relativeRank(move.to, 'w') >= 5 ? 0.5 : 0) +
        (forcing ? 1 : 0) +
        (score.mate !== null && score.mate > 0 ? 5 : 0) -
        loss / 6,
      safe:
        (facts.hangingAfter.length === 0 ? 2 : -2) +
        (replyIsAggressive ? -1.5 : 1) +
        (facts.castle ? 1.5 : 0) +
        (facts.development ? 0.5 : 0) +
        facts.saved.length -
        (facts.isCheck || move.captured ? 0.5 : 0) -
        loss / 3,
    },
    notes: { options: optionNotes, tactical: tacticalNotes, safe: safeNotes },
  }
}

function explain(kind: OptionKind, c: Candidate, best: Candidate): string {
  const parts: string[] = []
  if (kind === 'options') {
    const reply = c.replies[0] ? czSan(c.replies[0].move.san) : null
    if (reply && c.goodFollowUps >= 2) {
      parts.push(`Po ${reply} máš ${c.goodFollowUps} rovnocenná pokračování, takže soupeř nemůže předvídat, co zahraješ.`)
    } else if (reply) {
      parts.push(`Po ${reply} zůstává hra otevřená a máš z čeho vybírat.`)
    }
    if (c.notes.options.length) parts.push(`${capitalize(c.notes.options.slice(0, 2).join(' a '))}.`)
  } else if (kind === 'tactical') {
    if (c.notes.tactical.length) parts.push(`${capitalize(c.notes.tactical.slice(0, 2).join(' a '))}.`)
    else parts.push('Přímou taktiku pozice zatím nenabízí – tohle je nejaktivnější z rozumných tahů a připravuje další akci.')
  } else {
    const notes = c.notes.safe.slice(0, 2)
    parts.push(notes.length ? `${capitalize(notes.join(' a '))}.` : 'Klidný tah, který nic neriskuje.')
    parts.push('Pozice zůstane pevná.')
  }
  if (c !== best && c.loss >= 3) parts.push('Podle enginu o kousek slabší než nejpřesnější tah, ale prakticky dobře hratelný.')
  else if (c === best) parts.push('Zároveň je to nejpřesnější tah enginu.')
  return parts.join(' ')
}

/**
 * Picks 2–3 practical candidate moves (not just the engine's top choice) and sketches a short branch for each.
 * `analyze` is injected so the same logic runs on the browser worker and in Node tests.
 */
export async function calculate(
  fen: string,
  history: Move[],
  style: StyleProfile,
  analyze: Analyze,
  isCancelled: () => boolean = () => false,
): Promise<CalcResult | null> {
  const root = await analyze(fen, ROOT)
  if (isCancelled() || root.lines.length === 0) return null
  const rootScore = lineToScore(root.lines[0], fen)
  const winningMate = rootScore.mate !== null && rootScore.mate > 0
  const threshold = lossThreshold(style.style)

  const eligible = root.lines.filter((l) => {
    const score = lineToScore(l, fen)
    if (winningMate) return score.mate !== null && score.mate > 0
    return winChanceFor(rootScore, 'w') - winChanceFor(score, 'w') <= threshold
  })

  const candidates: Candidate[] = []
  for (const line of eligible.slice(0, MAX_CANDIDATES)) {
    const candidate = await expand(fen, line, rootScore, history, analyze)
    if (isCancelled()) return null
    if (candidate) candidates.push(candidate)
  }
  if (candidates.length === 0) return null
  const best = candidates[0]

  const order: OptionKind[] = style.style === 'aggressive' ? ['tactical', 'options', 'safe'] : style.style === 'solid' ? ['safe', 'options', 'tactical'] : ['options', 'tactical', 'safe']
  const picked = new Map<OptionKind, Candidate>()
  for (const kind of order) {
    const pool = candidates.filter((c) => ![...picked.values()].includes(c))
    if (pool.length === 0) break
    const choice = pool.reduce((a, b) => (b.metrics[kind] > a.metrics[kind] ? b : a))
    picked.set(kind, choice)
  }

  const recommendedKind = picked.has(RECOMMENDED[style.style]) ? RECOMMENDED[style.style] : order[0]
  const options: CalcOption[] = (['options', 'tactical', 'safe'] as OptionKind[])
    .filter((kind) => picked.has(kind))
    .map((kind) => {
      const c = picked.get(kind)!
      const previewSan: string[] = []
      const board = new Chess(fen)
      const preview: string[] = []
      for (const uci of c.preview) {
        try {
          const m = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
          previewSan.push(czSan(m.san))
          preview.push(uci)
        } catch {
          break
        }
      }
      return {
        kind,
        ...LABELS[kind],
        san: czSan(c.move.san),
        uci: c.line.pv[0],
        from: c.move.from,
        to: c.move.to,
        score: c.score,
        scoreText: formatScore(c.score),
        explanation: explain(kind, c, best),
        branches: c.replies.map((r, i) => ({
          reply: czSan(r.move.san),
          answers: (i === 0 && c.followUps.length ? c.followUps.slice(0, 2) : r.answer ? [r.answer] : []).map((m) => czSan(m.san)),
        })),
        preview,
        previewSan,
        goodFollowUps: c.goodFollowUps,
        recommended: kind === recommendedKind,
      }
    })

  let note: string | null = null
  if (winningMate) {
    note = options.length === 1 ? 'Máš vynucený mat! Vede k němu jediný tah.' : 'Máš vynucený mat! Všechny varianty níže k němu vedou.'
  } else if (options.length === 1) {
    note = 'V této pozici je jen jeden rozumný tah – ostatní by výrazně zhoršily pozici.'
  }
  return { fen, options, style, note }
}

/** "Soupeř: Jf6 (nebo d5) → ty: e5 / Jc3" */
export function branchText(option: CalcOption): string {
  const [main, alt] = option.branches
  if (!main) return 'Po tomto tahu partie končí.'
  const answers = main.answers.length ? ` → ty: ${main.answers.join(' / ')}` : ''
  return `Soupeř: ${main.reply}${alt ? ` (nebo ${alt.reply})` : ''}${answers}`
}
