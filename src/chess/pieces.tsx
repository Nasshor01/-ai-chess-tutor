import { PIECES } from './pieceSet'
import './pieces.css'

/** One piece from the shared set, on a light tile so it stays readable off the board. */
export function PieceIcon({ piece }: { piece: string }) {
  const Glyph = PIECES[piece]
  if (!Glyph) return null
  return (
    <span className="piece-icon">
      <Glyph />
    </span>
  )
}

export function LogoMark() {
  const Knight = PIECES.wN
  return (
    <span className="logo-mark" aria-hidden="true">
      {Knight ? <Knight fill="#fff" /> : null}
    </span>
  )
}
