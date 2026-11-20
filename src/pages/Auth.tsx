import { useState, type FormEvent } from 'react'
import type { Backend } from '../lib/types'
import { ErrorLine, useAsync } from '../components/ui'
import { Emblem } from '../components/Emblem'
import { AppDownload } from '../components/AppDownload'

export function AuthPage({ be }: { be: Backend }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const { busy, error, run } = useAsync()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setNotice(null)
    if (mode === 'in') await run(() => be.signIn(email.trim(), password))
    else {
      const r = await run(() => be.signUp(email.trim(), password, name.trim() || email.split('@')[0]))
      if (r?.needsConfirm) { setNotice('Account creato. Apri l’email di conferma, poi accedi qui.'); setMode('in') }
    }
  }

  return (
    <main className="auth">
      <div className="auth-hero">
        <Emblem />
        <h1 className="brand">Daggerheart<br /><span>Companion</span></h1>
        <p className="auth-tag">Schede, dadi di Dualità e il gruppo sott’occhio, mentre giocate.</p>
        <AppDownload />
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === 'in' ? 'sel' : ''} onClick={() => setMode('in')}>Accedi</button>
          <button type="button" className={mode === 'up' ? 'sel' : ''} onClick={() => setMode('up')}>Registrati</button>
        </div>
        {mode === 'up' && (
          <label className="field"><span>Nome visibile al tavolo</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Roberto" autoComplete="nickname" />
          </label>
        )}
        <label className="field"><span>Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        </label>
        <ErrorLine error={error} />
        {notice && <p className="notice">{notice}</p>}
        <button className="btn btn-primary" disabled={busy}>{mode === 'in' ? 'Accedi' : 'Crea account'}</button>
      </form>
    </main>
  )
}
