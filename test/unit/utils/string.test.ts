import { describe, it, expect } from 'vitest'
import {
  excerpt,
  replaceBeforeParens,
  escapeForQBQuery,
  replaceSpecialCharsForQB,
  truncateForQB,
  QBO_ITEM_NAME_MAX_LENGTH,
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

describe('QBO_ITEM_NAME_MAX_LENGTH', () => {
  it('is 95 to provide buffer for suffixes', () => {
    expect(QBO_ITEM_NAME_MAX_LENGTH).toBe(95)
  })
})

describe('truncateForQB', () => {
  describe('without suffix', () => {
    it('returns input unchanged when at or below the 100-char limit', () => {
      const name = 'a'.repeat(100)
      expect(truncateForQB(name)).toBe(name)
      expect(truncateForQB(name)).toHaveLength(100)
    })

    it('returns short strings unchanged', () => {
      expect(truncateForQB('My Product')).toBe('My Product')
    })

    it('truncates with ellipsis at exactly 100 chars', () => {
      const name = 'a'.repeat(101)
      const result = truncateForQB(name)
      expect(result).toHaveLength(100)
      expect(result).toBe('a'.repeat(97) + '...')
    })

    it('truncates long names to 97 chars + ellipsis', () => {
      const name = 'a'.repeat(200)
      const result = truncateForQB(name)
      expect(result).toHaveLength(100)
      expect(result.endsWith('...')).toBe(true)
    })

    it('returns empty string unchanged', () => {
      expect(truncateForQB('')).toBe('')
    })
  })

  describe('with suffix', () => {
    it('returns combined string when within limit', () => {
      const name = 'My Product'
      const result = truncateForQB(name, ' (1)')
      expect(result).toBe('My Product (1)')
    })

    it('preserves suffix and truncates base with ellipsis', () => {
      const name = 'a'.repeat(99)
      const suffix = ' (1)'
      const result = truncateForQB(name, suffix)
      // 100 - 4 (suffix) - 3 (ellipsis) = 93 base chars
      expect(result).toBe('a'.repeat(93) + '...' + ' (1)')
      expect(result).toHaveLength(100)
    })

    it('handles suffix that fits exactly at the limit', () => {
      const name = 'a'.repeat(96)
      const suffix = ' (1)'
      // combined = 96 + 4 = 100, fits exactly
      expect(truncateForQB(name, suffix)).toBe(name + suffix)
      expect(truncateForQB(name, suffix)).toHaveLength(100)
    })

    it('truncates when combined exceeds limit by 1', () => {
      const name = 'a'.repeat(97)
      const suffix = ' (1)'
      // combined = 97 + 4 = 101 > 100
      const result = truncateForQB(name, suffix)
      expect(result).toBe('a'.repeat(93) + '...' + ' (1)')
      expect(result).toHaveLength(100)
    })

    it('handles multi-digit suffix like (10)', () => {
      const name = 'a'.repeat(99)
      const suffix = ' (10)'
      const result = truncateForQB(name, suffix)
      // 100 - 5 (suffix) - 3 (ellipsis) = 92 base chars
      expect(result).toBe('a'.repeat(92) + '...' + ' (10)')
      expect(result).toHaveLength(100)
    })

    it('handles extremely long suffix gracefully via Math.max(0)', () => {
      const name = 'a'.repeat(50)
      const suffix = 'x'.repeat(100)
      const result = truncateForQB(name, suffix)
      // maxBaseLength = max(0, 100 - 100 - 3) = 0
      // result = "" + "..." + suffix = 103 chars
      // NOTE: The 100-char guarantee does not hold when the suffix itself
      // exceeds 97 chars (QBO_ITEM_NAME_LIMIT - ELLIPSIS.length). This is
      // acceptable because real suffixes are " (N)" (4-6 chars).
      expect(result).toBe('...' + suffix)
      expect(result).toHaveLength(103)
    })
  })

  describe('never exceeds 100 chars for realistic suffixes (<= 6 chars)', () => {
    it('result <= 100 chars without suffix', () => {
      for (const len of [1, 50, 99, 100, 101, 150, 500]) {
        const result = truncateForQB('a'.repeat(len))
        expect(result.length).toBeLessThanOrEqual(100)
      }
    })

    it('result <= 100 chars with suffix', () => {
      for (const len of [1, 50, 90, 95, 96, 97, 99, 100, 150]) {
        for (const suffix of [' (1)', ' (2)', ' (10)', ' (99)']) {
          const result = truncateForQB('a'.repeat(len), suffix)
          expect(result.length).toBeLessThanOrEqual(100)
        }
      }
    })
  })

  describe('suffix is always preserved', () => {
    it('output always ends with the suffix when provided', () => {
      for (const len of [1, 50, 96, 97, 99, 150]) {
        for (const suffix of [' (1)', ' (10)', ' (99)']) {
          const result = truncateForQB('a'.repeat(len), suffix)
          expect(result.endsWith(suffix)).toBe(true)
        }
      }
    })
  })
})

describe('replaceSpecialCharsForQB + truncateForQB integration', () => {
  it('sanitize then truncate produces valid QBO item name', () => {
    const longName =
      'My Very Long Product Name With Special Chars {test} & More ' +
      'x'.repeat(80)
    const sanitized = replaceSpecialCharsForQB(longName)
    const result = truncateForQB(sanitized)
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result.endsWith('...')).toBe(true)
  })

  it('sanitize then truncate with suffix preserves suffix', () => {
    const longName = 'Product {variant} '.repeat(10) // '{' and '}' are disallowed
    const sanitized = replaceSpecialCharsForQB(longName)
    expect(sanitized).not.toBe(longName) // confirm sanitize actually mutated it
    const result = truncateForQB(sanitized, ' (3)')
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result.endsWith(' (3)')).toBe(true)
    expect(result).toContain('...')
  })

  it('short name after sanitize is unchanged', () => {
    const name = 'Simple Product'
    const sanitized = replaceSpecialCharsForQB(name)
    expect(truncateForQB(sanitized)).toBe('Simple Product')
  })
})
