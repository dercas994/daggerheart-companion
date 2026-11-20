import { useState } from 'react'
import type { Character, Homebrew, HomebrewKind, SheetData, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { IT } from '../data'
import { armorScore, fmt, HB, weaponDamage } from '../lib/rules'
import { ErrorLine, Pips, Sheet, Stepper } from './ui'

export const KIND_LABEL: Record<HomebrewKind, string> = { weapon: 'Arma', armor: 'Armatura', ability: 'Capacità', item: 'Oggetto' }
const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'] as const
const newId = () => Math.random().toString(36).slice(2, 10)

function blank(kind: HomebrewKind): Homebrew {
  const base: Homebrew = { id: newId(), kind, name: '', text: '' }
  if (kind === 'weapon') return { ...base, trait: 'strength', range: 'Melee', dice: 'd8', damageType: 'phy', burden: 'One-Handed', category: 'primary' }
  if (kind === 'armor') return { ...base, thresholds: [5, 11], score: 3 }
  if (kind === 'item') return { ...base, quantity: 1, uses: 0, used: 0, mods: {} }
  return { ...base, uses: 0, used: 0, mods: {} }
}

/** Riepilogo compatto delle statistiche di un elemento homebrew. */
export function homebrewStats(h: Homebrew, proficiency = 1) {
  const m = h.mods ?? {}
  const modParts = [m.evasion ? `Evasione ${fmt(m.evasion)}` : '', m.armor ? `Armatura ${fmt(m.armor)}` : '', m.thresholds ? `Soglie ${fmt(m.thresholds)}` : '',
    ...Object.entries(m.traits ?? {}).filter(([, v]) => v).map(([t, v]) => `${IT.traits[t as TraitKey]} ${fmt(v!)}`)].filter(Boolean)
  if (h.kind === 'weapon') {
    return [`${IT.traits[h.trait ?? 'strength']}, ${IT.range[h.range ?? 'Melee']}, ${weaponDamage(`${h.dice || 'd6'} ${h.damageType ?? 'phy'}`, proficiency)}, ${IT.burden[h.burden ?? 'One-Handed']}, ${h.category === 'secondary' ? 'secondaria' : 'primaria'}`, ...modParts].join(', ')
  }
  if (h.kind === 'armor') return [`Soglie base ${h.thresholds?.[0]}/${h.thresholds?.[1]}, punteggio ${h.score}`, ...modParts].join(', ')
  const parts = [...modParts]
  if (h.kind === 'item' && (h.quantity ?? 1) !== 1) parts.unshift(`× ${h.quantity}`)
  return parts.filter(Boolean).join(', ')
}

/** Elenco dell'homebrew del PG con creazione, modifica ed eliminazione. */
export function HomebrewSection({ c, canEdit, patch }: { c: Character; canEdit: boolean; patch: (p: Partial<Character>) => void }) {
  const d = c.data
  const list = d.homebrew ?? []
  const [editing, setEditing] = useState<Homebrew | null>(null)

  function save(next: Homebrew[], extra: Partial<SheetData> = {}) {
    const nd = { ...d, ...extra, homebrew: next }
    const max = armorScore(nd)
    patch({ data: nd, armor_max: max, armor_marked: Math.min(c.armor_marked, max) })
  }
  function upsert(h: Homebrew) {
    const exists = list.some(x => x.id === h.id)
    save(exists ? list.map(x => (x.id === h.id ? h : x)) : [...list, h])
    setEditing(null)
  }
  function remove(h: Homebrew) {
    const id = HB + h.id
    // se era equipaggiato, lo tolgo dagli slot
    const extra: Partial<SheetData> = {}
    if (d.primary_weapon_id === id) extra.primary_weapon_id = ''
    if (d.secondary_weapon_id === id) extra.secondary_weapon_id = ''
    if (d.armor_id === id) extra.armor_id = ''
    save(list.filter(x => x.id !== h.id), extra)
    setEditing(null)
  }
  function setUsed(h: Homebrew, n: number) { save(list.map(x => (x.id === h.id ? { ...x, used: n } : x))) }
  function equip(h: Homebrew) {
    const id = HB + h.id
    if (h.kind === 'armor') return save(list, { armor_id: d.armor_id === id ? '' : id })
    if (h.category === 'secondary') return save(list, { secondary_weapon_id: d.secondary_weapon_id === id ? '' : id })
    const twoHanded = h.burden === 'Two-Handed'
    save(list, { primary_weapon_id: d.primary_weapon_id === id ? '' : id, ...(twoHanded ? { secondary_weapon_id: '' } : {}) })
  }
  const equipped = (h: Homebrew) => [d.primary_weapon_id, d.secondary_weapon_id, d.armor_id].includes(HB + h.id)

  return (
    <section>
      <div className="section-head">
        <h2>Homebrew</h2>
        {canEdit && (
          <div className="hb-add">
            {(['ability', 'item', 'weapon', 'armor'] as HomebrewKind[]).map(k => (
              <button key={k} className="btn btn-ghost small" onClick={() => setEditing(blank(k))}>+ {KIND_LABEL[k]}</button>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 && <p className="empty">Armi, armature, capacità e oggetti inventati da voi compaiono qui.</p>}
      <div className="hb-list">
        {list.map(h => (
          <article key={h.id} className={`hb-item kind-${h.kind}`}>
            <header>
              <span className="hb-kind">{KIND_LABEL[h.kind]}</span>
              <b className="hb-name">{h.name}</b>
              {canEdit && <button className="btn btn-ghost small" onClick={() => setEditing(h)}>Modifica</button>}
            </header>
            {homebrewStats(h, d.proficiency) && <p className="hb-stats">{homebrewStats(h, d.proficiency)}</p>}
            {h.text && <p className="hb-text">{h.text}</p>}
            {(h.uses ?? 0) > 0 && (
              <div className="hb-uses"><span>Usi</span>
                <Pips kind="stress" size="sm" max={h.uses!} value={h.used ?? 0} label={`Usi di ${h.name}`} onChange={canEdit ? n => setUsed(h, n) : undefined} />
              </div>
            )}
            {canEdit && (h.kind === 'weapon' || h.kind === 'armor') && (
              <button className={`btn small ${equipped(h) ? 'btn-hope' : 'btn-ghost'}`} onClick={() => equip(h)}>
                {equipped(h) ? 'Equipaggiato, togli' : 'Equipaggia'}
              </button>
            )}
          </article>
        ))}
      </div>
      {editing && <HomebrewEditor item={editing} onClose={() => setEditing(null)} onSave={upsert}
        onDelete={list.some(x => x.id === editing.id) ? () => remove(editing) : undefined} />}
    </section>
  )
}

function HomebrewEditor({ item, onClose, onSave, onDelete }: { item: Homebrew; onClose: () => void; onSave: (h: Homebrew) => void; onDelete?: () => void }) {
  const [h, setH] = useState<Homebrew>(item)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (p: Partial<Homebrew>) => setH(x => ({ ...x, ...p }))
  const setMod = (k: 'evasion' | 'armor' | 'thresholds', n: number) => set({ mods: { ...(h.mods ?? {}), [k]: n } })

  function submit() {
    if (!h.name.trim()) return setErr('Dai un nome.')
    if (h.kind === 'weapon' && !/^\d*d\d+(\s*[+-]\s*\d+)?$/i.test((h.dice ?? '').replace(/\s/g, ''))) return setErr('Il danno va scritto come d8, d10+3, 2d6+1…')
    onSave({ ...h, name: h.name.trim(), text: h.text.trim(), dice: h.dice?.replace(/\s/g, '').toLowerCase() })
  }

  return (
    <Sheet open onClose={onClose} title={`${onDelete ? 'Modifica' : 'Nuova'} ${KIND_LABEL[h.kind].toLowerCase()}`}>
      <label className="field"><span>Nome</span><input value={h.name} maxLength={60} onChange={e => set({ name: e.target.value })} autoFocus /></label>

      {h.kind === 'weapon' && (
        <>
          <div className="two-col">
            <label className="field"><span>Tratto</span>
              <select value={h.trait} onChange={e => set({ trait: e.target.value as TraitKey })}>
                {TRAITS.map(t => <option key={t} value={t}>{IT.traits[t]}</option>)}
              </select>
            </label>
            <label className="field"><span>Portata</span>
              <select value={h.range} onChange={e => set({ range: e.target.value as Homebrew['range'] })}>
                {RANGES.map(r => <option key={r} value={r}>{IT.range[r]}</option>)}
              </select>
            </label>
            <label className="field"><span>Dado di danno</span>
              <input value={h.dice} onChange={e => set({ dice: e.target.value })} placeholder="d8+2" />
            </label>
            <label className="field"><span>Tipo di danno</span>
              <select value={h.damageType} onChange={e => set({ damageType: e.target.value as 'phy' | 'mag' })}>
                <option value="phy">Fisico</option><option value="mag">Magico</option>
              </select>
            </label>
          </div>
          <div className="seg">
            <button type="button" className={h.category !== 'secondary' ? 'sel' : ''} onClick={() => set({ category: 'primary' })}>Primaria</button>
            <button type="button" className={h.category === 'secondary' ? 'sel' : ''} onClick={() => set({ category: 'secondary', burden: 'One-Handed' })}>Secondaria</button>
          </div>
          <div className="seg">
            <button type="button" className={h.burden !== 'Two-Handed' ? 'sel' : ''} onClick={() => set({ burden: 'One-Handed' })}>Una mano</button>
            <button type="button" className={h.burden === 'Two-Handed' ? 'sel' : ''} disabled={h.category === 'secondary'} onClick={() => set({ burden: 'Two-Handed' })}>Due mani</button>
          </div>
          <p className="hint">Il danno si moltiplica per la Competenza come le armi del manuale.</p>
        </>
      )}

      {h.kind === 'armor' && (
        <div className="edit-grid">
          <div className="edit-row"><span>Soglia Maggiore base</span><Stepper value={h.thresholds?.[0] ?? 5} min={1} max={40} onChange={n => set({ thresholds: [n, Math.max(n + 1, h.thresholds?.[1] ?? 11)] })} /></div>
          <div className="edit-row"><span>Soglia Grave base</span><Stepper value={h.thresholds?.[1] ?? 11} min={2} max={80} onChange={n => set({ thresholds: [Math.min(h.thresholds?.[0] ?? 5, n - 1), n] })} /></div>
          <div className="edit-row"><span>Punteggio Armatura</span><Stepper value={h.score ?? 3} min={0} max={12} onChange={n => set({ score: n })} /></div>
        </div>
      )}

      {(h.kind === 'weapon' || h.kind === 'armor') && (
        <>
          <p className="field-title">Bonus e penalità <small>(valgono solo quando è equipaggiata)</small></p>
          <div className="edit-grid">
            <div className="edit-row"><span>Evasione</span><Stepper value={h.mods?.evasion ?? 0} min={-5} max={10} onChange={n => setMod('evasion', n)} /></div>
            {h.kind === 'weapon' && <div className="edit-row"><span>Punteggio Armatura</span><Stepper value={h.mods?.armor ?? 0} min={-5} max={10} onChange={n => setMod('armor', n)} /></div>}
            <div className="edit-row"><span>Soglie di danno</span><Stepper value={h.mods?.thresholds ?? 0} min={-10} max={20} onChange={n => setMod('thresholds', n)} /></div>
          </div>
          <TraitMods h={h} set={set} />
        </>
      )}

      {(h.kind === 'ability' || h.kind === 'item') && (
        <>
          {h.kind === 'item' && <div className="edit-row"><span>Quantità</span><Stepper value={h.quantity ?? 1} min={0} max={99} onChange={n => set({ quantity: n })} /></div>}
          <p className="field-title">Bonus fissi <small>(si applicano da soli alla scheda)</small></p>
          <div className="edit-grid">
            <div className="edit-row"><span>Evasione</span><Stepper value={h.mods?.evasion ?? 0} min={-5} max={10} onChange={n => setMod('evasion', n)} /></div>
            <div className="edit-row"><span>Punteggio Armatura</span><Stepper value={h.mods?.armor ?? 0} min={-5} max={10} onChange={n => setMod('armor', n)} /></div>
            <div className="edit-row"><span>Soglie di danno</span><Stepper value={h.mods?.thresholds ?? 0} min={-10} max={20} onChange={n => setMod('thresholds', n)} /></div>
            <div className="edit-row"><span>Caselle d'uso</span><Stepper value={h.uses ?? 0} min={0} max={12} onChange={n => set({ uses: n, used: Math.min(h.used ?? 0, n) })} /></div>
          </div>
          <TraitMods h={h} set={set} />
        </>
      )}

      <label className="field"><span>{h.kind === 'weapon' || h.kind === 'armor' ? 'Caratteristica (facoltativa)' : 'Descrizione e regole'}</span>
        <textarea rows={4} value={h.text} onChange={e => set({ text: e.target.value })}
          placeholder={h.kind === 'ability' ? 'Una volta per riposo, potete spendere una Speranza per…' : h.kind === 'item' ? 'Cosa fa e da dove viene' : 'Es. Affilata: +1 ai tiri di danno'} />
      </label>

      <ErrorLine error={err} />
      <button className="btn btn-primary" onClick={submit}>Salva</button>
      {onDelete && (!confirmDel
        ? <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>Elimina</button>
        : <button className="btn btn-danger" onClick={onDelete}>Conferma: elimina {h.name}</button>)}
    </Sheet>
  )
}

/** Bonus o penalità ai tratti (es. armatura pesante: −1 Agilità). */
function TraitMods({ h, set }: { h: Homebrew; set: (p: Partial<Homebrew>) => void }) {
  const tr = h.mods?.traits ?? {}
  const any = Object.values(tr).some(v => v)
  const [open, setOpen] = useState(any)
  const setT = (t: TraitKey, n: number) => set({ mods: { ...(h.mods ?? {}), traits: { ...tr, [t]: n } } })
  return (
    <details className="trait-mods" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Bonus ai tratti{any ? `: ${Object.entries(tr).filter(([, v]) => v).map(([t, v]) => `${IT.traits[t as TraitKey]} ${fmt(v!)}`).join(', ')}` : ''}</summary>
      <div className="edit-grid">
        {TRAITS.map(t => (
          <div key={t} className="edit-row"><span>{IT.traits[t]}</span><Stepper value={tr[t] ?? 0} min={-5} max={5} onChange={n => setT(t, n)} /></div>
        ))}
      </div>
    </details>
  )
}
