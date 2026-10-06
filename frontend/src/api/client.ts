// Errors from the backend come back as ProblemDetail JSON (RFC 7807).
interface ProblemDetail {
  title?: string
  detail?: string
  errors?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? defaultMessage(status))
    this.status = status
    this.fieldErrors = problem.errors ?? {}
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Please log in again.'
  if (status === 403) return 'You do not have permission to do that.'
  return `Request failed (${status})`
}

let onUnauthorized: () => void = () => {}

// Lets the auth context drop back to the login page when the session expires.
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

// Spring Security puts the CSRF token in a readable cookie; it has to be echoed back in a
// header on anything that changes data.
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  const method = init?.method ?? 'GET'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (method !== 'GET') headers['X-XSRF-TOKEN'] = csrfToken()

  const response = await fetch(path, { ...init, headers: { ...headers, ...init?.headers } })

  if (!response.ok) {
    if (response.status === 401) onUnauthorized()
    const problem = await response.json().catch(() => ({}))
    throw new ApiError(response.status, problem)
  }

  const text = await response.text()
  return { data: (text ? JSON.parse(text) : undefined) as T, status: response.status }
}

export async function apiGet<T>(path: string): Promise<T> {
  return (await request<T>(path)).data
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return (await request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })).data
}

// Login is a regular form post because Spring Security's form login reads request params.
export async function postLogin(username: string, password: string): Promise<boolean> {
  // Logging out clears the CSRF cookie, and any response from the backend sets a new one.
  if (!csrfToken()) await fetch('/api/auth/me')

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-XSRF-TOKEN': csrfToken() },
    body: new URLSearchParams({ username, password }),
  })
  return response.ok
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}
