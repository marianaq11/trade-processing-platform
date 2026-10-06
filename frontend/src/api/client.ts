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
    super(problem.detail ?? problem.title ?? `Request failed (${status})`)
    this.status = status
    this.fieldErrors = problem.errors ?? {}
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))
    throw new ApiError(response.status, problem)
  }

  return { data: await response.json(), status: response.status }
}

export async function apiGet<T>(path: string): Promise<T> {
  return (await request<T>(path)).data
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return (await request<T>(path, { method: 'POST', body: JSON.stringify(body) })).data
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}
