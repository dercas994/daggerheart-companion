import { useEffect, useRef, useState } from 'react'
import { useApp } from '../App'
import { useLiveList } from '../lib/liveList'
import type { Countdown, CountdownInput } from '../lib/types'
import { ErrorLine, Sheet, Stepper, useAsync, useToast } from './ui'

/** Conti alla rovescia della campagna, aggiornati in tempo reale (i giocatori vedono solo quelli visibili). */
export function useCountdowns(campaignId: string, isGm: boolean) {
  const { be } = useApp()
  const toast = useToast()
  const list = useLiveList(be, campaignId, id => be.listCountdowns(id), 'onCountdowns', isGm ? 0 : 20_000)
  const prev = useRef<Map<string, number> | null>(null)
  const [fired, setFired] = useState<Record<string, number>>({})

  // scattato: arrivato a zero, oppure ricominciato da capo se è ciclico
  useEffect(() => {
    const before = prev.current
    const now = new Map(list.items.map(c => [c.id, c.value]))
    prev.current = now
    if (!before) return
    for (const c of list.items) {
      const was = before.get(c.id)
      if (was === undefined || was === c.value) continue
      const hit = (c.value === 0 && was > 0) || (c.loop && was === 1 && c.value === c.max)
      if (hit) {
        setFired(f => ({ ...f, [c.id]: Date.now() }))
        toast({ text: `${c.name || 'Conto alla rovescia'}: è scattato!`, tone: c.kind === 'progress' ? 'hope' : 'fear' })
        navigator.vibrate?.([60, 40, 60, 40, 120])
      }
    }
  }, [list.items, toast])

  return { ...list, fired }
}

export type CountdownsState = ReturnType<typeof useCountdowns>

/** Quadrante: un segmento per ogni passo, si spengono man mano che il conto scende. */
export function Dial({ c, size = 76, fired }: { c: Countdown; size?: number; fired?: boolean }) {
  const r = 40, cx = 50, cy = 50
  const n = Math.max(1, c.max)
  const gap = n > 1 ? Math.min(8, 60 / n) : 0
  const seg = 360 / n
  const arcs = Array.from({ length: n }, (_, i) => {
    const a0 = -90 + i * seg + gap / 2, a1 = -90 + (i + 1) * seg - gap / 2
    const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
    const [x0, y0] = p(a0), [x1, y1] = p(a1)
    const large = a1 - a0 > 180 ? 1 : 0
    return n === 1 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}` : `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
  })
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`dial k-${c.kind} ${c.value === 0 ? 'zero' : ''} ${fired ? 'fired' : ''}`} role="img"
      aria-label={`${c.name}: ${c.value} su ${c.max}`}>
      {arcs.map((d, i) => <path key={i} d={d} className={i < c.value ? 'on' : 'off'} />)}
      <text x="50" y="50" className="dial-n">{c.value}</text>
    </svg>
  )
}

