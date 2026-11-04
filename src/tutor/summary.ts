import { plural } from '../chess/utils'
import { moveAccuracy } from './classify'
import type { MoveQuality, TutorComment } from './types'

export type GameOutcome = 'win' | 'loss' | 'draw'

export type GameEndReason = 'checkmate' | 'stalemate' | 'repetition' | 'insufficient' | 'fifty' | 'resign'

export interface GameSummary {
  outcome: GameOutcome
  title: string
  subtitle: string
  accuracy: number | null
  counts: Record<MoveQuality, number>
  userMoves: number
  biggestMistake: { label: string; text: string } | null
  bestMoment: { label: string; text: string } | null
  strengths: string[]
  improvements: string[]
  concepts: string[]
  advice: string
}

const IMPROVEMENT_TIPS: Record<string, string> = {
  hanging: 'Občas ti zůstala figura nechráněná. Před každým tahem se zeptej: „Co mi soupeř může sebrat?“',
  material: 'Před výměnou si spočítej, kdo bude mít na daném poli poslední slovo – kolik figur pole napadá a kolik ho kryje.',
  tactic: 'Soupeř měl k dispozici taktické údery. Zkus si vždy projít jeho šachy, braní a hrozby.',
  mate: 'Přehlédl jsi matovou hrozbu. Když je soupeř blízko tvého krále, hledej nejdřív obranu.',
  missed: 'Unikly ti šance získat materiál. Hledej šachy, braní a hrozby i pro sebe – nejen pro soupeře.',
  tempo: 'V zahájení netahej stejnou figurou vícekrát – raději vyvíjej další figury.',
  earlyQueen: 'Dámu jsi vytáhl hodně brzy. Nejdřív vyvíjej jezdce a střelce, dáma přijde na řadu později.',
  kingSafety: 'Dbej na bezpečí krále – udělej včas rošádu a nehýbej zbytečně pěšci před králem.',
  positional: 'Některé tahy byly pasivní. Snaž se stavět figury na pole, odkud kontrolují hodně polí – hlavně střed.',
}

const STRENGTH_TEXT: Record<string, string> = {
  'good:development': 'Pěkně jsi vyvíjel figury.',
  'good:castling': 'Včas jsi schoval krále rošádou.',
  'good:center': 'Bojoval jsi o střed šachovnice.',
}

function resultTexts(outcome: GameOutcome, reason: GameEndReason): { title: string; subtitle: string } {
  if (reason === 'resign') return { title: 'Vzdal jsi partii', subtitle: 'Nevadí – z každé prohry se dá něco naučit.' }
  if (reason === 'checkmate') {
    return outcome === 'win'
      ? { title: 'Vyhrál jsi matem!', subtitle: 'Skvělá práce – soupeřův král neměl kam utéct.' }
      : { title: 'Prohra – soupeř dal mat', subtitle: 'Podívej se níže, kde se partie zlomila.' }
  }
  const drawReason: Record<Exclude<GameEndReason, 'checkmate' | 'resign'>, string> = {
    stalemate: 'Pat – strana na tahu nemá žádný legální tah, ale není v šachu.',
    repetition: 'Trojí opakování pozice.',
    insufficient: 'Na šachovnici nezbyl dost materiálu na mat.',
    fifty: 'Pravidlo 50 tahů – dlouho nikdo nebral ani netáhl pěšcem.',
  }
  return { title: 'Remíza', subtitle: drawReason[reason] }
}

export function buildSummary(comments: TutorComment[], outcome: GameOutcome, reason: GameEndReason): GameSummary {
  const userComments = comments.filter((c) => c.byUser).sort((a, b) => a.plyIndex - b.plyIndex)
  const counts: Record<MoveQuality, number> = { book: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  userComments.forEach((c) => counts[c.quality]++)

  const accuracy = userComments.length
    ? Math.round(userComments.reduce((sum, c) => sum + moveAccuracy(c.winLoss), 0) / userComments.length)
    : null

  const worst = userComments.reduce<TutorComment | null>((acc, c) => (c.winLoss > (acc?.winLoss ?? 5.9) ? c : acc), null)
  const biggestMistake = worst
    ? {
        label: `${worst.moveNumber}. ${worst.san}`,
        text: worst.better
          ? `${worst.reasons[0] ?? ''} Lepší bylo ${worst.better.san} – ${worst.better.explanation}.`.trim()
          : (worst.reasons[0] ?? ''),
      }
    : null

  const highlight = [...userComments]
    .reverse()
    .find((c) => (c.quality === 'best' || c.quality === 'excellent') && (c.threats.mine.length > 0 || c.reasons.some((r) => r.includes('získáváš'))))
  const bestMoment = highlight ? { label: `${highlight.moveNumber}. ${highlight.san}`, text: highlight.reasons[0] ?? highlight.headline } : null

  const issueCounts = new Map<string, number>()
  userComments.forEach((c) => c.issues.forEach((issue) => issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1)))

  const strengths: string[] = []
  const goodMoves = counts.best + counts.excellent + counts.good + counts.book
  if (userComments.length > 0 && goodMoves / userComments.length >= 0.7) {
    strengths.push(`${goodMoves} z ${userComments.length} ${plural(userComments.length, 'tahu', 'tahů', 'tahů')} bylo dobrých nebo výborných.`)
  }
  Object.entries(STRENGTH_TEXT).forEach(([issue, text]) => {
    if (issueCounts.has(issue)) strengths.push(text)
  })
  if (counts.blunder === 0 && userComments.length >= 10) strengths.push('Neudělal jsi ani jednu hrubou chybu.')

  const improvements = [...issueCounts.entries()]
    .filter(([issue]) => IMPROVEMENT_TIPS[issue])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([issue]) => IMPROVEMENT_TIPS[issue])

  const concepts = [...new Set(userComments.flatMap((c) => c.concepts.map((m) => m.concept.title)))]

  let advice: string
  if (outcome === 'win' && (accuracy ?? 0) >= 80) advice = 'Výborná partie! Zkus příště vyšší obtížnost.'
  else if (improvements.length > 0) advice = `Na co se zaměřit příště: ${improvements[0].charAt(0).toLowerCase()}${improvements[0].slice(1)}`
  else if (outcome === 'loss') advice = 'Hraj klidně a kontroluj soupeřovy hrozby – výsledky přijdou.'
  else advice = 'Pěkná partie, jen tak dál!'

  return {
    outcome,
    ...resultTexts(outcome, reason),
    accuracy,
    counts,
    userMoves: userComments.length,
    biggestMistake,
    bestMoment,
    strengths,
    improvements,
    concepts,
    advice,
  }
}
