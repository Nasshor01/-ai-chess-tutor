import { createElement, type ReactNode } from 'react'
import type { PieceRenderObject } from 'react-chessboard'
import { Bishop, King, Knight, Pawn, Queen, Rook } from './pieces'

type Glyph = (props: { fill: string; stroke: string }) => ReactNode

const WHITE = { fill: '#f7f4ee', stroke: '#1c1916' }
const BLACK = { fill: '#1c1916', stroke: '#d9d3c7' }

function paint(Piece: Glyph, ink: { fill: string; stroke: string }) {
  return function render() {
    return createElement(Piece, ink)
  }
}

/** Board piece map. Kept out of pieces.tsx so that file only exports components. */
export const PIECES: PieceRenderObject = {
  wP: paint(Pawn, WHITE),
  wR: paint(Rook, WHITE),
  wN: paint(Knight, WHITE),
  wB: paint(Bishop, WHITE),
  wQ: paint(Queen, WHITE),
  wK: paint(King, WHITE),
  bP: paint(Pawn, BLACK),
  bR: paint(Rook, BLACK),
  bN: paint(Knight, BLACK),
  bB: paint(Bishop, BLACK),
  bQ: paint(Queen, BLACK),
  bK: paint(King, BLACK),
}
