import { describe, expect, it } from 'vitest'
import { GROUP_ARROW_OPACITY, selectCalculatorArrows, type ArrowOption, type ArrowSelection } from './boardArrows'

const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const options: ArrowOption[] = [
  { letter: 'A', from: 'e2', to: 'e4', kind: 'good' },
  { letter: 'B', from: 'd2', to: 'd4', kind: 'average' },
  { letter: 'C', from: 'g1', to: 'f3', kind: 'bad' },
]

function selection(patch: Partial<ArrowSelection> = {}): ArrowSelection {
  return {
    positionFen: fen,
    resultFen: fen,
    options,
    hovered: null,
    pinned: null,
    showAll: false,
    previewing: false,
    previewArrow: null,
    ...patch,
  }
}

describe('calculator arrow selection', () => {
  it('draws suggestion A before anything is hovered or chosen', () => {
    const arrows = selectCalculatorArrows(selection())
    expect(arrows).toHaveLength(1)
    expect(arrows[0]).toMatchObject({ from: 'e2', to: 'e4' })
  })

  it('replaces A while B is hovered, then returns to A when the pointer leaves', () => {
    const hovered = selectCalculatorArrows(selection({ hovered: 1 }))
    expect(hovered.map((arrow) => arrow.to)).toEqual(['d4'])
    const left = selectCalculatorArrows(selection({ hovered: null }))
    expect(left.map((arrow) => arrow.to)).toEqual(['e4'])
  })

  it('keeps a touched or keyboard choice until another card is chosen', () => {
    expect(selectCalculatorArrows(selection({ pinned: 2 })).map((arrow) => arrow.to)).toEqual(['f3'])
    expect(selectCalculatorArrows(selection({ pinned: 2, hovered: 1 })).map((arrow) => arrow.to)).toEqual(['d4'])
    expect(selectCalculatorArrows(selection({ pinned: 0 })).map((arrow) => arrow.to)).toEqual(['e4'])
  })

  it('draws all three when the switch is on, with the current card stronger and none above 0.6', () => {
    const arrows = selectCalculatorArrows(selection({ showAll: true, hovered: 1 }))
    expect(arrows.map((arrow) => arrow.to)).toEqual(['e4', 'f3', 'd4'])
    for (const arrow of arrows) expect(arrow.opacity ?? 1).toBeLessThanOrEqual(GROUP_ARROW_OPACITY)
    const emphasis = arrows[arrows.length - 1]
    const quiet = arrows.slice(0, -1)
    expect(emphasis?.to).toBe('d4')
    expect(emphasis?.opacity).toBe(GROUP_ARROW_OPACITY)
    for (const arrow of quiet) {
      expect(arrow.opacity).toBeLessThan(emphasis?.opacity ?? 1)
      expect(arrow.strokeWidth).toBeLessThan(emphasis?.strokeWidth ?? 1)
    }
    expect(new Set(arrows.map((arrow) => arrow.color)).size).toBe(3)
  })

  it('drops arrows calculated for a position that is no longer on the board', () => {
    expect(selectCalculatorArrows(selection({ positionFen: '8/8/8/8/8/8/8/4K2k w - - 0 1' }))).toEqual([])
    expect(
      selectCalculatorArrows(
        selection({
          previewing: true,
          previewArrow: null,
        }),
      ),
    ).toEqual([])
  })
})
