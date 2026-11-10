import type { ReactNode } from 'react'
import type { PieceRenderObject } from 'react-chessboard'

/**
 * Original geometric chess pieces drawn for this app.
 * Dedicated to the public domain under CC0 1.0 Universal.
 * https://creativecommons.org/publicdomain/zero/1.0/
 */

function Shape({ fill, stroke, children }: { fill: string; stroke: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 45 45" width="100%" height="100%" aria-hidden="true">
      <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  )
}

function Pawn({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Shape fill={fill} stroke={stroke}>
      <circle cx="22.5" cy="14" r="5.5" />
      <path d="M16 36h13l-2.2-12h-8.6z" />
      <rect x="13" y="36" width="19" height="3.2" rx="1" />
    </Shape>
  )
}

function Rook({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Shape fill={fill} stroke={stroke}>
      <path d="M13 12h4.2v4.2h3.2V12h4.2v4.2h3.2V12H32v7.2H13z" />
      <path d="M15.5 19.2h14v12h-14z" />
      <rect x="12" y="33.5" width="21" height="3.4" rx="1" />
    </Shape>
  )
}

function Bishop({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Shape fill={fill} stroke={stroke}>
      <circle cx="22.5" cy="10" r="3" />
      <path d="M22.5 14.5 15 33h15z" />
      <path d="M22.5 18v9" fill="none" />
      <rect x="13" y="34.5" width="19" height="3.2" rx="1" />
    </Shape>
  )
}

function Knight({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Shape fill={fill} stroke={stroke}>
      <path d="M12 36.5h20l-1.5-7H30l1-6-5-2 1.5-5-4-4-6 3-2 7-4 3 1.5 6H14z" />
      <circle cx="18" cy="18" r="1.2" fill={stroke} stroke="none" />
      <rect x="12" y="36.5" width="21" height="3" rx="1" />
    </Shape>
  )
}

function Queen({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Shape fill={fill} stroke={stroke}>
      <circle cx="11" cy="12" r="2.3" />
      <circle cx="22.5" cy="8.5" r="2.3" />
      <circle cx="34" cy="12" r="2.3" />
      <path d="M10 16.5 15 32h15l5-15.5-6 5-6.5-7-6.5 7z" />
      <rect x="13" y="34" width="19" height="3.2" rx="1" />
    </Shape>
  )
}

function King({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Shape fill={fill} stroke={stroke}>
      <rect x="20.4" y="5" width="4.2" height="11" rx="0.6" />
      <rect x="16" y="8.2" width="13" height="4.2" rx="0.6" />
      <path d="M15 18h15l-2 14H17z" />
      <rect x="13" y="34" width="19" height="3.2" rx="1" />
    </Shape>
  )
}

const WHITE = { fill: '#f7f4ee', stroke: '#1c1916' }
const BLACK = { fill: '#1c1916', stroke: '#d9d3c7' }

function paint(Piece: (props: { fill: string; stroke: string }) => ReactNode, ink: { fill: string; stroke: string }) {
  return function render() {
    return <Piece fill={ink.fill} stroke={ink.stroke} />
  }
}

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

export function PieceIcon({ piece }: { piece: string }) {
  const render = PIECES[piece]
  return render ? render() : null
}

export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <Knight fill="#f7f4ee" stroke="#04241a" />
    </span>
  )
}
