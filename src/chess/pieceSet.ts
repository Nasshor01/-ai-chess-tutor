import { defaultPieces, type PieceRenderObject } from 'react-chessboard'

/**
 * Swap point for every piece drawing: the board, pawn promotion, captured
 * pieces and the logo all read this map.
 *
 * The drawings are Colin M.L. Burnett's chess pieces (Wikimedia Commons),
 * shipped as the default set of react-chessboard. License: CC BY-SA 3.0.
 * https://creativecommons.org/licenses/by-sa/3.0/
 */
export const PIECES: PieceRenderObject = defaultPieces

export const PIECE_SET_CREDIT = {
  author: 'Colin M.L. Burnett',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  source: 'Výchozí sada react-chessboard (kresby Wikimedia Commons)',
} as const