/** Riquadro dei conti per il master (con i comandi) o per i giocatori (solo lettura). */
export function CountdownsPanel({ campaignId, isGm, state, compact }: { campaignId: string; isGm: boolean; state: CountdownsState; compact?: boolean }) {
  const { be } = useApp()
  const [editing, setEditing] = useState<CountdownInput | null>(null)
  const job = useAsync()
  const items = state.items
  if (!isGm && items.length === 0) return null

  const step = (c: Countdown, d: number) => {
    let v = c.value + d
    if (v <= 0 && d < 0 && c.loop && c.value > 0) v = c.max
    v = Math.max(0, Math.min(c.max, v))
    state.setItems(xs => xs.map(x => (x.id === c.id ? { ...x, value: v } : x)))
    job.run(() => be.saveCountdown(campaignId, { id: c.id, value: v }).then(() => true)).then(ok => { if (!ok) state.reload() })
  }

  if (compact) {
    return (
      <div className="cd-strip" aria-label="Conti alla rovescia">
        {items.map(c => (
          <div key={c.id} className={`cd-mini k-${c.kind} ${state.fired[c.id] ? 'fired' : ''}`} title={c.note || undefined}>
            <Dial c={c} size={38} fired={!!state.fired[c.id] && Date.now() - state.fired[c.id] < 4000} />
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="countdowns">
      <div className="section-head">
        <h2>Conti alla rovescia</h2>
        {isGm && <button className="btn btn-ghost small" onClick={() => setEditing({ name: '', max: 4, value: 4, kind: 'consequence', visible: true, auto_tick: false, loop: false, note: '' })}>Nuovo</button>}
      </div>
      {isGm && items.length === 0 && <p className="empty">Un conto alla rovescia misura quanto manca a qualcosa: il crollo della cripta, l’arrivo dei rinforzi, il rituale completato. I giocatori lo vedono scendere.</p>}
      <ErrorLine error={job.error ?? state.error} />
      <div className="cd-grid">
        {items.map(c => {
          const fired = !!state.fired[c.id] && Date.now() - state.fired[c.id] < 4000
          return (
            <article key={c.id} className={`cd-card k-${c.kind} ${c.value === 0 ? 'zero' : ''} ${fired ? 'fired' : ''} ${!c.visible ? 'hidden-cd' : ''}`}>
              <Dial c={c} fired={fired} />
              <div className="cd-body">
                <h3>{c.name || 'Senza nome'}</h3>
                <p className="cd-meta">
                  {c.kind === 'progress' ? 'Avanzamento' : 'Minaccia'}
                  {c.auto_tick ? ', scende a ogni tiro' : ''}{c.loop ? ', ciclico' : ''}
                  {isGm && !c.visible ? ', nascosto ai giocatori' : ''}
                </p>
                {c.value === 0 && <p className="cd-fire">È scattato!</p>}
                {c.note && <p className="cd-note">{c.note}</p>}
                {isGm && (
                  <div className="cd-ctrl">
                    <button className="btn btn-ghost small" disabled={c.value === 0 && !c.loop} onClick={() => step(c, -1)} aria-label={`Fai scendere ${c.name}`}>−1</button>
                    <button className="btn btn-ghost small" disabled={c.value >= c.max} onClick={() => step(c, +1)} aria-label={`Fai salire ${c.name}`}>+1</button>
                    {c.value === 0 && <button className="btn btn-ghost small" onClick={() => step(c, c.max)}>Ricomincia</button>}
                    <button className="link-btn" onClick={() => setEditing(c)}>Modifica</button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {editing && <CountdownEditor campaignId={campaignId} c={editing} onClose={() => setEditing(null)} onSaved={state.reload} />}
    </section>
  )
}

function CountdownEditor({ campaignId, c, onClose, onSaved }: { campaignId: string; c: CountdownInput; onClose: () => void; onSaved: () => void }) {
  const { be } = useApp()
  const toast = useToast()
  const [v, setV] = useState(c)
  const [confirm, setConfirm] = useState(false)
  const job = useAsync()
  const set = (p: CountdownInput) => setV(x => ({ ...x, ...p }))
  const max = v.max ?? 4
  return (
    <Sheet open onClose={onClose} title={c.id ? 'Modifica conto alla rovescia' : 'Nuovo conto alla rovescia'}>
      <label className="field"><span>Nome</span>
        <input value={v.name ?? ''} maxLength={80} placeholder="La cripta crolla" onChange={e => set({ name: e.target.value })} autoFocus />
      </label>
      <div className="seg">
        <button type="button" className={v.kind === 'consequence' ? 'sel' : ''} onClick={() => set({ kind: 'consequence' })}>Minaccia</button>
        <button type="button" className={v.kind === 'progress' ? 'sel' : ''} onClick={() => set({ kind: 'progress' })}>Avanzamento</button>
      </div>
      <p className="hint">{v.kind === 'progress' ? 'Avanzamento: quanto manca perché i PG raggiungano un obiettivo.' : 'Minaccia: quanto manca prima che succeda qualcosa di brutto.'}</p>
      <div className="edit-grid">
        <div className="edit-row"><span>Parte da</span><Stepper value={max} min={1} max={20} onChange={n => set({ max: n, value: c.id ? Math.min(v.value ?? n, n) : n })} /></div>
        {c.id && <div className="edit-row"><span>Valore attuale</span><Stepper value={v.value ?? max} min={0} max={max} onChange={n => set({ value: n })} /></div>}
      </div>
      <label className="toggle"><input type="checkbox" checked={!!v.auto_tick} onChange={e => set({ auto_tick: e.target.checked })} /> Scende da solo a ogni tiro di Dualità dei giocatori</label>
      <label className="toggle"><input type="checkbox" checked={!!v.loop} onChange={e => set({ loop: e.target.checked })} /> Ciclico: quando scatta ricomincia da capo</label>
      <label className="toggle"><input type="checkbox" checked={v.visible !== false} onChange={e => set({ visible: e.target.checked })} /> Visibile ai giocatori</label>
      <label className="field"><span>Cosa succede quando scatta (facoltativo)</span>
        <textarea rows={2} maxLength={400} value={v.note ?? ''} onChange={e => set({ note: e.target.value })} />
      </label>
      <ErrorLine error={job.error} />
      <div className="row-gap end">
        {c.id && !confirm && <button className="btn btn-ghost danger-text" onClick={() => setConfirm(true)}>Elimina</button>}
        {c.id && confirm && <button className="btn btn-danger" disabled={job.busy} onClick={async () => {
          if (await job.run(() => be.deleteCountdown(c.id!).then(() => true))) { onSaved(); onClose(); toast({ text: 'Conto alla rovescia eliminato' }) }
        }}>Conferma eliminazione</button>}
        <button className="btn btn-primary" disabled={job.busy || !v.name?.trim()} onClick={async () => {
          const row: CountdownInput = { ...v, name: v.name!.trim(), value: c.id ? v.value : max }
          if (await job.run(() => be.saveCountdown(campaignId, row).then(() => true))) { onSaved(); onClose() }
        }}>{c.id ? 'Salva' : 'Crea'}</button>
      </div>
    </Sheet>
  )
}

/** Versione autonoma: carica i conti e li mostra (riquadro completo o striscia compatta). */
export function Countdowns({ campaignId, isGm, compact }: { campaignId: string; isGm: boolean; compact?: boolean }) {
  const state = useCountdowns(campaignId, isGm)
  return <CountdownsPanel campaignId={campaignId} isGm={isGm} state={state} compact={compact} />
}
