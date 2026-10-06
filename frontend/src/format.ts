const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const priceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const quantityFormat = new Intl.NumberFormat('en-US')

export const formatMoney = (value: number) => moneyFormat.format(value)
export const formatPrice = (value: number) => priceFormat.format(value)
export const formatQuantity = (value: number) => quantityFormat.format(value)

const pad = (n: number) => String(n).padStart(2, '0')

// YYYY-MM-DD HH:mm:ss in the browser's time zone
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
