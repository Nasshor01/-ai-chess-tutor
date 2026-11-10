export type ThemeName = 'dark' | 'light'
export type BoardName = 'classic' | 'blue' | 'walnut'

export interface Appearance {
  theme: ThemeName
  board: BoardName
}

export interface BoardColors {
  light: string
  dark: string
  notationOnLight: string
  notationOnDark: string
}

/** Same hex values as the board tokens in src/styles/tokens.css. */
export const BOARD_COLORS: Record<BoardName, BoardColors> = {
  classic: { light: '#f0e4c4', dark: '#3f5828', notationOnLight: '#243318', notationOnDark: '#f4edd8' },
  blue: { light: '#d7e3f3', dark: '#34557e', notationOnLight: '#1a304c', notationOnDark: '#e8f0fa' },
  walnut: { light: '#f0ddc0', dark: '#6a4126', notationOnLight: '#3a2414', notationOnDark: '#f8ecda' },
}

export const BOARD_LABELS: Record<BoardName, string> = {
  classic: 'Klasická',
  blue: 'Modrá',
  walnut: 'Ořech',
}

const KEY = 'ai-chess-tutor:appearance'

function isTheme(value: unknown): value is ThemeName {
  return value === 'dark' || value === 'light'
}

function isBoard(value: unknown): value is BoardName {
  return value === 'classic' || value === 'blue' || value === 'walnut'
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        const record = parsed as { theme?: unknown; board?: unknown }
        if (isTheme(record.theme) && isBoard(record.board)) return { theme: record.theme, board: record.board }
      }
    }
  } catch {
    // Private mode or a broken value. Fall through to the system theme.
  }
  const light = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
  return { theme: light ? 'light' : 'dark', board: 'classic' }
}

export function saveAppearance(value: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // The theme still applies for this visit.
  }
}

export function applyAppearance(value: Appearance): void {
  const root = document.documentElement
  root.dataset.theme = value.theme
  root.dataset.board = value.board
  root.style.colorScheme = value.theme
}
