import { useState, type ReactNode } from 'react'
import type { Character, SheetData } from '../lib/types'
import { TRAITS } from '../lib/types'
import { ARMOR, IT, WEAPONS } from '../data'
import { armorScore, evasion, getArmor, getWeapon, HB, thresholds, tierOf, weaponDamage } from '../lib/rules'
import { ErrorLine, Sheet, Stepper, useAsync } from './ui'
import { PortraitPicker } from './Portrait'
import { useApp } from '../App'

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
  const { be } = useApp()
  const up = useAsync()
  async function pickPortrait(blob: Blob) {
    const url = await up.run(() => be.uploadPortrait(c.campaign_id, c.id, blob))
    if (!url) return
    const old = d.portrait_url
    set({ portrait_url: url })
    patch({ data: { ...c.data, portrait_url: url } })
    if (old) be.deletePortrait(old).catch(() => {})
  }
  async function removePortrait() {
    const old = d.portrait_url
    set({ portrait_url: undefined })
    patch({ data: { ...c.data, portrait_url: undefined } })
    if (old) be.deletePortrait(old).catch(() => {})
  }
  const set = (p: Partial<SheetData>) => setD(x => ({ ...x, ...p }))
  const tier = tierOf(level)
  const weapons = (cat: 'primary' | 'secondary') => WEAPONS.filter(w => w.category === cat && w.tier <= tier)
  const hb = (kind: 'weapon' | 'armor', cat?: 'primary' | 'secondary') => (d.homebrew ?? [])
    .filter(h => h.kind === kind && (!cat || (h.category ?? 'primary') === cat))
    .map(h => <option key={h.id} value={HB + h.id}>★ {h.name} (homebrew)</option>)

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
      <p className="field-title">Ritratto</p>
      <PortraitPicker current={d.portrait_url} name={name} accent={d.accent} busy={up.busy} onPick={pickPortrait} onRemove={removePortrait} />
      <ErrorLine error={up.error} />
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

      <p className="field-title">Equipaggiamento (fino al rango {tier})</p>
      <label className="field"><span>Arma primaria</span>
        <select value={d.primary_weapon_id} onChange={e => set({ primary_weapon_id: e.target.value })}>
          <option value="">Nessuna</option>
          {hb('weapon', 'primary')}
          {weapons('primary').map(w => <option key={w.id} value={w.id}>R{w.tier} {w.name}, {w.damage}</option>)}
        </select>
      </label>
      <WeaponPreview id={d.primary_weapon_id} d={d} />
      <label className="field"><span>Arma secondaria</span>
        <select value={d.secondary_weapon_id} onChange={e => set({ secondary_weapon_id: e.target.value })}>
          <option value="">Nessuna</option>
          {hb('weapon', 'secondary')}
          {weapons('secondary').map(w => <option key={w.id} value={w.id}>R{w.tier} {w.name}, {w.damage}</option>)}
        </select>
      </label>
      <WeaponPreview id={d.secondary_weapon_id} d={d} />
      <label className="field"><span>Armatura</span>
        <select value={d.armor_id} onChange={e => set({ armor_id: e.target.value })}>
          <option value="">Nessuna</option>
          {hb('armor')}
          {ARMOR.filter(a => a.tier <= tier).map(a => <option key={a.id} value={a.id}>R{a.tier} {a.name}, {a.thresholds.join('/')}, {a.score}</option>)}
        </select>
      </label>
      <ArmorPreview d={d} level={level} />
      <p className="hint">Le schede qui sopra mostrano cosa fa l’oggetto scelto: puoi provarne diversi, la scheda cambia solo quando premi Salva.</p>

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

/** Cosa fa l'arma scelta, per confrontare prima di salvare. */
function WeaponPreview({ id, d }: { id: string; d: SheetData }) {
  const w = getWeapon(id, d)
  if (!w) return null
  return (
    <div className="equip-preview">
      <p className="ep-stats">
        <span><small>Tratto</small>{IT.traits[w.trait] ?? w.trait}</span>
        <span><small>Portata</small>{IT.range[w.range] ?? w.range}</span>
        <span><small>Danno</small>{weaponDamage(w.damage, d.proficiency)}</span>
        <span><small>Impugnatura</small>{IT.burden[w.burden] ?? w.burden}</span>
      </p>
      {(w.feature_it || w.feature) && <p className="ep-feat">{w.feature_it || w.feature}</p>}
    </div>
  )
}

function ArmorPreview({ d, level }: { d: SheetData; level: number }) {
  const a = getArmor(d.armor_id, d)
  const [maj, sev] = thresholds(d, level)
  return (
    <div className="equip-preview">
      {a && <p className="ep-stats">
        <span><small>Soglie base</small>{a.thresholds[0]}/{a.thresholds[1]}</span>
        <span><small>Punteggio</small>{a.score}</span>
      </p>}
      {a && (a.feature_it || a.feature) && <p className="ep-feat">{a.feature_it || a.feature}</p>}
      <p className="ep-result">Con questo equipaggiamento: Evasione {evasion(d)}, Armatura {armorScore(d)}, soglie {maj} e {sev}.</p>
    </div>
  )
}
