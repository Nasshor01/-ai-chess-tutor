import { useCallback, useMemo, useState } from 'react'
import { Chessboard, ChessboardProvider, SparePiece, type PieceDropHandlerArgs } from 'react-chessboard'
import type { Color, Square } from 'chess.js'
import {
  START_FEN,
  fenFromPlacement,
  placementFromFen,
  playableFen,
  type Placement,
  type SetupPiece,
} from '../chess/position'
import { PIECES } from '../chess/pieceSet'
import { BOARD_COLORS, type BoardName } from '../ui/appearance'
import { Modal } from './Modal'
import './PositionSetupDialog.css'

interface Props {
  initialFen: string
  board: BoardName
  onConfirm: (fen: string) => void
  onClose: () => void
}

const WHITE = [
  { board: 'wK', fen: 'K' },
  { board: 'wQ', fen: 'Q' },
  { board: 'wR', fen: 'R' },
  { board: 'wB', fen: 'B' },
  { board: 'wN', fen: 'N' },
  { board: 'wP', fen: 'P' },
] as const

const BLACK = [
  { board: 'bK', fen: 'k' },
  { board: 'bQ', fen: 'q' },
  { board: 'bR', fen: 'r' },
  { board: 'bB', fen: 'b' },
  { board: 'bN', fen: 'n' },
  { board: 'bP', fen: 'p' },
] as const

const LABEL: Record<string, string> = {
  wK: 'Bílý král',
  wQ: 'Bílá dáma',
  wR: 'Bílá věž',
  wB: 'Bílý střelec',
  wN: 'Bílý jezdec',
  wP: 'Bílý pěšec',
  bK: 'Černý král',
  bQ: 'Černá dáma',
  bR: 'Černá věž',
  bB: 'Černý střelec',
  bN: 'Černý jezdec',
  bP: 'Černý pěšec',
}

type Tool = string | 'erase' | null

function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value)
}

function toBoardPosition(placement: Placement): Record<string, { pieceType: string }> {
  const position: Record<string, { pieceType: string }> = {}
  for (const [square, piece] of Object.entries(placement)) {
    if (!piece) continue
    const color = piece === piece.toUpperCase() ? 'w' : 'b'
    position[square] = { pieceType: `${color}${piece.toUpperCase()}` }
  }
  return position
}

function boardPiece(pieceType: string): SetupPiece {
  const found = [...WHITE, ...BLACK].find((piece) => piece.board === pieceType)
  return (found?.fen ?? 'P') as SetupPiece
}

