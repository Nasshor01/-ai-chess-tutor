import { describe, expect, it } from 'vitest'
import { applyUci } from '../chess/utils'
import type { StyleMetric, StyleProfile } from '../profile/styleProfile'
import { isWeakProfile, projectProfile, resolveMode } from './modes'
import { createPersonalProvider } from './provider'
import { mulberry32 } from './rng'
import type { PersonalHistory, PersonalLine, PersonalMode } from './types'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const CASTLE = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'
const KNIGHT = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
const NOW = Date.parse('2026-06-01T00:00:00Z')
const DAY = 86_400_000

function metric(id: StyleMetric['id'], value: number | null, samples: number): StyleMetric {
  return { id, label: id, value, samples, explain: id }
}

function profile(values: Partial<Record<StyleMetric['id'], number | null>>, samples = 40): StyleProfile {
  const ids = ['develop', 'castle', 'center', 'capture', 'check'] as const
  return {
    weight: 1,
    metrics: ids.map((id) => metric(id, values[id] === undefined ? 0 : values[id], samples)),
  }
}

function choose(args: {
  fen?: string
  mode?: PersonalMode
  profile?: StyleProfile | null
  snapshots?: Array<{ createdAt: number; profile: StyleProfile }>
  history?: PersonalHistory[]
  lines?: PersonalLine[]
  seed?: number
}) {
  return createPersonalProvider().choose({
    fen: args.fen ?? START,
    mode: args.mode ?? 'today',
    strength: 'match',
    now: NOW,
    profile: args.profile === undefined ? profile({ center: 10 }) : args.profile,
    snapshots: args.snapshots ?? [],
    history: args.history ?? [],
    lines: args.lines ?? [
      { uci: 'e2e4', cp: 30, mate: null },
      { uci: 'd2d4', cp: 20, mate: null },
    ],
    rng: mulberry32(args.seed ?? 1),
  })
}

