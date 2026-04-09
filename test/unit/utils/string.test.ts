import { describe, it, expect } from 'vitest'
import {
  excerpt,
  replaceBeforeParens,
  escapeForQBQuery,
  replaceSpecialCharsForQB,
} from '@/utils/string'

describe('excerpt', () => {
  it('returns original string when shorter than limit', () => {
    expect(excerpt('hello', 10)).toBe('hello')
  })

  it('returns original string when exactly at limit', () => {
    expect(excerpt('hello', 5)).toBe('hello')
  })

  it('truncates and appends ellipsis when longer than limit', () => {
    expect(excerpt('hello world', 5)).toBe('hello...')
  })
})

describe('replaceBeforeParens', () => {
  it('replaces text before parenthesized number', () => {
    expect(replaceBeforeParens('Old Name (42)', 'New Name')).toBe(
      'New Name (42)',
    )
  })

  it('replaces entire string when no parenthesized number', () => {
    expect(replaceBeforeParens('Old Name', 'New Name')).toBe('New Name')
  })

  it('handles extra whitespace before parens', () => {
    expect(replaceBeforeParens('Old Name   (7)', 'New Name')).toBe(
      'New Name (7)',
    )
  })
})

describe('escapeForQBQuery', () => {
  it('escapes single quotes', () => {
    expect(escapeForQBQuery("O'Brien")).toBe("O\\'Brien")
  })

  it('escapes multiple single quotes', () => {
    expect(escapeForQBQuery("it's a 'test'")).toBe("it\\'s a \\'test\\'")
  })

  it('returns string unchanged when no single quotes', () => {
    expect(escapeForQBQuery('hello world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(escapeForQBQuery('')).toBe('')
  })
})

describe('replaceSpecialCharsForQB', () => {
  it('keeps alphanumeric characters', () => {
    expect(replaceSpecialCharsForQB('Hello123')).toBe('Hello123')
  })

  it('keeps allowed special characters', () => {
    const allowed = ",?@&!'*()_;+#~.- "
    expect(replaceSpecialCharsForQB(allowed)).toBe(allowed)
  })

  it('replaces disallowed characters with hyphen', () => {
    expect(replaceSpecialCharsForQB('Hello{World}')).toBe('Hello-World-')
  })

  it('replaces consecutive disallowed characters with single hyphen', () => {
    expect(replaceSpecialCharsForQB('Hello$$World')).toBe('Hello-World')
  })

  it('handles unicode/emoji characters', () => {
    expect(replaceSpecialCharsForQB('Cafe\u0301')).toBe('Cafe-')
  })

  it('returns empty string unchanged', () => {
    expect(replaceSpecialCharsForQB('')).toBe('')
  })
})
