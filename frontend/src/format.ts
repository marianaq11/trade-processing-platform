import type { Decimal } from './api/types.ts'

const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const priceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const quantityFormat = new Intl.NumberFormat('en-US')

// Intl formats decimal text exactly, without going through a JS number first.
export const formatMoney = (value: number | Decimal) => moneyFormat.format(value)
export const formatPrice = (value: number | Decimal) => priceFormat.format(value)
export const formatQuantity = (value: number) => quantityFormat.format(value)
export const formatPercent = (value: number | Decimal) => `${moneyFormat.format(value)}%`

export const formatTradeId = (id: number) => `T-${String(id).padStart(6, '0')}`

// Trade dates are New York business dates, so timestamps are shown in New York time too.
// Otherwise a trade booked at 9pm ET would look like it happened "tomorrow" in Europe.
export const TIME_ZONE = 'America/New_York'

const dateTimeParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function partsOf(date: Date): Record<string, string> {
  return Object.fromEntries(dateTimeParts.formatToParts(date).map((p) => [p.type, p.value]))
}

// 2026-10-06 09:45:18
export function formatDateTime(iso: string): string {
  const p = partsOf(new Date(iso))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

export function formatTime(iso: string): string {
  const p = partsOf(new Date(iso))
  return `${p.hour}:${p.minute}:${p.second}`
}

export function todayInNewYork(): string {
  const p = partsOf(new Date())
  return `${p.year}-${p.month}-${p.day}`
}

// Same rule as the backend: next weekday, holidays not modeled.
export function nextBusinessDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  do {
    date.setUTCDate(date.getUTCDate() + 1)
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6)
  return date.toISOString().slice(0, 10)
}

// "Wed, Oct 7" for the business date in the top bar
export function formatBusinessDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Plain digits ("1500.25") or US thousands grouping ("1,500.25"). Any other comma, as in "1,5",
// "23,00" or "1,,000", makes the input invalid: dropping it would change the value.
const NUMBER_INPUT = /^-?(\d+|[1-9]\d{0,2}(,\d{3})+)?(\.\d+)?$/

// Returns typed input as plain decimal text ("1500.25"), keeping every digit.
export function parseDecimal(text: string): Decimal | undefined {
  const trimmed = text.trim()
  if (!/\d/.test(trimmed) || !NUMBER_INPUT.test(trimmed)) return undefined
  return trimmed.replace(/,/g, '') as Decimal
}

export function parseNumber(text: string): number | undefined {
  const decimal = parseDecimal(text)
  return decimal === undefined ? undefined : Number(decimal)
}

// Digits after the decimal point as written, so "1.50" has 2.
export function decimalPlaces(value: Decimal): number {
  return (value.split('.')[1] ?? '').length
}

// Exact, unlike comparing JS numbers: 99999999999999.98 and 99999999999999.99 are the same number.
export function compareDecimals(a: Decimal, b: Decimal): number {
  const places = Math.max(decimalPlaces(a), decimalPlaces(b))
  const diff = scaled(a, places) - scaled(b, places)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

// Exact product, keeping every digit: 9999999 x 9999999.99 is 99999989900000.01, but as JS
// numbers it comes out as 99999989900000.015625.
export function multiplyDecimals(a: Decimal, b: Decimal): Decimal {
  const places = decimalPlaces(a) + decimalPlaces(b)
  const product = scaled(a, decimalPlaces(a)) * scaled(b, decimalPlaces(b))
  const digits = (product < 0n ? -product : product).toString().padStart(places + 1, '0')
  const sign = product < 0n ? '-' : ''
  const whole = digits.slice(0, digits.length - places)
  return (places === 0 ? `${sign}${whole}` : `${sign}${whole}.${digits.slice(-places)}`) as Decimal
}

// "-12.5" with 2 places -> -1250n
function scaled(value: Decimal, places: number): bigint {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole + fraction.padEnd(places, '0'))
}
