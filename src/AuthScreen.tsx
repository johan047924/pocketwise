
import { useState } from 'react'
import { isCloudConfigured, supabase } from './lib/supabase'

export default function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: () => void
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isCloudConfigured || !supabase) {
      setMessage('Supabase is not configured. Please check the project settings.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      if (mode === 'signup') {
       const { data, error } = await supabase.auth.signUp({
  email: email.trim(),
  password,
  options: {
    emailRedirectTo: 'https://johan047924.github.io/pocketwise/',
  },
})
        if (error) throw error

        if (data.session) {
          onAuthenticated()
        } else {
          setMessage('Account created. Check your email for a confirmation link, then sign in.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        onAuthenticated()
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: '#f5f6f2',
      fontFamily: 'system-ui, sans-serif',
      color: '#25352c',
    }}>
      <section style={{
        width: '100%',
        maxWidth: 400,
        boxSizing: 'border-box',
        padding: 32,
        borderRadius: 20,
        background: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{ marginTop: 0 }}>Pocketwise</h1>
        <p style={{ color: '#657269', lineHeight: 1.5 }}>
          A clearer view of your money, one step at a time.
        </p>

        <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 6 }}>Email</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, marginBottom: 16, border: '1px solid #d8ded8', borderRadius: 8 }}
          />

          <label style={{ display: 'block', marginBottom: 6 }}>Password</label>
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, marginBottom: 16, border: '1px solid #d8ded8', borderRadius: 8 }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 12, border: 0, borderRadius: 8, background: '#426b54', color: 'white', cursor: 'pointer' }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {message && (
          <p role="status" style={{ marginTop: 16, overflowWrap: 'anywhere' }}>
            {message}
          </p>
        )}

        <p style={{ marginBottom: 0, marginTop: 20, lineHeight: 1.5 }}>
          {mode === 'signin' ? 'New to Pocketwise? ' : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setMessage('')
            }}
            style={{ border: 0, background: 'none', color: '#426b54', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  )
}
