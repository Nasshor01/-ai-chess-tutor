import { Chess, type Move, type PieceSymbol } from 'chess.js'
import type { EngineLine, EngineResult, Score } from '../engine/types'
import {
  PIECE_VALUE,
  adj,
  applyUci,
  czSan,
  formatLine,
  lineToScore,
  mateInText,
  pieceName,
  pvToSan,
  toUci,
  winChanceFor,
} from '../chess/utils'
import { CONCEPTS, type ConceptId } from './concepts'
import { analyzeMove, materialSwing, type MoveFacts, type PieceOnSquare } from './features'
import { qualityFromLoss, verdictOf } from './classify'
import type { BetterMove, ConceptMention, MoveQuality, TutorComment, Verbosity } from './types'

interface Phrase {
  text: string
  concept?: ConceptId
  issue?: string
}

export interface BookInfo {
  openingName: string
  explanation: string
}

export interface CommentInput {
  plyIndex: number
  fenBefore: string
  move: Move
  history: Move[]
  byUser: boolean
  before: EngineResult | null
  after: EngineResult | null
  book?: BookInfo | null
  verbosity: Verbosity
  conceptSeen: Partial<Record<ConceptId, number>>
}

const say = (byUser: boolean, you: string, opp: string) => (byUser ? you : opp)

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "tvého jezdce" / "soupeřovu věž" / "svou dámu" … */
function owned(owner: 'you' | 'opp' | 'self', piece: PieceSymbol, form: 'nom' | 'acc'): string {
  const fem = adj(piece, 'm', 'f') === 'f'
  const prefix = {
    you: { nom: fem ? 'tvoje' : 'tvůj', acc: fem ? 'tvou' : 'tvého' },
    opp: { nom: fem ? 'soupeřova' : 'soupeřův', acc: fem ? 'soupeřovu' : 'soupeřova' },
    self: { nom: fem ? 'svoje' : 'svůj', acc: fem ? 'svou' : 'svého' },
  }[owner][form]
  return `${prefix} ${pieceName(piece, form)}`
}

function pieceAt(target: PieceOnSquare, owner: 'you' | 'opp' | 'self' | null): string {
  const name = owner ? owned(owner, target.piece, 'acc') : pieceName(target.piece, 'acc')
  return `${name} na ${target.square}`
}

