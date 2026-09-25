import { describe, it, expect } from 'vitest'
import { normalizePhone, generateToken } from '../utils'
import { phoneSchema } from '../security'

// Real app logic: phone normalization used across backend/customer matching
describe('Phone Normalization', () => {
  it('strips leading zeros', () => {
    expect(normalizePhone('03001234567')).toBe('3001234567')
  })

  it('keeps the country code prefix', () => {
    expect(normalizePhone('923001234567')).toBe('923001234567')
  })

  it('removes @s.whatsapp.net suffix', () => {
    expect(normalizePhone('3001234567@s.whatsapp.net')).toBe('3001234567')
  })

  it('strips non-digit characters', () => {
    expect(normalizePhone('+92-300 1234567')).toBe('923001234567')
  })
})

// Real app logic: server-side phone validation (phoneSchema from security.ts)
describe('Phone Validation', () => {
  it('accepts 10-15 digit numbers', () => {
    const valid = ['3001234567', '923001234567', '123456789012']
    for (const phone of valid) {
      expect(phoneSchema.safeParse(phone).success).toBe(true)
    }
  })

  it('rejects non-numeric, too-short, too-long, and prefixed phones', () => {
    const invalid = ['abc123', '300-123-4567', '300123', '30012345678901234', '+923001234567']
    for (const phone of invalid) {
      expect(phoneSchema.safeParse(phone).success).toBe(false)
    }
  })
})

// Token generation (rejection-sampling secureRandomInt) — collision resistance
describe('Token Security', () => {
  it('generates unique-formatted tokens', () => {
    const token = generateToken()
    expect(token.startsWith('#')).toBe(true)
    expect(token.length).toBe(9)
  })

  it('generates mostly-unique tokens across many calls', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBeGreaterThan(90)
  })
})