describe('personal move provider', () => {
  it('returns legal moves whose probabilities sum to 1', () => {
    const result = choose({
      lines: [
        { uci: 'e2e4', cp: 30, mate: null },
        { uci: 'a1a2', cp: 100, mate: null },
        { uci: 'e2e4', cp: 30, mate: null },
      ],
    })
    expect(result.available).toBe(true)
    expect(result.candidates.map((candidate) => candidate.uci)).toEqual(['e2e4'])
    expect(applyUci(START, result.played?.uci ?? '')).not.toBeNull()
    const sum = result.candidates.reduce((total, candidate) => total + candidate.probability, 0)
    expect(Math.round(sum * 1000)).toBe(1000)
  })

  it('repeats a seeded choice and still visits both equal moves', () => {
    const lines = [
      { uci: 'e2e4', cp: 0, mate: null },
      { uci: 'd2d4', cp: 0, mate: null },
    ]
    const first = choose({ lines, seed: 7 })
    const second = choose({ lines, seed: 7 })
    expect(second.played?.uci).toBe(first.played?.uci)
    const seen = new Set<string>()
    for (let seed = 1; seed <= 24; seed += 1) seen.add(choose({ lines, seed }).played?.uci ?? '')
    expect(seen).toEqual(new Set(['e2e4', 'd2d4']))
  })

  it('boosts a move the player has already chosen in the same position', () => {
    const lines = [
      { uci: 'e2e4', cp: 10, mate: null },
      { uci: 'd2d4', cp: 10, mate: null },
    ]
    const plain = choose({ lines, profile: profile({ center: 0 }) })
    const remembered = choose({
      lines,
      profile: profile({ center: 0 }),
      history: [{ placement: START.split(' ')[0] ?? '', fenBefore: START, uci: 'd2d4', mistake: false }],
    })
    const share = (result: typeof plain, uci: string) => result.candidates.find((candidate) => candidate.uci === uci)?.probability ?? 0
    expect(share(remembered, 'd2d4')).toBeGreaterThan(share(plain, 'd2d4'))
    expect(remembered.candidates.find((candidate) => candidate.uci === 'd2d4')?.reason).toContain('podobná pozice z tvých partií')
  })

  it('names a piece capture when that mistake is typical and the capture is worse', () => {
    const history: PersonalHistory[] = [0, 1, 2].map(() => ({
      placement: 'x',
      fenBefore: KNIGHT,
      uci: 'f3e5',
      mistake: true,
    }))
    const result = choose({
      fen: KNIGHT,
      profile: profile({ capture: 0, develop: 0 }),
      history,
      lines: [
        { uci: 'f1c4', cp: 40, mate: null },
        { uci: 'f3e5', cp: -120, mate: null },
      ],
    })
    expect(result.candidates.find((candidate) => candidate.uci === 'f3e5')?.reason).toContain('typická chyba: braní figurou')
    expect(result.candidates.every((candidate) => applyUci(KNIGHT, candidate.uci))).toBe(true)
  })

  it('matches castling to the style, and ignores style when the sample is too small', () => {
    const lines = [
      { uci: 'e2e4', cp: 40, mate: null },
      { uci: 'e1g1', cp: 10, mate: null },
    ]
    const styled = choose({ fen: CASTLE, profile: profile({ castle: 90 }), lines })
    const weak = choose({ fen: CASTLE, profile: profile({ castle: 90 }, 5), lines })
    expect(styled.weakModel).toBe(false)
    expect(styled.candidates.find((candidate) => candidate.uci === 'e1g1')?.reason).toContain('shoda se stylem: rošáda')
    expect(weak.weakModel).toBe(true)
    expect(weak.notice).toContain('málo dat')
    expect(weak.candidates.every((candidate) => !candidate.reason.includes('rošáda'))).toBe(true)
    const castle = (result: typeof styled) => result.candidates.find((candidate) => candidate.uci === 'e1g1')?.probability ?? 0
    expect(castle(styled)).toBeGreaterThan(castle(weak))
  })

  it('keeps month-ago and the training shift unavailable until the snapshots exist', () => {
    const month = choose({ mode: 'month-ago', snapshots: [] })
    expect(month.available).toBe(false)
    expect(month.played).toBeNull()
    expect(month.unavailableReason).toContain('30 dní')

    const recent = choose({
      mode: 'month-ago',
      snapshots: [{ createdAt: NOW - 10 * DAY, profile: profile({ castle: 80 }) }],
    })
    expect(recent.available).toBe(false)

    const old = choose({
      fen: CASTLE,
      mode: 'month-ago',
      profile: profile({ castle: 0 }, 4),
      snapshots: [{ createdAt: NOW - 40 * DAY, profile: profile({ castle: 90 }) }],
      lines: [
        { uci: 'e2e4', cp: 20, mate: null },
        { uci: 'e1g1', cp: 20, mate: null },
      ],
    })
    expect(old.available).toBe(true)
    expect(old.weakModel).toBe(false)
    expect(old.candidates.find((candidate) => candidate.uci === 'e1g1')?.reason).toContain('shoda se stylem: rošáda')

    expect(choose({ mode: 'trained', snapshots: [{ createdAt: NOW, profile: profile({}) }] }).available).toBe(false)
  })

  it('shifts a trained profile by the capped daily trend', () => {
    const older = profile({ develop: 20, castle: null })
    const newer = profile({ develop: 40, castle: null })
    const projected = projectProfile([
      { createdAt: NOW - 10 * DAY, profile: older },
      { createdAt: NOW, profile: newer },
    ])
    expect(projected.metrics.find((item) => item.id === 'develop')?.value).toBe(70)
    expect(projected.metrics.find((item) => item.id === 'castle')?.value).toBeNull()

    const steep = projectProfile([
      { createdAt: NOW - 2 * DAY, profile: profile({ develop: 10 }) },
      { createdAt: NOW, profile: profile({ develop: 90 }) },
    ])
    expect(steep.metrics.find((item) => item.id === 'develop')?.value).toBe(100)

    const trained = resolveMode({
      mode: 'trained',
      now: NOW,
      profile: newer,
      snapshots: [
        { createdAt: NOW - 10 * DAY, profile: older },
        { createdAt: NOW, profile: newer },
      ],
    })
    expect(trained.available).toBe(true)
    expect(trained.profile?.metrics.find((item) => item.id === 'develop')?.value).toBe(70)
    expect(isWeakProfile(null)).toBe(true)
  })
})
