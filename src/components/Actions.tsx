import { useEffect, useState } from 'react'
import type { Character } from '../lib/types'
import { hopeMax, thresholds, tierOf } from '../lib/rules'
import { Sheet, useToast } from './ui'

export function DamageSheet({ open, onClose, c, patch }: { open: boolean; onClose: () => void; c: Character; patch: (p: Partial<Character>) => void }) {
  const [dmg, setDmg] = useState('')
  const [useArmor, setUseArmor] = useState(false)
  useEffect(() => { if (open) { setDmg(''); setUseArmor(false) } }, [open])
  const [maj, sev] = thresholds(c.data, c.level)
  const n = parseInt(dmg, 10) || 0
  const base = n <= 0 ? 0 : n >= sev ? 3 : n >= maj ? 2 : 1
  const armorLeft = c.armor_max - c.armor_marked
  const marks = Math.max(0, base - (useArmor && armorLeft > 0 ? 1 : 0))
  const names = ['nessun danno', 'Minore', 'Maggiore', 'Grave']

  return (
    <Sheet open={open} onClose={onClose} title="Subisci danno">
      <label className="field"><span>Danno ricevuto</span>
        <input type="number" inputMode="numeric" min={0} value={dmg} onChange={e => setDmg(e.target.value)} autoFocus className="big-input" />
      </label>
      <p className="hint">Soglie: Maggiore da {maj}, Grave da {sev}.</p>
      {armorLeft > 0 && (
        <label className="toggle"><input type="checkbox" checked={useArmor} onChange={e => setUseArmor(e.target.checked)} /> Marca uno slot Armatura per ridurre di una soglia ({armorLeft} disponibili)</label>
      )}
      <p className="damage-preview">
        {n > 0 ? <>Danno {names[base]}: segni <b>{marks}</b> PF{useArmor && armorLeft > 0 ? ' e 1 Armatura' : ''}</> : 'Inserisci il danno'}
      </p>
      <button className="btn btn-primary" disabled={n <= 0} onClick={() => {
        patch({ hp_marked: Math.min(c.hp_max, c.hp_marked + marks), armor_marked: c.armor_marked + (useArmor && armorLeft > 0 ? 1 : 0) })
        onClose()
      }}>Applica</button>
    </Sheet>
  )
}

const d4 = () => 1 + Math.floor(Math.random() * 4)

export function RestSheet({ open, onClose, c, patch }: { open: boolean; onClose: () => void; c: Character; patch: (p: Partial<Character>) => void }) {
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
    { id: 'wounds', label: 'Curare le ferite', desc: kind === 'short' ? 'Libera 1d4 + grado PF' : 'Libera tutti i PF' },
    { id: 'stress', label: 'Liberarsi dello stress', desc: kind === 'short' ? 'Libera 1d4 + grado Stress' : 'Libera tutto lo Stress' },
    { id: 'armor', label: 'Riparare l’armatura', desc: kind === 'short' ? 'Libera 1d4 + grado slot Armatura' : 'Libera tutti gli slot Armatura' },
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
      <button className="btn btn-primary" onClick={onClose}>Fine del riposo</button>
    </Sheet>
  )
}
