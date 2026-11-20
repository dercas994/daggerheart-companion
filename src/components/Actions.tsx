import { useEffect, useState } from 'react'
import type { Character } from '../lib/types'
import { hopeMax, thresholds, tierOf, damageMarks, massiveThreshold } from '../lib/rules'
import { Sheet, useToast } from './ui'

export function DamageSheet({ open, onClose, c, patch }: { open: boolean; onClose: () => void; c: Character; patch: (p: Partial<Character>) => void }) {
  const [dmg, setDmg] = useState('')
  const [armorUse, setArmorUse] = useState(0)
  useEffect(() => { if (open) { setDmg(''); setArmorUse(0) } }, [open])
  const [maj, sev] = thresholds(c.data, c.level)
  const n = parseInt(dmg, 10) || 0
  const base = damageMarks(n, maj, sev)
  const armorLeft = c.armor_max - c.armor_marked
  // Valoroso (Guardiano), "Volontà di Ferro": contro i danni fisici si può marcare uno slot Armatura in più
  const ironWill = c.data.subclass_id === 'stalwart' || c.data.multiclass?.subclass_id === 'stalwart'
  const maxSlots = Math.min(armorLeft, ironWill ? 2 : 1)
  const used = Math.min(armorUse, maxSlots)
  const marks = Math.max(0, base - used)
  const names = ['nessun danno', 'Minore', 'Maggiore', 'Grave', 'Massiccio']

  return (
    <Sheet open={open} onClose={onClose} title="Subisci danno">
      <label className="field"><span>Danno ricevuto</span>
        <input type="number" inputMode="numeric" min={0} value={dmg} onChange={e => setDmg(e.target.value)} autoFocus className="big-input" />
      </label>
      <p className="hint">Soglie: Maggiore da {maj}, Grave da {sev}, Massiccio da {massiveThreshold(sev)} (4 PF).</p>
      {maxSlots === 1 && (
        <label className="toggle"><input type="checkbox" checked={used === 1} onChange={e => setArmorUse(e.target.checked ? 1 : 0)} /> Marca uno slot Armatura per ridurre di una soglia ({armorLeft} disponibili)</label>
      )}
      {maxSlots === 2 && (
        <div className="field">
          <span className="hint">Slot Armatura da marcare ({armorLeft} disponibili)</span>
          <div className="seg tight" role="radiogroup" aria-label="Slot Armatura da marcare">
            {[0, 1, 2].map(k => (
              <button key={k} role="radio" aria-checked={used === k} className={used === k ? 'sel' : ''} onClick={() => setArmorUse(k)}>
                {k === 0 ? 'Nessuno' : k === 1 ? '1 slot, una soglia' : '2 slot, due soglie'}
              </button>
            ))}
          </div>
          <p className="hint">Il secondo slot è Volontà di Ferro del Valoroso: vale solo contro i danni fisici.</p>
        </div>
      )}
      <p className="damage-preview">
        {n > 0 ? <>Danno {names[base]}: segni <b>{marks}</b> PF{used > 0 ? ` e ${used} Armatura` : ''}</> : 'Inserisci il danno'}
      </p>
      <button className="btn btn-primary" disabled={n <= 0} onClick={() => {
        patch({ hp_marked: Math.min(c.hp_max, c.hp_marked + marks), armor_marked: c.armor_marked + used })
        onClose()
      }}>Applica</button>
    </Sheet>
  )
}

const d4 = () => 1 + Math.floor(Math.random() * 4)

export function RestSheet({ open, onClose, c, patch, onLongRest }: { open: boolean; onClose: () => void; c: Character; patch: (p: Partial<Character>) => void; onLongRest?: () => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<'short' | 'long'>('short')
  const [used, setUsed] = useState<string[]>([])
  useEffect(() => { if (open) setUsed([]) }, [open])
  const tier = tierOf(c.level)

  function move(id: string) {
    if (used.length >= 2) return
    const long = kind === 'long'
    const roll = d4() + tier
    let p: Partial<Character> = {}, text = ''
    if (id === 'wounds') { const v = long ? c.hp_marked : Math.min(roll, c.hp_marked); p = { hp_marked: c.hp_marked - v }; text = `Curi ${v} PF${long ? '' : ` (1d4+${tier} = ${roll})`}` }
    if (id === 'stress') { const v = long ? c.stress_marked : Math.min(roll, c.stress_marked); p = { stress_marked: c.stress_marked - v }; text = `Liberi ${v} Stress${long ? '' : ` (1d4+${tier} = ${roll})`}` }
    if (id === 'armor') { const v = long ? c.armor_marked : Math.min(roll, c.armor_marked); p = { armor_marked: c.armor_marked - v }; text = `Ripari ${v} slot Armatura${long ? '' : ` (1d4+${tier} = ${roll})`}` }
    if (id === 'prepare') { p = { hope: Math.min(hopeMax(c.data), c.hope + 1) }; text = '+1 Speranza' }
    patch(p)
    toast({ text, tone: 'hope' })
    setUsed(u => [...u, id])
  }

  const moves = [
    { id: 'wounds', label: 'Curare le ferite', desc: kind === 'short' ? 'Libera 1d4 + rango PF' : 'Libera tutti i PF' },
    { id: 'stress', label: 'Liberarsi dello stress', desc: kind === 'short' ? 'Libera 1d4 + rango Stress' : 'Libera tutto lo Stress' },
    { id: 'armor', label: 'Riparare l’armatura', desc: kind === 'short' ? 'Libera 1d4 + rango slot Armatura' : 'Libera tutti gli slot Armatura' },
    { id: 'prepare', label: 'Prepararsi', desc: 'Guadagni 1 Speranza' },
  ]

  return (
    <Sheet open={open} onClose={onClose} title="Riposo">
      <div className="seg">
        <button type="button" className={kind === 'short' ? 'sel' : ''} onClick={() => { setKind('short'); setUsed([]) }}>Riposo breve</button>
        <button type="button" className={kind === 'long' ? 'sel' : ''} onClick={() => { setKind('long'); setUsed([]) }}>Riposo lungo</button>
      </div>
      <p className="hint">Scegli due mosse di riposo ({used.length}/2). {kind === 'short' ? 'Un riposo breve dura circa un’ora.' : 'Il master guadagna Paura quando il gruppo fa un riposo lungo: avvisalo.'}</p>
      <div className="move-list">
        {moves.map(m => (
          <button key={m.id} type="button" className={`list-item ${used.includes(m.id) ? 'sel' : ''}`} disabled={used.length >= 2} onClick={() => move(m.id)}>
            <span className="pick-title">{m.label}</span><span className="list-feats">{m.desc}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => (kind === 'long' && used.length > 0 && onLongRest ? onLongRest() : onClose())}>Fine del riposo</button>
    </Sheet>
  )
}
