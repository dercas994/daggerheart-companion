import { useState, type ReactNode } from 'react'
import type { Character, SheetData } from '../lib/types'
import { TRAITS } from '../lib/types'
import { ARMOR, IT, WEAPONS } from '../data'
import { armorScore, tierOf } from '../lib/rules'
import { Sheet, Stepper } from './ui'

/** Modifica libera della scheda: per correzioni, oggetti trovati, regole della casa. */
export function EditSheet({ open, onClose, c, patch, onDelete }: {
  open: boolean; onClose: () => void; c: Character; patch: (p: Partial<Character>) => void; onDelete: () => Promise<void>
}) {
  const [name, setName] = useState(c.name)
  const [level, setLevel] = useState(c.level)
  const [hp, setHp] = useState(c.hp_max)
  const [stress, setStress] = useState(c.stress_max)
  const [d, setD] = useState<SheetData>(() => structuredClone(c.data))
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (p: Partial<SheetData>) => setD(x => ({ ...x, ...p }))
  const tier = tierOf(level)
  const weapons = (cat: 'primary' | 'secondary') => WEAPONS.filter(w => w.category === cat && w.tier <= tier)

  function save() {
    const newArmor = armorScore(d)
    patch({
      name: name.trim() || c.name, level, hp_max: hp, stress_max: stress,
      hp_marked: Math.min(c.hp_marked, hp), stress_marked: Math.min(c.stress_marked, stress),
      armor_max: newArmor, armor_marked: Math.min(c.armor_marked, newArmor), data: d,
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Modifica scheda" wide>
      <div className="two-col">
        <label className="field"><span>Nome</span><input value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="field"><span>Pronomi</span><input value={d.pronouns} onChange={e => set({ pronouns: e.target.value })} /></label>
      </div>

      <div className="edit-grid">
        <Row label="Livello"><Stepper value={level} min={1} max={10} onChange={setLevel} /></Row>
        <Row label="Slot PF"><Stepper value={hp} min={1} max={12} onChange={setHp} /></Row>
        <Row label="Slot Stress"><Stepper value={stress} min={1} max={12} onChange={setStress} /></Row>
        <Row label="Competenza"><Stepper value={d.proficiency} min={1} max={6} onChange={n => set({ proficiency: n })} /></Row>
        <Row label="Bonus Evasione"><Stepper value={d.evasion_bonus} min={-5} max={10} onChange={n => set({ evasion_bonus: n })} /></Row>
        <Row label="Bonus soglie"><Stepper value={d.threshold_bonus} min={-5} max={20} onChange={n => set({ threshold_bonus: n })} /></Row>
        {TRAITS.map(t => (
          <Row key={t} label={IT.traits[t]}><Stepper value={d.traits[t]} min={-3} max={6} onChange={n => set({ traits: { ...d.traits, [t]: n } })} /></Row>
        ))}
      </div>

      <p className="field-title">Sottoclasse</p>
      <div className="seg">
        {(['foundation', 'specialization', 'mastery'] as const).map(t => (
          <button key={t} type="button" className={d.subclass_tier === t ? 'sel' : ''} onClick={() => set({ subclass_tier: t })}>
            {{ foundation: 'Base', specialization: 'Specializzazione', mastery: 'Maestria' }[t]}
          </button>
        ))}
      </div>

      <p className="field-title">Equipaggiamento (fino al grado {tier})</p>
      <label className="field"><span>Arma primaria</span>
        <select value={d.primary_weapon_id} onChange={e => set({ primary_weapon_id: e.target.value })}>
          <option value="">Nessuna</option>
          {weapons('primary').map(w => <option key={w.id} value={w.id}>G{w.tier} {w.name}, {w.damage}</option>)}
        </select>
      </label>
      <label className="field"><span>Arma secondaria</span>
        <select value={d.secondary_weapon_id} onChange={e => set({ secondary_weapon_id: e.target.value })}>
          <option value="">Nessuna</option>
          {weapons('secondary').map(w => <option key={w.id} value={w.id}>G{w.tier} {w.name}, {w.damage}</option>)}
        </select>
      </label>
      <label className="field"><span>Armatura</span>
        <select value={d.armor_id} onChange={e => set({ armor_id: e.target.value })}>
          <option value="">Nessuna</option>
          {ARMOR.filter(a => a.tier <= tier).map(a => <option key={a.id} value={a.id}>G{a.tier} {a.name}, {a.thresholds.join('/')}, {a.score}</option>)}
        </select>
      </label>

      <p className="field-title">Esperienze</p>
      {d.experiences.map((e, i) => (
        <div key={i} className="exp-edit">
          <input value={e.name} onChange={ev => set({ experiences: d.experiences.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)) })} />
          <Stepper value={e.bonus} min={0} max={9} onChange={n => set({ experiences: d.experiences.map((x, j) => (j === i ? { ...x, bonus: n } : x)) })} />
          <button className="icon-btn" aria-label="Rimuovi" onClick={() => set({ experiences: d.experiences.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost small" onClick={() => set({ experiences: [...d.experiences, { name: '', bonus: 2 }] })}>Aggiungi Esperienza</button>

      <button className="btn btn-primary" onClick={save}>Salva modifiche</button>
      <hr />
      {!confirmDel
        ? <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>Elimina personaggio</button>
        : <button className="btn btn-danger" onClick={onDelete}>Conferma: elimina {c.name}</button>}
    </Sheet>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="edit-row"><span>{label}</span>{children}</div>
}
