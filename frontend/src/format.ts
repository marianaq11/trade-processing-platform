const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const priceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const quantityFormat = new Intl.NumberFormat('en-US')

export const formatMoney = (value: number) => moneyFormat.format(value)
export const formatPrice = (value: number) => priceFormat.format(value)
export const formatQuantity = (value: number) => quantityFormat.format(value)
export const formatPercent = (value: number) => `${moneyFormat.format(value)}%`

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

export function parseNumber(text: string): number | undefined {
  const trimmed = text.trim()
  if (!/\d/.test(trimmed) || !NUMBER_INPUT.test(trimmed)) return undefined
  return Number(trimmed.replace(/,/g, ''))
}
