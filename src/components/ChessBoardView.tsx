import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { HintArrow, MoveInput } from '../game/types'
import './ChessBoardView.css'

interface Props {
  fen: string
  orientation: 'white' | 'black'
  canMove: boolean
  lastMove: Move | null
  inCheck: boolean
  hint: HintArrow | null
  extraArrows?: Array<{ from: string; to: string; color: string }>
  onMove: (move: MoveInput) => boolean
}

const PROMOTION_PIECES: Array<{ piece: PieceSymbol; glyph: string; label: string }> = [
  { piece: 'q', glyph: '♕', label: 'Dáma' },
  { piece: 'r', glyph: '♖', label: 'Věž' },
  { piece: 'b', glyph: '♗', label: 'Střelec' },
  { piece: 'n', glyph: '♘', label: 'Jezdec' },
]

const LAST_MOVE: CSSProperties = { backgroundColor: 'rgba(250, 204, 21, 0.38)' }
const SELECTED: CSSProperties = { backgroundColor: 'rgba(16, 185, 129, 0.5)' }
// Highlights use backgroundColor and move markers use backgroundImage so they can be layered.
const TARGET: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(15, 23, 42, 0.38) 22%, transparent 24%)',
  cursor: 'pointer',
}
const CAPTURE_TARGET: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(15, 23, 42, 0.38) 60%)',
  cursor: 'pointer',
}
const CHECK: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(239, 68, 68, 0.45) 45%, transparent 75%)',
}

export function ChessBoardView({ fen, orientation, canMove, lastMove, inCheck, hint, extraArrows, onMove }: Props) {
  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [selectionFen, setSelectionFen] = useState(fen)

  // Drop the selection whenever the position changes (opponent moved, undo, new game…).
  if (selectionFen !== fen) {
    setSelectionFen(fen)
    setSelected(null)
    setPromotion(null)
  }

  const chess = useMemo(() => new Chess(fen), [fen])
  const targets = useMemo(
    () => (selected && canMove ? chess.moves({ square: selected, verbose: true }) : []),
    [chess, selected, canMove],
  )

  const isPromotion = (from: Square, to: Square) => {
    const piece = chess.get(from)
    if (piece?.type !== 'p') return false
    return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1')
  }

  const tryMove = (from: Square, to: Square): boolean => {
    const legal = chess.moves({ square: from, verbose: true }).some((m) => m.to === to)
    if (!legal) return false
    if (isPromotion(from, to)) {
      setPromotion({ from, to })
      return false
    }
    setSelected(null)
    return onMove({ from, to })
  }

  const handleSquareClick = ({ square, piece }: SquareHandlerArgs) => {
    if (!canMove) return
    const sq = square as Square
    if (selected && targets.some((m) => m.to === sq)) {
      tryMove(selected, sq)
      return
    }
    if (piece?.pieceType.startsWith(chess.turn())) setSelected(sq === selected ? null : sq)
    else setSelected(null)
  }

  const handleDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!canMove || !targetSquare) return false
    return tryMove(sourceSquare as Square, targetSquare as Square)
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (lastMove) {
      styles[lastMove.from] = LAST_MOVE
      styles[lastMove.to] = LAST_MOVE
    }
    if (inCheck) {
      const king = chess
        .board()
        .flat()
        .find((p) => p?.type === 'k' && p.color === chess.turn())
      if (king) styles[king.square] = { ...styles[king.square], ...CHECK }
    }
    if (selected) styles[selected] = { ...styles[selected], ...SELECTED }
    for (const move of targets) {
      styles[move.to] = { ...styles[move.to], ...(move.captured ? CAPTURE_TARGET : TARGET) }
    }
    return styles
  }, [chess, inCheck, lastMove, selected, targets])

  const arrows = useMemo(() => {
    const list = (extraArrows ?? []).map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color }))
    if (hint && !list.some((a) => a.startSquare === hint.from && a.endSquare === hint.to)) {
      list.push({ startSquare: hint.from, endSquare: hint.to, color: 'rgba(16, 185, 129, 0.85)' })
    }
    return list
  }, [extraArrows, hint])

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id: 'tutor-board',
          position: fen,
          boardOrientation: orientation,
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          canDragPiece: ({ piece }) => canMove && piece.pieceType.startsWith(chess.turn()),
          squareStyles,
          arrows,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          animationDurationInMs: 220,
          boardStyle: { borderRadius: '10px', overflow: 'hidden', boxShadow: '0 18px 40px rgba(0,0,0,0.45)' },
          darkSquareStyle: { backgroundColor: '#769656' },
          lightSquareStyle: { backgroundColor: '#eeeed2' },
          darkSquareNotationStyle: { color: '#eeeed2', fontWeight: 600 },
          lightSquareNotationStyle: { color: '#769656', fontWeight: 600 },
        }}
      />

      {promotion && (
        <div className="promotion" role="dialog" aria-label="Výběr proměny pěšce">
          <div className="promotion__panel">
            <p>Na co proměnit pěšce?</p>
            <div className="promotion__choices">
              {PROMOTION_PIECES.map(({ piece, glyph, label }) => (
                <button
                  key={piece}
                  type="button"
                  className="promotion__choice"
                  title={label}
                  onClick={() => {
                    const { from, to } = promotion
                    setPromotion(null)
                    setSelected(null)
                    onMove({ from, to, promotion: piece })
                  }}
                >
                  <span aria-hidden="true">{glyph}</span>
                  <small>{label}</small>
                </button>
              ))}
            </div>
            <button type="button" className="promotion__cancel" onClick={() => setPromotion(null)}>
              Zrušit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
