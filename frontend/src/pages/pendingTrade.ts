import type { SubmitTradeRequest } from '../api/types.ts'

// A trade that was sent but hasn't been confirmed: the request may still be in flight, or the
// response was lost. It's kept in sessionStorage so a refresh doesn't lose the clientTradeId,
// and keyed by username so only the trader who sent it can retry it.
const storageKey = (username: string) => `pendingTrade:${username}`

export function loadPendingTrade(username: string): SubmitTradeRequest | undefined {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(username)) ?? 'null')
    return typeof saved?.clientTradeId === 'string' ? saved : undefined
  } catch {
    return undefined
  }
}

// Storage can be unavailable (private browsing, quota). The page still works, it just can't
// survive a refresh.
export function savePendingTrade(username: string, trade: SubmitTradeRequest) {
  try {
    sessionStorage.setItem(storageKey(username), JSON.stringify(trade))
  } catch {
    // ignored, see above
  }
}

// Only clears the saved trade if it's the one being resolved. A response can arrive long after
// the page that sent it was left, by which time a newer trade may be the one saved here.
export function clearPendingTrade(username: string, clientTradeId: string) {
  if (loadPendingTrade(username)?.clientTradeId !== clientTradeId) return
  try {
    sessionStorage.removeItem(storageKey(username))
  } catch {
    // ignored, see above
  }
}
