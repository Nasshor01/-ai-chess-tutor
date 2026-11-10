import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { detectEnd } from './end'

const WHITE_MATED = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
const BLACK_MATED = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'

describe('detectEnd', () => {
  it('keeps a white player’s result and flips it when the player is black', () => {
    expect(detectEnd(new Chess(WHITE_MATED))?.outcome).toBe('loss')
    expect(detectEnd(new Chess(WHITE_MATED), 'b')?.outcome).toBe('win')
    expect(detectEnd(new Chess(BLACK_MATED))?.outcome).toBe('win')
    expect(detectEnd(new Chess(BLACK_MATED), 'b')?.outcome).toBe('loss')
  })
})
