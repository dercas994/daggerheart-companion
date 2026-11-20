import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const PIP_ICON: Record<string, { d: string; crack?: string }> = {
  hp: { d: 'M12 20.5s-7.6-4.5-9.4-9.4C1.3 7.6 3.4 4 6.9 4c2.2 0 3.9 1.3 5.1 3 1.2-1.7 2.9-3 5.1-3 3.5 0 5.6 3.6 4.3 7.1-1.8 4.9-9.4 9.4-9.4 9.4z', crack: 'M12.6 7.2l-1.9 3.6 2.6 1.6-1.9 4' },
  stress: { d: 'M13.6 2.5 5.2 13.4h5.6l-1.3 8.1 8.9-11.4h-5.8z' },
  hope: { d: 'M12 2.5 20.5 12 12 21.5 3.5 12z' },
  armor: { d: 'M12 2.8 4.5 5.7v5.8c0 4.7 3.2 8.2 7.5 9.7 4.3-1.5 7.5-5 7.5-9.7V5.7z', crack: 'M13 6.5l-2.2 4 2.6 1.8-2 4.5' },
}
function PipIcon({ kind }: { kind: string }) {
  const ic = PIP_ICON[kind]
  if (!ic) return null
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="ic" d={ic.d} />
      {ic.crack && <path className="crack" d={ic.crack} />}
    </svg>
  )
}

export function Pips({ max, value, kind, onChange, size = 'md', label }: {
  max: number; value: number; kind: 'hp' | 'stress' | 'hope' | 'armor' | 'fear'
  onChange?: (n: number) => void; size?: 'sm' | 'md' | 'lg'; label?: string
}) {
  const [pulse, setPulse] = useState<number | null>(null)
  const [gain, setGain] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (value !== prev.current) {
      setGain(value > prev.current)
      setPulse(value > prev.current ? value - 1 : value)
      const t = setTimeout(() => setPulse(null), 650)
      prev.current = value
      return () => clearTimeout(t)
    }
  }, [value])
  return (
    <div className={`pips pips-${kind} pips-${size} ${max > 0 && value >= max ? 'full' : ''}`} role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < value
        const el = (
          <span className={`pip ${on ? 'on' : ''} ${pulse === i ? `pulse ${gain ? 'gain' : 'loss'}` : ''}`} key={i}><PipIcon kind={kind} /></span>
        )
        if (!onChange) return el
        return (
          <button type="button" key={i} className={`pip ${on ? 'on' : ''} ${pulse === i ? `pulse ${gain ? 'gain' : 'loss'}` : ''}`}
            aria-label={`${label ?? ''} ${i + 1}`} aria-pressed={on}
            onClick={() => onChange(on && i === value - 1 ? i : i + 1)}><PipIcon kind={kind} /></button>
        )
      })}
    </div>
  )
}

export function Stepper({ value, onChange, min = -99, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <span className="stepper">
      <button type="button" aria-label="Diminuisci" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <b>{value}</b>
      <button type="button" aria-label="Aumenta" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </span>
  )
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    document.body.classList.add('noscroll')
    return () => { removeEventListener('keydown', k); document.body.classList.remove('noscroll') }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

type Toast = { id: number; text: ReactNode; tone?: 'hope' | 'fear' | 'crit' | 'error' | 'info' }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems(x => [...x.slice(-3), { ...t, id }])
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => <div key={t.id} className={`toast tone-${t.tone ?? 'info'}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

export function Spinner() { return <div className="spinner" aria-label="Caricamento" /> }

export function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="error" role="alert">{error}</p> : null
}

export function useAsync() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    setBusy(true); setError(null)
    try { return await fn() } catch (e) { setError(e instanceof Error ? e.message : String(e)); return undefined } finally { setBusy(false) }
  }, [])
  return { busy, error, setError, run }
}
