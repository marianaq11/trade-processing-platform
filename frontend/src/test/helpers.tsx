import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { CurrentUser, Role } from '../api/types.ts'
import { AuthContext } from '../auth/AuthContext.tsx'

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

// Replaces fetch for one test. Unknown URLs fail loudly so a test can't pass by accident.
export function mockFetch(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function unexpected(url: string): never {
  throw new Error(`Unexpected request to ${url}`)
}

export const userWithRole = (role: Role): CurrentUser => ({ username: role.toLowerCase(), role })

// Renders as an already signed-in user, without going through the login request.
export function renderAs(user: CurrentUser, ui: ReactNode, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={{ user, login: vi.fn(), logout: vi.fn() }}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  )
}

export const emptyPage = { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }
