import { useState } from 'react'
import { signIn } from '../lib/auth-client'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: signInError } = await signIn.email({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message ?? 'Unable to sign in')
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="login-icon">H</div>
        <h1>Welcome back</h1>
        <p className="login-subtitle">Sign in to manage your tickets</p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default Login