function joinCz(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} a ${parts[parts.length - 1]}`
}

export function materialText(amount: number): string {
  const n = Math.round(Math.abs(amount))
  if (n >= 8) return 'hodně materiálu (zhruba dámu)'
  if (n >= 5) return 'zhruba věž'
  if (n >= 3) return 'figuru'
  if (n === 2) return 'dva pěšce'
  return 'pěšce'
}

/** Positive and negative observations about a move, phrased for the player or the opponent. */
function describeFacts(f: MoveFacts, byUser: boolean): { positives: Phrase[]; negatives: Phrase[] } {
  const positives: Phrase[] = []
  const negatives: Phrase[] = []
  const { move } = f
  const to = move.to

  if (f.castle) {
    positives.push({
      text: say(
        byUser,
        'Rošáda – tvůj král je teď v bezpečí za pěšci a věž se dostává do hry.',
        'Soupeř udělal rošádu: schoval krále a zapojil věž.',
      ),
      concept: 'castling',
    })
  }

  if (f.centerPawn) {
    positives.push({
      text: say(byUser, `Toto je kontrola středu – pěšec na ${to} bere soupeři prostor.`, `Soupeř obsazuje střed pěšcem na ${to}.`),
      concept: 'center',
    })
  }

  if (f.development) {
    const center = f.centerControl > 0
    positives.push({
      text: say(
        byUser,
        `Vyvíjíš ${pieceName(move.piece, 'acc')} na ${to}${center ? ' – odtud navíc kontroluje střed' : ''}.`,
        `Soupeř vyvíjí ${pieceName(move.piece, 'acc')} na ${to}${center ? ' a míří s ním do středu' : ''}.`,
      ),
      concept: 'development',
    })
  } else if (!f.castle && (move.piece === 'n' || move.piece === 'b') && f.centerControl >= 2) {
    positives.push({
      text: say(
        byUser,
        `${capitalize(pieceName(move.piece))} na ${to} pomáhá kontrolovat střed.`,
        `Soupeřův tah ${czSan(move.san)} posiluje jeho kontrolu středu.`,
      ),
      concept: 'center',
    })
  }

  if (f.diagonalFor) {
    const target = f.diagonalFor === 'b' ? 'střelce' : 'dámu'
    positives.push({
      text: say(byUser, `Zároveň otevíráš diagonálu pro ${target}.`, `Soupeř tím otevírá diagonálu pro ${target}.`),
      concept: 'diagonal',
    })
  }

  if (f.rookFile) {
    const kind = f.rookFile.open ? 'otevřený' : 'polootevřený'
    positives.push({
      text: say(
        byUser,
        `Tady se ti otevírá cesta pro věž – sloupec ${f.rookFile.file} je ${kind}.`,
        `Soupeřova věž získává ${kind} sloupec ${f.rookFile.file}.`,
      ),
      concept: 'openFile',
    })
  }

  if (f.seventhRank) {
    positives.push({
      text: say(
        byUser,
        'Věž proniká na sedmou řadu, kde napadá soupeřovy pěšce.',
        'Soupeřova věž pronikla na tvou druhou řadu – hlídej pěšce.',
      ),
      concept: 'seventhRank',
    })
  }

  if (move.promotion) {
    positives.push({
      text: say(
        byUser,
        `Pěšec se proměňuje v ${pieceName(move.promotion, 'acc')}!`,
        `Soupeř proměnil pěšce v ${pieceName(move.promotion, 'acc')}.`,
      ),
      concept: 'promotion',
    })
  } else if (f.passedPawn) {
    positives.push({
      text: say(
        byUser,
        `Tvůj pěšec na ${to} je volný – před sebou nemá žádné soupeřovy pěšce.`,
        `Soupeř má volného pěšce na ${to}. Hlídej ho, ať nedojde na konec.`,
      ),
      concept: 'passedPawn',
    })
  }

  for (const saved of f.saved.slice(0, 1)) {
    const escaped = saved.square === to
    positives.push({
      text: escaped
        ? say(
            byUser,
            `${capitalize(pieceName(saved.piece))} zároveň uniká z ohrožení.`,
            `Soupeř zároveň stáhl ${pieceName(saved.piece, 'acc')} z ohrožení.`,
          )
        : say(byUser, `Zachraňuješ ${pieceAt(saved, 'self')} před ztrátou.`, `Soupeř zachraňuje ${pieceAt(saved, 'self')}.`),
      concept: 'hangingPiece',
    })
  }

  if (f.earlyQueen) {
    negatives.push({
      text: say(
        byUser,
        'Dáma vyrazila hodně brzy – soupeř ji může honit a přitom vyvíjet figury.',
        'Soupeř vytáhl dámu brzy. Zkus ji napadat a přitom vyvíjet své figury.',
      ),
      concept: 'earlyQueen',
      issue: 'earlyQueen',
    })
  }

  if (f.samePieceTwice) {
    negatives.push({
      text: say(
        byUser,
        `Táhneš ${pieceName(move.piece, 'ins')} podruhé, přestože ostatní figury ještě stojí doma.`,
        `Soupeř táhne ${pieceName(move.piece, 'ins')} podruhé a ztrácí čas ve vývinu.`,
      ),
      concept: 'samePieceTwice',
      issue: 'tempo',
    })
  }

  if (f.kingWalk) {
    negatives.push({
      text: say(
        byUser,
        'Král se pohnul a ztratil právo na rošádu – bude se hůř schovávat.',
        'Soupeřův král se pohnul a už nemůže udělat rošádu.',
      ),
      concept: 'kingSafety',
      issue: 'kingSafety',
    })
  }

  if (f.weakensKing) {
    negatives.push({
      text: say(
        byUser,
        `Tah ${czSan(move.san)} oslabuje pěšce, kteří chrání tvého krále.`,
        'Soupeř oslabil pěšce před svým králem – to může být cíl pro útok.',
      ),
      concept: 'kingSafety',
      issue: 'kingSafety',
    })
  }

  if (f.doubledPawns) {
    negatives.push({
      text: say(
        byUser,
        'Bereš pěšcem a vznikají zdvojení pěšci – drobná slabina, i když se otevírá sloupec.',
        'Soupeř má teď zdvojené pěšce – to je dlouhodobá slabina.',
      ),
      concept: 'doubledPawns',
    })
  }

  return { positives, negatives }
}

/** Threats the mover creates with this move. */
function describeThreats(f: MoveFacts, byUser: boolean): Phrase[] {
  const phrases: Phrase[] = []
  const name = pieceName(f.move.promotion ?? f.move.piece)
  if (f.fork) {
    const targets = f.fork.map((t) => (byUser ? pieceName(t.piece, 'acc') : owned('you', t.piece, 'acc')))
    phrases.push({
      text: say(
        byUser,
        `Vidlička! ${capitalize(name)} na ${f.move.to} napadá ${targets.join(' i ')}.`,
        `Pozor, vidlička! Soupeřův tah napadá ${targets.join(' i ')}.`,
      ),
      concept: 'fork',
    })
    return phrases
  }
  if (f.isCheck && !f.isMate) {
    phrases.push({ text: say(byUser, 'Dáváš šach – soupeř musí reagovat.', 'Soupeř ti dává šach.'), concept: 'check' })
  }
  for (const target of f.threats.slice(0, 2)) {
    phrases.push({
      text: say(byUser, `Hrozíš sebrat ${pieceAt(target, null)}.`, `Pozor: hrozí sebrat ${pieceAt(target, 'you')}.`),
      concept: 'threat',
    })
  }
  return phrases
}

/** Short reason why a move (usually the engine's best) is good. Subject = the move. */
export function explainMove(fenBefore: string, move: Move, history: Move[], line: EngineLine | undefined): string {
  const facts = analyzeMove(fenBefore, move, history)
  const mover = move.color
  if (line?.mate && line.mate > 0) {
    return line.mate === 1 ? 'dává mat' : `vede k vynucenému matu (${mateInText(line.mate)})`
  }
  const parts: string[] = []
  const swing = line ? materialSwing(fenBefore, line.pv, mover, 4) : move.captured ? PIECE_VALUE[move.captured] : 0
  if (swing >= 1) parts.push(`získává ${materialText(swing)}`)
  if (facts.fork) parts.push('dává vidličku na dvě figury')
  else if (facts.isCheck) parts.push('dává šach')
  if (!facts.fork && facts.threats.length > 0 && swing < 1) parts.push(`hrozí sebrat ${pieceAt(facts.threats[0], null)}`)
  if (facts.saved.length > 0) parts.push(`zachraňuje ${pieceAt(facts.saved[0], null)}`)
  if (facts.castle) parts.push('schovává krále rošádou')
  if (facts.development) parts.push(`vyvíjí ${pieceName(move.piece, 'acc')}`)
  if (facts.centerPawn || ((move.piece === 'n' || move.piece === 'b') && facts.centerControl >= 2)) parts.push('posiluje kontrolu středu')
  if (facts.rookFile && !facts.castle) parts.push('otevírá cestu věži')
  if (facts.diagonalFor && parts.length < 2) parts.push(`otevírá diagonálu pro ${facts.diagonalFor === 'b' ? 'střelce' : 'dámu'}`)
  if (parts.length === 0) {
    return 'udrží figury lépe sehrané a nedává soupeři žádné protišance'
  }
  return joinCz(parts.slice(0, 2))
}

function moverScore(score: Score, color: Move['color']): { mate: number | null } {
  if (score.mate === null) return { mate: null }
  return { mate: color === 'w' ? score.mate : -score.mate }
}

function headlineFor(quality: MoveQuality, byUser: boolean, book?: BookInfo | null): string {
  switch (quality) {
    case 'book':
      return book?.openingName ? `Přesně podle teorie – ${book.openingName}.` : 'Přesně podle teorie zahájení.'
    case 'best':
      return say(byUser, 'Nejlepší možný tah!', 'Soupeř zahrál nejlepší tah.')
    case 'excellent':
      return say(byUser, 'Výborně!', 'Soupeř zahrál velmi dobře.')
    case 'good':
      return say(byUser, 'Dobrý tah.', 'Solidní tah soupeře.')
    case 'inaccuracy':
      return say(byUser, 'Nepřesnost – šlo to lépe.', 'Soupeř zahrál nepřesně.')
    case 'mistake':
      return say(byUser, 'Chyba.', 'Soupeř udělal chybu!')
    case 'blunder':
      return say(byUser, 'Hrubá chyba!', 'Soupeř hrubě chyboval!')
  }
}

const REASON_LIMIT: Record<Verbosity, number> = { high: 4, medium: 3, low: 2 }
const NEW_CONCEPT_LIMIT: Record<Verbosity, number> = { high: 1, medium: 1, low: 0 }
const EXPLAIN_TIMES: Record<Verbosity, number> = { high: 2, medium: 1, low: 0 }

/** Builds a full tutor comment for a move. Works for both the player's and the opponent's moves. */
export function buildComment(input: CommentInput): TutorComment {
  const { fenBefore, move, history, byUser, before, after, book, verbosity } = input
  const mover = move.color
  const uci = toUci(move)
  const facts = analyzeMove(fenBefore, move, history)
  const moveNumber = facts.moveNumber

  const bestLine = before?.lines[0]
  const evalBest = bestLine ? lineToScore(bestLine, fenBefore) : null
  const playedLine = before?.lines.find((l) => l.pv[0] === uci)

  let evalMove: Score
  if (facts.isMate) evalMove = { cp: mover === 'w' ? 10000 : -10000, mate: 0 }
  else if (after && after.lines.length === 0) evalMove = { cp: 0, mate: null }
  else if (playedLine) evalMove = lineToScore(playedLine, fenBefore)
  else if (after?.lines[0]) evalMove = lineToScore(after.lines[0], move.after)
  else evalMove = evalBest ?? { cp: 0, mate: null }

  const winLoss = evalBest ? Math.max(0, winChanceFor(evalBest, mover) - winChanceFor(evalMove, mover)) : 0
  const isBest = facts.isMate || before?.bestMove === uci
  let quality = qualityFromLoss(winLoss, isBest)
  if (book && winLoss < 6) quality = 'book'
  const verdict = verdictOf(quality)

  const replyPv = after?.lines[0]?.pv ?? []
  const lineSwing = materialSwing(fenBefore, [uci, ...replyPv], mover, 4)
  const reply = replyPv[0] ? applyUci(move.after, replyPv[0]) : null

  const { positives, negatives } = describeFacts(facts, byUser)
  const lead: Phrase[] = []

  if (book) lead.push({ text: book.explanation })

  if (facts.isMate) {
    lead.push({ text: say(byUser, 'Mat! Soupeřův král nemá kam utéct.', 'Soupeř dal mat.') })
  } else if (move.captured) {
    const captured = pieceName(move.captured, 'acc')
    if (lineSwing >= 1) {
      positives.unshift({
        text: say(byUser, `Bereš ${captured} na ${move.to} a získáváš materiál.`, `Soupeř bere ${pieceAt({ square: move.to, piece: move.captured }, 'you')} a získává materiál.`),
        concept: 'material',
      })
    } else if (lineSwing > -1) {
      positives.unshift({
        text: say(
          byUser,
          `Bereš ${captured} – soupeř si materiál vezme zpět, takže jde o výměnu.`,
          `Soupeř bere ${captured} – je to výměna, materiál zůstává vyrovnaný.`,
        ),
        concept: 'trade',
      })
    } else {
      const given = materialText(PIECE_VALUE[move.captured] - lineSwing)
      negatives.unshift({
        text: say(
          byUser,
          `Bereš ${captured}, ale v dalších tazích přijdeš o ${given} – celkově jsi v mínusu.`,
          `Soupeř bere ${captured}, ale tahle výměna se mu nevyplatí – můžeš mu vzít ${given}.`,
        ),
        concept: 'trade',
        issue: 'material',
      })
    }
  }

  const engineMate = moverScore(evalMove, mover).mate
  if (!facts.isMate && engineMate !== null && engineMate < 0 && verdict !== 'good') {
    const line = formatLine(move.after, pvToSan(move.after, replyPv, 5))
    negatives.unshift({
      text: say(byUser, `Tímto tahem dovoluješ soupeři vynucený mat: ${line}.`, `Soupeř přehlédl, že máš vynucený mat: ${line}.`),
      concept: 'mateThreat',
      issue: 'mate',
    })
  } else if (!move.captured && lineSwing <= -1 && verdict !== 'good' && reply) {
    const replySan = czSan(reply.san)
    if (reply.captured && reply.to === move.to) {
      negatives.unshift({
        text: say(
          byUser,
          `${capitalize(owned('you', move.promotion ?? move.piece, 'nom'))} na ${move.to} není dostatečně krytý – soupeř odpoví ${replySan} a získá ${materialText(lineSwing)}.`,
          `Soupeřův tah nechal ${pieceName(move.piece, 'acc')} na ${move.to} bez ochrany – můžeš hrát ${replySan} a získat ${materialText(lineSwing)}.`,
        ),
        concept: 'hangingPiece',
        issue: 'hanging',
      })
    } else if (reply.captured) {
      negatives.unshift({
        text: say(
          byUser,
          `Po tvém tahu může soupeř zahrát ${replySan} a získat ${materialText(lineSwing)}.`,
          `Po soupeřově tahu můžeš zahrát ${replySan} a získat ${materialText(lineSwing)}.`,
        ),
        concept: 'hangingPiece',
        issue: 'hanging',
      })
    } else {
      negatives.unshift({
        text: say(
          byUser,
          `Soupeř má silnou odpověď ${replySan}, po které ztratíš ${materialText(lineSwing)}.`,
          `Proti tomu máš silnou odpověď ${replySan}, po které získáš ${materialText(lineSwing)}.`,
        ),
        concept: 'threat',
        issue: 'tactic',
      })
    }
  } else if (verdict !== 'good' && negatives.length === 0) {
    const bestSwing = bestLine ? materialSwing(fenBefore, bestLine.pv, mover, 4) : 0
    if (bestSwing >= 1) {
      negatives.push({
        text: say(
          byUser,
          `Přehlédl jsi možnost získat ${materialText(bestSwing)}.`,
          `Soupeř přehlédl možnost získat ${materialText(bestSwing)}.`,
        ),
        issue: 'missed',
      })
    } else if (verdict === 'bad') {
      negatives.push({
        text: say(
          byUser,
          'Pozice se ti tímto tahem zhoršila – soupeř teď může převzít iniciativu.',
          'Soupeřova pozice se tímto tahem zhoršila – teď máš šanci převzít iniciativu.',
        ),
        issue: 'positional',
      })
    } else {
      negatives.push({
        text: say(
          byUser,
          'Tah je trochu pasivní – figury mohly stát aktivněji.',
          'Soupeřův tah je trochu pasivní.',
        ),
        issue: 'positional',
      })
    }
  }

  // Rules of thumb (don't move the queen early, don't move a piece twice…) give way to concrete calculation.
  const isPrecise = quality === 'best' || quality === 'excellent'
  const heuristicIssues = new Set(['earlyQueen', 'tempo', 'kingSafety'])
  if (isPrecise && negatives.some((n) => n.issue && heuristicIssues.has(n.issue))) {
    const kept = negatives.filter((n) => !n.issue || !heuristicIssues.has(n.issue))
    negatives.length = 0
    negatives.push(...kept, {
      text: say(
        byUser,
        'Obecná pravidla zahájení by radila něco jiného, ale tady je tohle konkrétně nejpřesnější řešení.',
        'Proti obecným pravidlům, ale v této pozici je to pro soupeře přesné řešení.',
      ),
    })
  }

  const ordered = facts.isMate
    ? lead
    : verdict === 'good'
      ? [...lead, ...positives, ...negatives]
      : [...lead, ...negatives, ...positives]
  const reasonPhrases = ordered.slice(0, REASON_LIMIT[verbosity] + (book ? 1 : 0))
  if (reasonPhrases.length === 0) {
    reasonPhrases.push({
      text:
        quality === 'best' || quality === 'excellent'
          ? say(byUser, 'Klidný, ale přesný tah – přesně tohle by zahrál i silný hráč.', 'Klidný, ale přesný tah soupeře.')
          : say(byUser, 'Solidní tah, který drží pozici v pořádku.', 'Soupeř hraje solidně a drží pozici.'),
    })
  }

  const threatPhrases = facts.isMate ? [] : describeThreats(facts, byUser)
  if (engineMate !== null && engineMate > 0 && !facts.isMate) {
    threatPhrases.unshift({
      text: say(byUser, `Máš vynucený ${mateInText(engineMate)}!`, `Soupeř má vynucený ${mateInText(engineMate)}!`),
      concept: 'mateThreat',
    })
  }

  const against: Phrase[] = []
  const reasonsMentionReply = reasonPhrases.some((p) => p.issue === 'hanging' || p.issue === 'tactic' || p.issue === 'mate')
  if (!facts.isMate && !reasonsMentionReply) {
    if (reply?.san.includes('+') && verbosity !== 'low') {
      against.push({ text: say(byUser, `Soupeř ti může dát šach ${czSan(reply.san)}.`, `Můžeš dát šach ${czSan(reply.san)}.`) })
    }
    const hanging = facts.hangingAfter.filter((h) => !(reply?.captured && reply.to === h.square))
    if (verbosity === 'high') {
      for (const h of hanging.slice(0, 1)) {
        const pronoun = adj(h.piece, 'ho', 'ji')
        against.push({
          text: say(
            byUser,
            `Hlídej ${pieceAt(h, 'self')} – soupeř ${pronoun} napadá a není dost kryt${adj(h.piece, 'ý', 'á')}.`,
            `${capitalize(owned('opp', h.piece, 'nom'))} na ${h.square} je napaden${adj(h.piece, 'ý', 'á')} a málo kryt${adj(h.piece, 'ý', 'á')}.`,
          ),
          concept: 'hangingPiece',
        })
      }
    }
  }

  let better: BetterMove | null = null
  const showMinor = verbosity === 'high' && quality === 'good'
  if (before?.bestMove && before.bestMove !== uci && quality !== 'book' && (verdict !== 'good' || showMinor)) {
    const bestMove = applyUci(fenBefore, before.bestMove)
    if (bestMove) {
      better = {
        san: czSan(bestMove.san),
        uci: before.bestMove,
        explanation: explainMove(fenBefore, bestMove, history, bestLine),
        line: formatLine(fenBefore, pvToSan(fenBefore, bestLine?.pv ?? [], 5)),
        minor: verdict === 'good',
      }
    }
  }

  const concepts = collectConcepts([...reasonPhrases, ...threatPhrases, ...against], input)
  const issues = [...new Set(ordered.map((p) => p.issue).filter((x): x is string => !!x))]
  if (facts.development) issues.push('good:development')
  if (facts.castle) issues.push('good:castling')
  if (facts.centerPawn) issues.push('good:center')

  return {
    plyIndex: input.plyIndex,
    san: czSan(move.san),
    uci,
    color: mover,
    byUser,
    moveNumber,
    quality,
    verdict,
    headline:
      quality === 'good' && positives.length === 0 && negatives.length > 0
        ? say(byUser, 'Dá se hrát, ale pozor.', 'Hratelný tah soupeře, ale má své slabiny.')
        : headlineFor(quality, byUser, book),
    reasons: reasonPhrases.map((p) => p.text),
    better,
    threats: { mine: threatPhrases.map((p) => p.text), against: against.map((p) => p.text) },
    concepts,
    evalAfter: evalMove,
    winLoss,
    issues,
  }
}

function collectConcepts(phrases: Phrase[], input: CommentInput): ConceptMention[] {
  const ids = [...new Set(phrases.map((p) => p.concept).filter((c): c is ConceptId => !!c))]
  let explained = 0
  return ids.map((id) => {
    const seen = input.conceptSeen[id] ?? 0
    const canExplain = input.byUser && seen < EXPLAIN_TIMES[input.verbosity] && explained < NEW_CONCEPT_LIMIT[input.verbosity]
    if (canExplain) explained++
    return { concept: CONCEPTS[id], isNew: seen === 0, showExplanation: canExplain }
  })
}

/** Instant (engine-free) note about the opponent's move. */
export function describeOpponentMove(fenBefore: string, move: Move, history: Move[], verbosity: Verbosity): string {
  const facts = analyzeMove(fenBefore, move, history)
  const { positives, negatives } = describeFacts(facts, false)
  const threats = describeThreats(facts, false)
  const parts: string[] = []

  if (facts.isMate) return 'Soupeř dal mat.'
  if (move.captured) parts.push(`Soupeř bere ${pieceAt({ square: move.to, piece: move.captured }, 'you')}.`)
  const main = positives[0] ?? negatives[0]
  if (main && (verbosity !== 'low' || parts.length === 0)) parts.push(main.text)
  threats.slice(0, verbosity === 'high' ? 2 : 1).forEach((t) => parts.push(t.text))

  // Only flag completely undefended pieces here – without the engine we want to avoid false alarms.
  const board = new Chess(move.after)
  const freePiece = facts.hangingAfter.find((h) => board.attackers(h.square, move.color).length === 0)
  if (freePiece && verbosity !== 'low') {
    parts.push(`${capitalize(owned('opp', freePiece.piece, 'nom'))} na ${freePiece.square} nemá žádnou ochranu – nenabízí se ti něco?`)
  }

  if (parts.length === 0) parts.push('Soupeř hraje klidný, vyčkávací tah.')
  return parts.join(' ')
}
