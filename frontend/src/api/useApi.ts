import { useCallback, useEffect, useState } from 'react'
import { apiGet, errorMessage } from './client.ts'

interface ApiState<T> {
  data: T | undefined
  error: string | undefined
  loading: boolean
  loadedAt: Date | undefined
}

// Keeps showing the previous data while a new request is in flight, so tables don't
// flash empty every time a filter changes.
export function useApi<T>(path: string) {
  const [state, setState] = useState<ApiState<T>>({
    data: undefined,
    error: undefined,
    loading: true,
    loadedAt: undefined,
  })
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    // Ignore responses that arrive after the path changed, so a slow request can't
    // overwrite newer data.
    let stale = false
    setState((s) => ({ ...s, loading: true }))
    apiGet<T>(path)
      .then((data) => !stale && setState({ data, error: undefined, loading: false, loadedAt: new Date() }))
      .catch((e) => !stale && setState((s) => ({ ...s, error: errorMessage(e), loading: false })))
    return () => {
      stale = true
    }
  }, [path, reloadCount])

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])

  return { ...state, reload }
}
