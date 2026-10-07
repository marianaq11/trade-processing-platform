import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext.tsx'
import { ErrorBanner } from '../components/Feedback.tsx'

// Seeded by the V5 migration; listed here so someone trying the demo doesn't need the README.
const DEMO_USERS = [
  { username: 'trader1', role: 'Trader' },
  { username: 'trader2', role: 'Trader' },
  { username: 'ops1', role: 'Operations' },
  { username: 'risk1', role: 'Risk manager' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Sign in · Trade Platform'
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(undefined)
    try {
      if (!(await login(username.trim(), password))) {
        setError('Incorrect username or password.')
      }
    } catch {
      setError('Could not reach the server. Is the backend running?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <main className="login-card">
        <p className="login-brand">Trade Platform</p>
        <h1>Sign in</h1>
        <form onSubmit={handleSubmit}>
          {error && <ErrorBanner message={error} />}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !username || !password}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="demo-users">
          <p>
            Demo accounts, all with password <code>demo-pass</code>:
          </p>
          <ul>
            {DEMO_USERS.map((u) => (
              <li key={u.username}>
                <button type="button" className="btn-link" onClick={() => setUsername(u.username)}>
                  {u.username}
                </button>
                <span className="muted">{u.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
