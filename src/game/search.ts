import { ANALYSIS_DEPTH, ANALYSIS_MOVETIME, ANALYSIS_MULTIPV } from './difficulty'

export const ANALYSIS = { depth: ANALYSIS_DEPTH, movetime: ANALYSIS_MOVETIME, multipv: ANALYSIS_MULTIPV }
// Mate distances need deeper search than general evaluation; shallow results report longer mates.
export const MATE_ANALYSIS = { depth: 18, movetime: 2500, multipv: 1 }
export const MATE_RECHECK = { depth: 24, movetime: 5000, multipv: 1 }
export const MATE_DEFENDER = { skill: 20, depth: 14, movetime: 1500 }
export const MIN_OPPONENT_DELAY = 550