export function PositionSetupDialog({ initialFen, board, onConfirm, onClose }: Props) {
  const initial = placementFromFen(initialFen) ?? placementFromFen(START_FEN)!
  const [placement, setPlacement] = useState<Placement>(initial.placement)
  const [turn, setTurn] = useState<Color>(initial.turn)
  const [fenText, setFenText] = useState(initialFen)
  const [tool, setTool] = useState<Tool>(null)

  const parsed = playableFen(fenText, turn)
  const error = 'error' in parsed ? parsed.error : null

  const commit = useCallback(
    (next: Placement, nextTurn: Color = turn) => {
      const fen = fenFromPlacement(next, nextTurn)
      setPlacement(next)
      setTurn(nextTurn)
      setFenText(fen)
    },
    [turn],
  )

  const place = useCallback(
    (square: Square, pieceType: string, from?: Square) => {
      const piece = boardPiece(pieceType)
      const next: Placement = { ...placement }
      if (from && from !== square) delete next[from]
      if (piece === 'K' || piece === 'k') {
        for (const [sq, occupying] of Object.entries(next)) {
          if (occupying === piece) delete next[sq as Square]
        }
      }
      next[square] = piece
      commit(next)
    },
    [commit, placement],
  )

  const clearSquare = useCallback(
    (square: Square) => {
      if (!placement[square]) return
      const next: Placement = { ...placement }
      delete next[square]
      commit(next)
    },
    [commit, placement],
  )

  const onDrop = useCallback(
    ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) {
        if (!piece.isSparePiece && isSquare(sourceSquare)) clearSquare(sourceSquare)
        return true
      }
      if (!isSquare(targetSquare)) return false
      if (piece.isSparePiece) {
        place(targetSquare, piece.pieceType)
        return true
      }
      if (!isSquare(sourceSquare) || sourceSquare === targetSquare) return false
      place(targetSquare, piece.pieceType, sourceSquare)
      return true
    },
    [clearSquare, place],
  )

  const applyText = (text: string) => {
    setFenText(text)
    const result = playableFen(text, turn)
    if ('fen' in result) {
      const loaded = placementFromFen(result.fen)
      if (loaded) {
        setPlacement(loaded.placement)
        setTurn(loaded.turn)
      }
    }
  }

  const setSide = (next: Color) => {
    setTurn(next)
    const current = playableFen(fenText, next)
    const source = 'fen' in current ? current.fen : fenFromPlacement(placement, next)
    const parts = source.split(' ')
    parts[1] = next
    applyText(parts.join(' '))
  }

  const boardOptions = useMemo(
    () => ({
      id: 'setup-board',
      position: toBoardPosition(placement),
      boardOrientation: 'white' as const,
      onPieceDrop: onDrop,
      onSquareClick: ({ square }: { square: string }) => {
        if (!isSquare(square)) return
        if (tool === 'erase') clearSquare(square)
        else if (tool) place(square, tool)
      },
      onSquareRightClick: ({ square }: { square: string }) => {
        if (isSquare(square)) clearSquare(square)
      },
      onPieceClick: ({ isSparePiece, piece }: { isSparePiece: boolean; piece: { pieceType: string } }) => {
        if (isSparePiece) setTool((current) => (current === piece.pieceType ? null : piece.pieceType))
      },
      canDragPiece: () => true,
      allowDragOffBoard: true,
      allowDrawingArrows: false,
      animationDurationInMs: 0,
      pieces: PIECES,
      boardStyle: { borderRadius: '10px', overflow: 'hidden' },
      darkSquareStyle: { backgroundColor: BOARD_COLORS[board].dark },
      lightSquareStyle: { backgroundColor: BOARD_COLORS[board].light },
      darkSquareNotationStyle: { color: BOARD_COLORS[board].notationOnDark, fontWeight: 600 },
      lightSquareNotationStyle: { color: BOARD_COLORS[board].notationOnLight, fontWeight: 600 },
    }),
    [board, clearSquare, onDrop, place, placement, tool],
  )

  return (
    <Modal
      title="Nastavit pozici"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Zrušit
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!!error}
            onClick={() => {
              if ('fen' in parsed) onConfirm(parsed.fen)
            }}
          >
            Načíst do kalkulačky
          </button>
        </>
      }
    >
      <ChessboardProvider options={boardOptions}>
        <div className="setup-pos">
          <div className="setup-pos__board">
            <Chessboard />
          </div>
          <div className="setup-pos__side">
            <p className="setup-pos__hint">
              Přetáhni figuru na pole, nebo ji vyber a klikni. Pravé tlačítko pole smaže. Mimo šachovnici figura zmizí.
            </p>
            <div className="setup-pos__turn" role="group" aria-label="Kdo je na tahu">
              <button type="button" className={turn === 'w' ? 'is-on' : ''} onClick={() => setSide('w')}>
                Bílý na tahu
              </button>
              <button type="button" className={turn === 'b' ? 'is-on' : ''} onClick={() => setSide('b')}>
                Černý na tahu
              </button>
            </div>
            <div className="piece-palette" aria-label="Figury k postavení">
              {[...WHITE, ...BLACK].map((piece) => (
                <div
                  key={piece.board}
                  className={`piece-palette__item ${tool === piece.board ? 'is-selected' : ''}`}
                  title={LABEL[piece.board]}
                >
                  <SparePiece pieceType={piece.board} />
                </div>
              ))}
              <button
                type="button"
                className={`piece-palette__erase ${tool === 'erase' ? 'is-selected' : ''}`}
                aria-pressed={tool === 'erase'}
                onClick={() => setTool((current) => (current === 'erase' ? null : 'erase'))}
              >
                Smazat pole
              </button>
            </div>
            <div className="setup-pos__row">
              <button type="button" className="btn btn--small" onClick={() => commit({})}>
                Vymazat šachovnici
              </button>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  const start = placementFromFen(START_FEN)!
                  setPlacement(start.placement)
                  setTurn('w')
                  setFenText(START_FEN)
                  setTool(null)
                }}
              >
                Výchozí pozice
              </button>
            </div>
            <label className="setup-pos__fen">
              <span>FEN</span>
              <textarea
                value={fenText}
                spellCheck={false}
                rows={3}
                onChange={(event) => applyText(event.target.value)}
              />
            </label>
            {error ? <p className="setup-pos__error">{error}</p> : <p className="setup-pos__ok">Pozici jde načíst.</p>}
          </div>
        </div>
      </ChessboardProvider>
    </Modal>
  )
}
