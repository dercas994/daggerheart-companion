import type { Character, Member, Roll } from '../lib/types'
import { className, getSubclass } from '../data'
import { evasion, hopeMax, MAX_FEAR, thresholds } from '../lib/rules'
import { useState } from 'react'
import { ErrorLine, Pips, Sheet, useAsync } from './ui'
import { Avatar } from './Portrait'

export function PartyCard({ c, owner, editable, onPatch, isMe, compact }: {
  c: Character; owner?: string; editable?: boolean; isMe?: boolean; compact?: boolean
  onPatch?: (p: Partial<Character>) => void
}) {
  const sub = getSubclass(c.data.class_id, c.data.subclass_id)
  const down = c.hp_marked >= c.hp_max
  const [maj, sev] = thresholds(c.data, c.level)
  return (
    <article className={`party-card ${down ? 'down' : ''} ${isMe ? 'me' : ''}`} style={{ ['--accent' as any]: c.data.accent || 'var(--hope)' }}>
      <header>
        <Avatar url={c.data.portrait_url} name={c.name} accent={c.data.accent} size={46} />
        <div>
          <a href={`#/pg/${c.id}`} className="party-name">{c.name}</a>
          <span className="party-sub">{className(c.data.class_id)}{sub ? `, ${sub.name}` : ''}, liv. {c.level}{owner ? ` (${owner})` : ''}</span>
        </div>
      </header>
      <div className="vital"><span className="vital-k">PF</span>
        <Pips kind="hp" size="sm" max={c.hp_max} value={c.hp_marked} label={`Punti ferita di ${c.name}`} onChange={editable ? n => onPatch?.({ hp_marked: n }) : undefined} />
      </div>
      <div className="vital"><span className="vital-k">Stress</span>
        <Pips kind="stress" size="sm" max={c.stress_max} value={c.stress_marked} label={`Stress di ${c.name}`} onChange={editable ? n => onPatch?.({ stress_marked: n }) : undefined} />
      </div>
      <div className="vital"><span className="vital-k">Speranza</span>
        <Pips kind="hope" size="sm" max={hopeMax(c.data)} value={c.hope} label={`Speranza di ${c.name}`} onChange={editable ? n => onPatch?.({ hope: n }) : undefined} />
      </div>
      {!compact && (
        <div className="party-stats">
          <span>Evasione <b>{evasion(c.data)}</b></span>
          <span>Armatura <b>{c.armor_max - c.armor_marked}/{c.armor_max}</b></span>
          <span>Soglie <b>{maj}/{sev}</b></span>
        </div>
      )}
      {c.data.conditions?.length > 0 && <p className="conditions">{c.data.conditions.join(', ')}</p>}
      {down && <p className="down-label">A terra</p>}
    </article>
  )
}

export function FearTrack({ value, onChange, big }: { value: number; onChange?: (n: number) => void; big?: boolean }) {
  return (
    <div className={`fear-track ${big ? 'big' : ''}`}>
      <div className="fear-head">
        <span className="fear-title">Paura</span>
        <span className="fear-count"><b>{value}</b>/{MAX_FEAR}</span>
      </div>
      <Pips kind="fear" size={big ? 'lg' : 'sm'} max={MAX_FEAR} value={value} onChange={onChange} label="Paura" />
      {onChange && (
        <div className="fear-actions">
          <button className="btn btn-ghost" disabled={value <= 0} onClick={() => onChange(value - 1)}>Spendi 1 Paura</button>
          <button className="btn btn-ghost" disabled={value >= MAX_FEAR} onClick={() => onChange(value + 1)}>Aggiungi 1</button>
        </div>
      )}
    </div>
  )
}

const OUT = { hope: 'Speranza', fear: 'Paura', crit: 'Critico' }
export function RollLog({ rolls, limit = 12, onUndo }: { rolls: Roll[]; limit?: number; onUndo?: (r: Roll) => void }) {
  if (!rolls.length) return <p className="empty">Nessun tiro ancora. I tiri di tutti compaiono qui in tempo reale.</p>
  return (
    <ol className="roll-log">
      {rolls.slice(0, limit).map(r => (
        <li key={r.id} className={`out-${r.outcome}`}>
          <span className="rl-total">{r.total}</span>
          <span className="rl-main">
            <b>{r.roller_name}</b>{r.label ? ` ${r.label}` : ''}
            <small>{r.hope_die} Speranza, {r.fear_die} Paura{r.adv_die ? `, ${r.adv_die > 0 ? '+' : ''}${r.adv_die} d6` : ''}{r.modifier ? `, mod ${r.modifier > 0 ? '+' : ''}${r.modifier}` : ''}{r.manual ? ', dadi fisici' : ''}</small>
          </span>
          <span className="rl-out">{OUT[r.outcome]}</span>
          <time>{new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</time>
          {onUndo && <button className="rl-undo" onClick={() => onUndo(r)} aria-label={`Annulla il tiro di ${r.roller_name}`}>Annulla</button>}
        </li>
      ))}
    </ol>
  )
}

export const ownerName = (members: Member[], id: string) => members.find(m => m.user_id === id)?.display_name

/** Master: annulla un tiro, togliendo Speranza o Paura che il tiro aveva dato. */
export function UndoRollSheet({ roll, onClose, onConfirm }: { roll: Roll | null; onClose: () => void; onConfirm: (revert: boolean) => Promise<void> }) {
  const [revert, setRevert] = useState(true)
  const job = useAsync()
  if (!roll) return null
  const r = roll
  let effect: string
  if (r.outcome === 'fear') effect = `toglie ${r.fear_gain ?? 1} Paura alla tua riserva`
  else if (!r.character_id) effect = 'non aveva dato Speranza a nessun personaggio'
  else {
    const hope = r.hope_gain ?? 1
    effect = `toglie ${hope} Speranza a ${r.roller_name}`
    if (r.outcome === 'crit') effect += r.stress_cleared == null ? ' (lo Stress tolto dal critico va rimesso a mano)' : r.stress_cleared > 0 ? ` e gli rimette ${r.stress_cleared} Stress` : ''
  }
  return (
    <Sheet open onClose={onClose} title="Annulla tiro">
      <p><b>{r.roller_name}</b>{r.label ? ` ${r.label}` : ''}: {r.total} {OUT[r.outcome]}.</p>
      <label className="toggle"><input type="checkbox" checked={revert} onChange={e => setRevert(e.target.checked)} /> Annulla anche l'effetto: {effect}</label>
      <p className="hint">Il tiro sparisce dalla cronologia di tutti.</p>
      <ErrorLine error={job.error} />
      <div className="row-gap end">
        <button className="btn btn-ghost" onClick={onClose}>Indietro</button>
        <button className="btn btn-danger" disabled={job.busy} onClick={async () => { if (await job.run(() => onConfirm(revert).then(() => true))) onClose() }}>Annulla tiro</button>
      </div>
    </Sheet>
  )
}
