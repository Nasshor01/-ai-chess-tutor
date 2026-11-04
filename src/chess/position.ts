import { Chess, DEFAULT_POSITION, type Color, type Square } from 'chess.js'

/** FEN piece letter: white is uppercase. */
export type SetupPiece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
export type Placement = Partial<Record<Square, SetupPiece>>

const FILES = 'abcdefgh'
const RANKS = '87654321'

export const START_FEN = DEFAULT_POSITION

const FEN_ERROR: Record<string, string> = {
  'Invalid FEN: must contain six space-delimited fields': 'FEN musí mít šest částí oddělených mezerou.',
  'Invalid FEN: move number must be a positive integer': 'Číslo tahu musí být kladné celé číslo.',
  'Invalid FEN: half move counter number must be a non-negative integer': 'Počítadlo tahů bez braní musí být nezáporné číslo.',
  'Invalid FEN: en-passant square is invalid': 'Pole pro braní mimochodem není platné.',
  'Invalid FEN: castling availability is invalid': 'Práva na rošádu nejsou platná.',
  'Invalid FEN: side-to-move is invalid': 'Na tahu musí být w (bílý) nebo b (černý).',
  "Invalid FEN: piece data does not contain 8 '/'-delimited rows": 'Rozestavení musí mít osm řad oddělených lomítkem.',
  'Invalid FEN: piece data is invalid (consecutive number)': 'V rozestavení jsou dvě čísla hned za sebou.',
  'Invalid FEN: piece data is invalid (invalid piece)': 'V rozestavení je neznámá figura.',
  'Invalid FEN: piece data is invalid (too many squares in rank)': 'Některá řada nemá přesně osm polí.',
  'Invalid FEN: illegal en-passant square': 'Braní mimochodem nesedí s tím, kdo je na tahu.',
  'Invalid FEN: missing white king': 'Chybí bílý král.',
  'Invalid FEN: missing black king': 'Chybí černý král.',
  'Invalid FEN: too many white kings': 'Bílý král může být jen jeden.',
  'Invalid FEN: too many black kings': 'Černý král může být jen jeden.',
  'Invalid FEN: some pawns are on the edge rows': 'Pěšec nesmí stát na první ani osmé řadě.',
}

export function fenErrorCzech(message: string): string {
  return FEN_ERROR[message] ?? 'Tahle pozice nejde načíst. Zkontroluj FEN.'
}

/** Fills in the side to move and the empty fields when the user pastes only the piece placement. */
export function expandFen(raw: string, fallbackTurn: Color = 'w'): string {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const parts = text.split(' ')
  if (parts.length === 1) return `${parts[0]} ${fallbackTurn} - - 0 1`
  if (parts.length < 6) return [...parts, ...['-', '-', '0', '1'].slice(parts.length - 2)].join(' ')
  return text
}

export function placementFromFen(fen: string): { placement: Placement; turn: Color } | null {
  try {
    const chess = new Chess(fen)
    const placement: Placement = {}
    for (const row of chess.board()) {
      for (const cell of row) {
        if (!cell) continue
        const letter = cell.color === 'w' ? cell.type.toUpperCase() : cell.type
        placement[cell.square] = letter as SetupPiece
      }
    }
    return { placement, turn: chess.turn() }
  } catch {
    return null
  }
}

/** Keeps only castling rights whose king and rook still stand on their home squares. */
export function sanitizeCastling(chess: Chess): string {
  const parts = chess.fen().split(' ')
  const claimed = parts[2]
  let rights = ''
  const home = (square: Square, type: string, color: Color) => {
    const piece = chess.get(square)
    return piece?.type === type && piece.color === color
  }
  if (claimed.includes('K') && home('e1', 'k', 'w') && home('h1', 'r', 'w')) rights += 'K'
  if (claimed.includes('Q') && home('e1', 'k', 'w') && home('a1', 'r', 'w')) rights += 'Q'
  if (claimed.includes('k') && home('e8', 'k', 'b') && home('h8', 'r', 'b')) rights += 'k'
  if (claimed.includes('q') && home('e8', 'k', 'b') && home('a8', 'r', 'b')) rights += 'q'
  parts[2] = rights || '-'
  return parts.join(' ')
}

function kingsTouch(chess: Chess): boolean {
  const kings: Square[] = []
  for (const row of chess.board()) {
    for (const cell of row) if (cell?.type === 'k') kings.push(cell.square)
  }
  if (kings.length < 2) return false
  const [a, b] = kings
  const file = Math.abs(a.charCodeAt(0) - b.charCodeAt(0))
  const rank = Math.abs(Number(a[1]) - Number(b[1]))
  return Math.max(file, rank) <= 1
}

/** True when the side that is NOT to move is in check – that position cannot have just been played. */
function opponentInCheck(chess: Chess): boolean {
  const parts = chess.fen().split(' ')
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  parts[3] = '-'
  try {
    return new Chess(parts.join(' ')).inCheck()
  } catch {
    return false
  }
}

export function inferCastling(placement: Placement): string {
  let rights = ''
  if (placement.e1 === 'K' && placement.h1 === 'R') rights += 'K'
  if (placement.e1 === 'K' && placement.a1 === 'R') rights += 'Q'
  if (placement.e8 === 'k' && placement.h8 === 'r') rights += 'k'
  if (placement.e8 === 'k' && placement.a8 === 'r') rights += 'q'
  return rights || '-'
}

export function fenFromPlacement(placement: Placement, turn: Color): string {
  const ranks: string[] = []
  for (const rank of RANKS) {
    let row = ''
    let empty = 0
    for (const file of FILES) {
      const piece = placement[`${file}${rank}` as Square]
      if (!piece) {
        empty++
        continue
      }
      if (empty) {
        row += empty
        empty = 0
      }
      row += piece
    }
    if (empty) row += empty
    ranks.push(row || '8')
  }
  return `${ranks.join('/')} ${turn} ${inferCastling(placement)} - 0 1`
}

/** A FEN chess.js can play, or a Czech explanation of why not. */
export function playableFen(raw: string, fallbackTurn: Color = 'w'): { fen: string } | { error: string } {
  const expanded = expandFen(raw, fallbackTurn)
  if (!expanded) return { error: 'Vlož FEN, nebo postav na šachovnici oba krále.' }
  try {
    const loaded = new Chess(expanded)
    const fen = sanitizeCastling(loaded)
    const chess = new Chess(fen)
    if (kingsTouch(chess)) return { error: 'Králové nesmí stát na sousedních polích.' }
    if (opponentInCheck(chess)) return { error: 'V šachu je strana, která není na tahu. Přepni, kdo táhne, nebo posuň figuru.' }
    return { fen: chess.fen() }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { error: fenErrorCzech(message) }
  }
}
