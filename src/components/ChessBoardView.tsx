import { useId, useMemo, useState } from 'react'
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js'
import { arrowLine } from '../chess/arrows'
import { highlightStyles } from '../chess/highlights'
import { BOARD_COLORS, type BoardName } from '../ui/appearance'
import { BOARD_ARROWS, MARKER_OUTLINE } from '../ui/markers'
import { PieceIcon } from '../chess/pieces'
import { PIECES } from '../chess/pieceSet'
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
  board: BoardName
  onMove: (move: MoveInput) => boolean
}

const PROMOTION_PIECES: Array<{ piece: PieceSymbol; label: string }> = [
  { piece: 'q', label: 'Dáma' },
  { piece: 'r', label: 'Věž' },
  { piece: 'b', label: 'Střelec' },
  { piece: 'n', label: 'Jezdec' },
]

export function ChessBoardView({ fen, orientation, canMove, lastMove, inCheck, hint, extraArrows, board, onMove }: Props) {
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
    const king = inCheck
      ? chess
          .board()
          .flat()
          .find((piece) => piece?.type === 'k' && piece.color === chess.turn())
      : null
    return highlightStyles({
      lastFrom: lastMove?.from ?? null,
      lastTo: lastMove?.to ?? null,
      selected,
      checkSquare: king?.square ?? null,
      targets: targets.map((move) => ({ to: move.to, captured: Boolean(move.captured) })),
    })
  }, [chess, inCheck, lastMove, selected, targets])

  const drawnArrows = useMemo(() => {
    const list = [...(extraArrows ?? [])]
    if (hint && !list.some((arrow) => arrow.from === hint.from && arrow.to === hint.to)) {
      list.push({ from: hint.from, to: hint.to, color: BOARD_ARROWS.hint })
    }
    return list
  }, [extraArrows, hint])
  const markerPrefix = useId().replace(/:/g, '')

  const colors = BOARD_COLORS[board]
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const side = chess.turn() === 'w' ? 'w' : 'b'

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id: 'tutor-board',
          position: fen,
          boardOrientation: orientation,
          pieces: PIECES,
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          canDragPiece: ({ piece }) => canMove && piece.pieceType.startsWith(chess.turn()),
          squareStyles,
          arrows: [],
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          animationDurationInMs: reduceMotion ? 0 : 220,
          boardStyle: { borderRadius: '10px', overflow: 'hidden', boxShadow: 'var(--shadow)' },
          darkSquareStyle: { backgroundColor: colors.dark },
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareNotationStyle: { color: colors.notationOnDark, fontWeight: 600 },
          lightSquareNotationStyle: { color: colors.notationOnLight, fontWeight: 600 },
        }}
      />
      {drawnArrows.length > 0 && (
        <svg className="board-arrows" viewBox="0 0 8 8" aria-hidden="true">
          <defs>
            {drawnArrows.map((arrow, index) => (
                <marker
                  key={index}
                  id={`${markerPrefix}-${index}`}
                  markerWidth="5"
                  markerHeight="5"
                  refX="1.2"
                  refY="2.5"
                  orient="auto"
                >
                  <path d="M0 0.4 L4.2 2.5 L0 4.6" fill="none" stroke={MARKER_OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M0.4 1.1 L3.4 2.5 L0.4 3.9" fill={arrow.color} stroke={arrow.color} strokeWidth="0.6" strokeLinejoin="round" />
                </marker>
            ))}
          </defs>
          {drawnArrows.map((arrow, index) => {
            const line = arrowLine(arrow.from, arrow.to, orientation)
            return (
              <g key={`${arrow.from}${arrow.to}${index}`}>
                <line x1={line.x} y1={line.y} x2={line.x2} y2={line.y2} stroke={MARKER_OUTLINE} strokeWidth="0.34" strokeLinecap="round" />
                <line
                  x1={line.x}
                  y1={line.y}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={arrow.color}
                  strokeWidth="0.18"
                  strokeLinecap="round"
                  markerEnd={`url(#${markerPrefix}-${index})`}
                />
              </g>
            )
          })}
        </svg>
      )}

      {promotion && (
        <div className="promotion" role="dialog" aria-label="Výběr proměny pěšce">
          <div className="promotion__panel">
            <p>Na co proměnit pěšce?</p>
            <div className="promotion__choices">
              {PROMOTION_PIECES.map(({ piece, label }) => (
                <button
                  key={piece}
                  type="button"
                  className="promotion__choice"
                  aria-label={label}
                  onClick={() => {
                    const { from, to } = promotion
                    setPromotion(null)
                    setSelected(null)
                    onMove({ from, to, promotion: piece })
                  }}
                >
                  <span aria-hidden="true">
                    <PieceIcon piece={`${side}${piece.toUpperCase()}`} />
                  </span>
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
