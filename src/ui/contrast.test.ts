import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BOARD_COLORS, type BoardColors } from './appearance'
import { ARROW_OPACITY, BOARD_ARROWS, HIGHLIGHT_RINGS, MARKER_OUTLINE } from './markers'

function channel(hex: string, shift: number): number {
  const value = parseInt(hex.slice(1), 16)
  const byte = (value >> shift) & 255
  const unit = byte / 255
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 16) + 0.7152 * channel(hex, 8) + 0.0722 * channel(hex, 0)
}

function contrast(a: string, b: string): number {
  const left = luminance(a)
  const right = luminance(b)
  const lighter = Math.max(left, right)
  const darker = Math.min(left, right)
  return (lighter + 0.05) / (darker + 0.05)
}

function blend(square: string, color: string, alpha: number): string {
  const base = parseInt(square.slice(1), 16)
  const ink = parseInt(color.slice(1), 16)
  const mix = (shift: number) => Math.round(((base >> shift) & 255) * (1 - alpha) + ((ink >> shift) & 255) * alpha)
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, '0')).join('')}`
}

function cssVar(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match?.[1]) throw new Error(`missing ${name}`)
  return match[1].toLowerCase()
}

describe('design tokens', () => {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')

  it('keeps the board colors in the stylesheet and in the theme module the same', () => {
    for (const [name, colors] of Object.entries(BOARD_COLORS) as Array<[string, BoardColors]>) {
      const block = css.split(`data-board='${name}'`)[1]?.split('}')[0] ?? ''
      expect(cssVar(block, '--board-light')).toBe(colors.light)
      expect(cssVar(block, '--board-dark')).toBe(colors.dark)
      expect(cssVar(block, '--board-notation-on-light')).toBe(colors.notationOnLight)
      expect(cssVar(block, '--board-notation-on-dark')).toBe(colors.notationOnDark)
    }
  })

  it('meets WCAG AA for text on the page and for square notation', () => {
    const dark = css.split(":root[data-theme='light']")[0] ?? ''
    const light = css.split(":root[data-theme='light']")[1]?.split(":root[data-board")[0] ?? ''
    for (const block of [dark, light]) {
      expect(contrast(cssVar(block, '--text'), cssVar(block, '--bg'))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(cssVar(block, '--text-muted'), cssVar(block, '--bg'))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(cssVar(block, '--text'), cssVar(block, '--surface'))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(cssVar(block, '--on-accent'), cssVar(block, '--accent'))).toBeGreaterThanOrEqual(4.5)
    }
    for (const colors of Object.values(BOARD_COLORS)) {
      expect(contrast(colors.notationOnLight, colors.light)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(colors.notationOnDark, colors.dark)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps translucent arrows visible on every light and dark square', () => {
    for (const colors of Object.values(BOARD_COLORS)) {
      for (const fill of Object.values(BOARD_ARROWS)) {
        expect(contrast(blend(colors.light, fill, ARROW_OPACITY), colors.light)).toBeGreaterThanOrEqual(1.55)
        expect(contrast(blend(colors.dark, fill, ARROW_OPACITY), colors.dark)).toBeGreaterThanOrEqual(1.55)
      }
    }
  })

  it('keeps highlight rings readable on dark squares and the outline readable on light squares', () => {
    for (const colors of Object.values(BOARD_COLORS)) {
      for (const fill of Object.values(HIGHLIGHT_RINGS)) {
        expect(contrast(fill, colors.dark)).toBeGreaterThanOrEqual(3)
      }
      expect(contrast(MARKER_OUTLINE, colors.light)).toBeGreaterThanOrEqual(3)
    }
  })
})
