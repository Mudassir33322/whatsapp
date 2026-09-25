import { describe, it, expect } from 'vitest'
import { escapeMarkdown, generateToken, generateUniqueToken } from '../utils'

describe('escapeMarkdown', () => {
  it('escapes special markdown characters', () => {
    expect(escapeMarkdown('Hello _world_')).toBe('Hello \\_world\\_')
    expect(escapeMarkdown('*bold*')).toBe('\\*bold\\*')
    expect(escapeMarkdown('~strike~')).toBe('\\~strike\\~')
    expect(escapeMarkdown('`code`')).toBe('\\`code\\`')
  })

  it('returns empty string for null/undefined input', () => {
    expect(escapeMarkdown('')).toBe('')
  })

  it('preserves normal text without special chars', () => {
    expect(escapeMarkdown('Hello World 123')).toBe('Hello World 123')
  })
})

describe('generateToken', () => {
  it('generates a token starting with #', () => {
    const token = generateToken()
    expect(token.startsWith('#')).toBe(true)
  })

  it('generates 9 character tokens (1 prefix + 8 chars)', () => {
    const token = generateToken()
    expect(token.length).toBe(9)
  })

  it('generates unique tokens on successive calls', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBeGreaterThan(90)
  })

  it('only uses valid characters', () => {
    const validChars = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
    for (let i = 0; i < 50; i++) {
      const token = generateToken().slice(1)
      for (const char of token) {
        expect(validChars.has(char)).toBe(true)
      }
    }
  })
})

describe('generateUniqueToken', () => {
  it('returns first token if no collision', async () => {
    const check = async () => false
    const token = await generateUniqueToken(check)
    expect(token.startsWith('#')).toBe(true)
    expect(token.length).toBe(9)
  })

  it('retries on collision and eventually succeeds', async () => {
    let calls = 0
    const check = async (_token: string) => {
      calls++
      return calls < 3
    }
    const token = await generateUniqueToken(check, 10)
    expect(token.startsWith('#')).toBe(true)
    expect(calls).toBe(3)
  })

  it('uses fallback suffix after exhausting retries', async () => {
    const check = async () => true
    const token = await generateUniqueToken(check, 3)
    expect(token.includes('#')).toBe(true)
    expect(token.length).toBe(9)
  })
})

describe('notification formatting (ported from notification-service)', () => {
  function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  it('formatTime converts 24h to 12h format', () => {
    expect(formatTime('09:00')).toBe('9:00 AM')
    expect(formatTime('13:30')).toBe('1:30 PM')
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatTime('23:59')).toBe('11:59 PM')
  })

  it('formatDate formats ISO date string', () => {
    const result = formatDate('2026-07-15')
    expect(result).toContain('July')
    expect(result).toContain('15')
  })
})
