import { describe, expect, it } from 'vitest'
import { decimalPlaces, formatDateTime, formatTradeId, nextBusinessDay, parseNumber } from './format.ts'

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
  it('accepts plain numbers and US thousands separators', () => {
    expect(parseNumber('1500')).toBe(1500)
    expect(parseNumber('.5')).toBe(0.5)
    expect(parseNumber('1,500')).toBe(1500)
    expect(parseNumber(' 1,234.5 ')).toBe(1234.5)
    expect(parseNumber('1,234,567.89')).toBe(1234567.89)
  })

  it('rejects commas that are not thousands separators', () => {
    expect(parseNumber('1,5')).toBeUndefined()
    expect(parseNumber('23,00')).toBeUndefined()
    expect(parseNumber('1,,000')).toBeUndefined()
    expect(parseNumber('1,0000')).toBeUndefined()
    expect(parseNumber('1234,567')).toBeUndefined()
    expect(parseNumber('0,500')).toBeUndefined()
    expect(parseNumber(',100')).toBeUndefined()
    expect(parseNumber('100,')).toBeUndefined()
    expect(parseNumber('1,234.5,6')).toBeUndefined()
  })

  it('rejects anything else that is not a plain number', () => {
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('abc')).toBeUndefined()
    expect(parseNumber('1.2.3')).toBeUndefined()
    expect(parseNumber('12e3')).toBeUndefined()
    expect(parseNumber('5.')).toBeUndefined()
  })

  it('keeps every digit of the largest risk limit', () => {
    expect(JSON.stringify(parseNumber('9,999,999,999,999.99'))).toBe('9999999999999.99')
  })
})

describe('decimalPlaces', () => {
  it('counts digits after the point, ignoring trailing zeros', () => {
    expect(decimalPlaces('1,000')).toBe(0)
    expect(decimalPlaces('1,000.555')).toBe(3)
    expect(decimalPlaces('230.5000')).toBe(1)
  })
})

it('pads trade ids', () => {
  expect(formatTradeId(42)).toBe('T-000042')
})
