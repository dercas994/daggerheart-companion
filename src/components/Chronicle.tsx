import { useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../App'
import { useLiveList } from '../lib/liveList'
import type { Member, Recap } from '../lib/types'
import { ErrorLine, Sheet, Spinner, useAsync, useToast } from './ui'

const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

/** Paragrafi semplici: riga vuota = nuovo paragrafo, **grassetto** e *corsivo*. */
function Body({ text }: { text: string }) {
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return <>{paras.map((p, i) => <p key={i}>{inline(p)}</p>)}</>
}
function inline(s: string) {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\n/g
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(s))) {
    out.push(s.slice(last, m.index))
    if (m[1]) out.push(<b key={k++}>{m[1]}</b>)
    else if (m[2]) out.push(<i key={k++}>{m[2]}</i>)
    else out.push(<br key={k++} />)
    last = re.lastIndex
  }
  out.push(s.slice(last))
  return out
}

export function Chronicle({ campaignId, isGm, members }: { campaignId: string; isGm: boolean; members: Member[] }) {
  const { be, user } = useApp()
  const list = useLiveList(be, campaignId, id => be.listRecaps(id), 'onRecaps')
  const [editing, setEditing] = useState<Partial<Recap> | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const recaps = useMemo(() => order === 'asc' ? list.items : [...list.items].reverse(), [list.items, order])
  const nextNumber = Math.max(0, ...list.items.map(r => r.number ?? 0)) + 1
  const author = (id: string) => members.find(m => m.user_id === id)?.display_name ?? ''

  if (list.loading) return <div className="center-pad"><Spinner /></div>

  return (
    <section className="chronicle">
      <div className="section-head">
        <h2>Storia</h2>
        <div className="row-gap">
          {list.items.length > 1 && (
            <button className="btn btn-ghost small" onClick={() => setOrder(o => o === 'asc' ? 'desc' : 'asc')}>
              {order === 'desc' ? 'Dalla prima sessione' : 'Dalla più recente'}
            </button>
          )}
          <button className="btn btn-primary small" onClick={() => setEditing({ number: nextNumber, played_on: new Date().toISOString().slice(0, 10), title: '', body: '' })}>Scrivi un recap</button>
        </div>
      </div>
      <ErrorLine error={list.error} />
      {list.items.length === 0 && (
        <p className="empty">Ancora nessun recap. Dopo ogni sessione, chiunque al tavolo può raccontare cosa è successo: diventa la cronaca della campagna.</p>
      )}
      <ol className="timeline">
        {recaps.map(r => {
          const expanded = open === r.id
          const long = r.body.length > 420
          const canEdit = r.author_id === user.id || isGm
          return (
            <li key={r.id} className={`recap ${expanded ? 'open' : ''}`}>
              <div className="recap-mark" aria-hidden>{r.number ?? '·'}</div>
              <article>
                <header>
                  <h3>{r.number != null && <span className="recap-num">Sessione {r.number}</span>}{r.title || 'Senza titolo'}</h3>
                  <p className="recap-meta">{[fmtDate(r.played_on), author(r.author_id) && `scritto da ${author(r.author_id)}`].filter(Boolean).join(', ')}</p>
                </header>
                <div className={`recap-body ${long && !expanded ? 'clipped' : ''}`}><Body text={r.body} /></div>
                <div className="recap-actions">
                  {long && <button className="link-btn" onClick={() => setOpen(expanded ? null : r.id)}>{expanded ? 'Riduci' : 'Leggi tutto'}</button>}
                  {canEdit && <button className="link-btn" onClick={() => setEditing(r)}>Modifica</button>}
                </div>
              </article>
            </li>
          )
        })}
      </ol>
      {editing && <RecapEditor campaignId={campaignId} recap={editing} onClose={() => setEditing(null)} onSaved={list.reload} />}
    </section>
  )
}

function RecapEditor({ campaignId, recap, onClose, onSaved }: { campaignId: string; recap: Partial<Recap>; onClose: () => void; onSaved: () => void }) {
  const { be } = useApp()
  const toast = useToast()
  const [r, setR] = useState(recap)
  const [confirm, setConfirm] = useState(false)
  const save = useAsync()
  const set = (p: Partial<Recap>) => setR(x => ({ ...x, ...p }))
  return (
    <Sheet open onClose={onClose} title={recap.id ? 'Modifica recap' : 'Nuovo recap'} wide>
      <div className="recap-form-row">
        <label className="field"><span>Sessione n.</span>
          <input type="number" min={0} inputMode="numeric" value={r.number ?? ''} onChange={e => set({ number: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
        </label>
        <label className="field"><span>Giocata il</span>
          <input type="date" value={r.played_on ?? ''} onChange={e => set({ played_on: e.target.value || null })} />
        </label>
      </div>
      <label className="field"><span>Titolo</span><input maxLength={140} value={r.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="La Gilda è caduta" /></label>
      <label className="field"><span>Cosa è successo</span>
        <textarea rows={14} maxLength={40000} value={r.body ?? ''} onChange={e => set({ body: e.target.value })}
          placeholder="Racconta la sessione. Lascia una riga vuota per andare a capo; **grassetto** e *corsivo* funzionano." />
      </label>
      <ErrorLine error={save.error} />
      <div className="row-gap end">
        {recap.id && !confirm && <button className="btn btn-ghost danger-text" onClick={() => setConfirm(true)}>Elimina</button>}
        {recap.id && confirm && <button className="btn btn-danger" disabled={save.busy} onClick={async () => {
          const ok = await save.run(() => be.deleteRecap(recap.id!).then(() => true)); if (ok) { onSaved(); onClose(); toast({ text: 'Recap eliminato' }) }
        }}>Conferma eliminazione</button>}
        <button className="btn btn-primary" disabled={save.busy || !(r.title?.trim() || r.body?.trim())} onClick={async () => {
          const ok = await save.run(() => be.saveRecap(campaignId, { ...r, title: r.title?.trim(), body: r.body?.trim() }))
          if (ok) { onSaved(); onClose(); toast({ text: 'Recap salvato' }) }
        }}>Salva</button>
      </div>
    </Sheet>
  )
}
