import type { Color } from 'chess.js'
import type { Score } from '../engine/types'
import type { Concept } from './concepts'

export type MoveQuality = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
export type Verdict = 'good' | 'average' | 'bad'
export type Verbosity = 'high' | 'medium' | 'low'

export interface ConceptMention {
  concept: Concept
  isNew: boolean
  showExplanation: boolean
}

export interface BetterMove {
  san: string
  uci: string
  explanation: string
  /** Engine continuation in Czech notation, e.g. "5. Jf3 Jc6 6. O-O". */
  line: string
  /** True when the played move was fine and this is only a slightly better idea. */
  minor: boolean
}

export interface TutorComment {
  plyIndex: number
  san: string
  uci: string
  color: Color
  byUser: boolean
  moveNumber: number
  quality: MoveQuality
  verdict: Verdict
  headline: string
  reasons: string[]
  better: BetterMove | null
  threats: { mine: string[]; against: string[] }
  concepts: ConceptMention[]
  evalAfter: Score
  /** Lost winning chances in percentage points (0 = perfect move). */
  winLoss: number
  /** Short tag for the post-game summary, e.g. "hanging" or "development". */
  issues: string[]
}

export type TutorMessage =
  | { id: string; kind: 'welcome'; text: string }
  | { id: string; kind: 'info'; text: string; plyIndex?: number; title?: string }
  | { id: string; kind: 'thinking'; plyIndex: number; san: string }
  | { id: string; kind: 'comment'; plyIndex: number; comment: TutorComment; explain?: boolean }
  | { id: string; kind: 'opponent'; plyIndex: number; san: string; text: string }
  | { id: string; kind: 'hint'; plyIndex: number; san: string; text: string; line?: string }
  | { id: string; kind: 'opening'; plyIndex: number; title: string; text: string; tone: 'info' | 'success' | 'warning' }
