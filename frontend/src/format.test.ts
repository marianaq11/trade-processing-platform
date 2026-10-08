import { describe, expect, it } from 'vitest'
import { formatDateTime, formatTradeId, nextBusinessDay, parseNumber } from './format.ts'

describe('formatDateTime', () => {
  it('shows New York time whatever the browser time zone is', () => {
    expect(formatDateTime('2026-10-05T18:30:00Z')).toBe('2026-10-05 14:30:00') // EDT, UTC-4
    expect(formatDateTime('2026-12-01T15:00:05Z')).toBe('2026-12-01 10:00:05') // EST, UTC-5
  })

  it('keeps a late-evening trade on the right New York date', () => {
    expect(formatDateTime('2026-10-06T02:15:00Z')).toBe('2026-10-05 22:15:00')
  })
})

describe('nextBusinessDay', () => {
  it('skips the weekend like the backend does', () => {
    expect(nextBusinessDay('2026-10-05')).toBe('2026-10-06') // Mon -> Tue
    expect(nextBusinessDay('2026-10-09')).toBe('2026-10-12') // Fri -> Mon
    expect(nextBusinessDay('2026-10-10')).toBe('2026-10-12') // Sat -> Mon
  })
})

describe('parseNumber', () => {
  it('accepts thousands separators', () => {
    expect(parseNumber('1,500')).toBe(1500)
    expect(parseNumber(' 1,234.5 ')).toBe(1234.5)
    expect(parseNumber('1,234,567.89')).toBe(1234567.89)
    expect(parseNumber('-1,000')).toBe(-1000)
  })

  it('accepts plain decimals', () => {
    expect(parseNumber('1500')).toBe(1500)
    expect(parseNumber('1234.5')).toBe(1234.5)
    expect(parseNumber('0.5')).toBe(0.5)
    expect(parseNumber('.5')).toBe(0.5)
  })

  it('rejects commas that are not thousands separators instead of dropping them', () => {
    // these used to come out as 15, 2300 and 1000
    expect(parseNumber('1,5')).toBeUndefined()
    expect(parseNumber('23,00')).toBeUndefined()
    expect(parseNumber('1,,000')).toBeUndefined()

    const malformed = [',100', '100,', '1,0000', '1234,567', '0,500', '1,234,56', '1.234,5', '1,000.000,5', '1, 000']
    for (const text of malformed) {
      expect(parseNumber(text), text).toBeUndefined()
    }
  })

  it('rejects anything that is not a plain number', () => {
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('abc')).toBeUndefined()
    expect(parseNumber('1.2.3')).toBeUndefined()
    expect(parseNumber('12e3')).toBeUndefined()
    expect(parseNumber('-')).toBeUndefined()
    expect(parseNumber('.')).toBeUndefined()
    expect(parseNumber('1.')).toBeUndefined()
  })
})

it('pads trade ids', () => {
  expect(formatTradeId(42)).toBe('T-000042')
})
