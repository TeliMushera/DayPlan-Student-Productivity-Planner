import { useState, type FormEvent } from 'react'
import { api } from './api'
import { Btn, inp } from './components'

export function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/auth/login', { password })
      onAuthenticated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not unlock DayPlan.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="min-h-screen grid place-items-center bg-bg p-5">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 space-y-4 shadow-2xl">
      <div><p className="text-xs uppercase tracking-[.16em] text-accent">Your personal planner</p><h1 className="text-2xl font-semibold mt-2">Welcome back</h1><p className="text-sm text-mute mt-2">Enter your DayPlan access password to continue.</p></div>
      <label className="block text-sm"><span className="text-mute">Access password</span><input autoComplete="current-password" autoFocus type="password" required className={inp} value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
      <Btn type="submit" disabled={busy} className="w-full">{busy ? 'Unlocking…' : 'Unlock DayPlan'}</Btn>
    </form>
  </main>
}
