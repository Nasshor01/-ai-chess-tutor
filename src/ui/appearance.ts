import { readKv, writeKv } from '../storage/kv'

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
  classic: { light: '#e4dfd4', dark: '#5f6b58', notationOnLight: '#243028', notationOnDark: '#f6f3ea' },
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

export function parseAppearance(value: unknown): Appearance | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as { theme?: unknown; board?: unknown }
  if (isTheme(record.theme) && isBoard(record.board)) return { theme: record.theme, board: record.board }
  return null
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = parseAppearance(JSON.parse(raw) as unknown)
      if (parsed) return parsed
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

/** IndexedDB wins when it has a saved theme. localStorage is the fallback before that read. */
export async function hydrateAppearance(): Promise<Appearance | null> {
  try {
    return parseAppearance(await readKv(KEY))
  } catch {
    return null
  }
}

export function persistAppearance(value: Appearance): void {
  saveAppearance(value)
  void writeKv(KEY, value).catch(() => undefined)
}

export function applyAppearance(value: Appearance): void {
  const root = document.documentElement
  root.dataset.theme = value.theme
  root.dataset.board = value.board
  root.style.colorScheme = value.theme
}
