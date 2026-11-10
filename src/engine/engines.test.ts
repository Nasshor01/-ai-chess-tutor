import { describe, expect, it } from 'vitest'
import { preferSharedEngine } from './engines'

describe('shared engine', () => {
  it('shares the worker only on a machine with four cores or fewer', () => {
    expect(preferSharedEngine(1)).toBe(true)
    expect(preferSharedEngine(4)).toBe(true)
    expect(preferSharedEngine(5)).toBe(false)
    expect(preferSharedEngine(undefined)).toBe(false)
  })
})
