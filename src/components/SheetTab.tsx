import { useState } from 'react'
import type { Character, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { className, fname, ftext, getAncestry, getArmor, getClass, getCommunity, getSubclass, getWeapon, IT, type Feature } from '../data'
import { ancestryFeatures, fmt, spellcastTrait, traitValue, weaponDamage } from '../lib/rules'
import { FeatureList } from './CardView'
import { Stepper } from './ui'

const CONDITIONS = ['Vulnerabile', 'Trattenuto', 'Nascosto', 'Distratto', 'Avvelenato', 'In fiamme']

export function SheetTab({ c, canEdit, patch, onRoll }: {
  c: Character; canEdit: boolean; patch: (p: Partial<Character>) => void; onRoll: (t: TraitKey | null) => void
}) {
  const d = c.data
  const cls = getClass(d.class_id)
  const sub = getSubclass(d.class_id, d.subclass_id)
  const spell = spellcastTrait(d)
  const setData = (p: Partial<typeof d>) => patch({ data: { ...d, ...p } })

  const subFeatures: Feature[] = sub ? [
    ...sub.foundation,
    ...(d.subclass_tier !== 'foundation' ? sub.specialization : []),
    ...(d.subclass_tier === 'mastery' ? sub.mastery : []),
  ] : []

  const ancFeatures: Feature[] = ancestryFeatures(d)

  const weapons = [getWeapon(d.primary_weapon_id), getWeapon(d.secondary_weapon_id)].filter(Boolean)
  const armor = getArmor(d.armor_id)

  return (
    <div className="sheet-tab">
      <section>
        <h2>Tratti</h2>
        <div className="traits">
          {TRAITS.map(t => (
            <button key={t} type="button" className={`trait ${spell === t ? 'spell' : ''} ${d.marked_traits?.includes(t) ? 'marked' : ''}`}
              onClick={() => canEdit && onRoll(t)} disabled={!canEdit} title={IT.traitVerbs[t]}>
              <span className="trait-v">{fmt(traitValue(d, t))}</span>
              <span className="trait-n">{IT.traits[t]}</span>
              {spell === t && <span className="trait-tag">incantesimi</span>}
            </button>
          ))}
        </div>
        <p className="hint">Tocca un tratto per tirare con quel modificatore. Competenza {d.proficiency}.</p>
      </section>

      <section>
        <h2>Armi e armatura</h2>
        <div className="gear">
          {weapons.map(w => w && (
            <div key={w.id} className="gear-item">
              <div className="gear-top">
                <b>{w.name}</b>
                {canEdit && <button className="btn btn-ghost small" onClick={() => onRoll(w.trait === 'spellcast' ? spell : (w.trait as TraitKey))}>Attacca</button>}
              </div>
              <span className="gear-stats">{IT.traits[w.trait]}, {IT.range[w.range] ?? w.range}, <b>{weaponDamage(w.damage, d.proficiency)}</b>, {IT.burden[w.burden]}</span>
              {w.feature && <span className="gear-feat">{w.feature_it || w.feature}</span>}
            </div>
          ))}
          {armor && (
            <div className="gear-item">
              <div className="gear-top"><b>{armor.name}</b></div>
              <span className="gear-stats">Soglie base {armor.thresholds[0]}/{armor.thresholds[1]}, punteggio {armor.score}</span>
              {armor.feature && <span className="gear-feat">{armor.feature_it || armor.feature}</span>}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2>Esperienze</h2>
        <ul className="exp-list">
          {d.experiences.filter(e => e.name).map((e, i) => <li key={i}><span>{e.name}</span><b>{fmt(e.bonus)}</b></li>)}
        </ul>
      </section>

      {cls && (
        <section>
          <h2>Privilegi</h2>
          <div className="hope-feature">
            <div>
              <p className="hf-title">{fname(cls.hope_feature)}</p>
              <p>{ftext(cls.hope_feature)}</p>
            </div>
            {canEdit && (
              <button className="btn btn-hope" disabled={c.hope < 3} onClick={() => patch({ hope: c.hope - 3 })}>Usa, 3 Speranza</button>
            )}
          </div>
          <FeatureList items={cls.features.map(f => ({ name: fname(f), text: ftext(f) }))} />
          {sub && (
            <>
              <p className="field-title">{sub.name} <small>({{ foundation: 'base', specialization: 'specializzazione', mastery: 'maestria' }[d.subclass_tier]})</small></p>
              <FeatureList items={subFeatures.map(f => ({ name: fname(f), text: ftext(f) }))} />
            </>
          )}
          {d.multiclass && (() => {
            const mc = getClass(d.multiclass.class_id)
            const ms = getSubclass(d.multiclass.class_id, d.multiclass.subclass_id)
            return mc ? (
              <>
                <p className="field-title">Multiclasse: {className(mc.id)}{ms ? `, ${ms.name}` : ''}</p>
                <FeatureList items={[...mc.features, ...(ms?.foundation ?? [])].map(f => ({ name: fname(f), text: ftext(f) }))} />
              </>
            ) : null
          })()}
          <p className="field-title">Retaggio e comunità</p>
          <FeatureList items={[...ancFeatures, ...(getCommunity(d.community_id)?.features ?? [])].map(f => ({ name: fname(f), text: ftext(f) }))} />
        </section>
      )}

      <section>
        <h2>Condizioni</h2>
        <div className="chip-grid">
          {CONDITIONS.map(k => {
            const on = d.conditions?.includes(k)
            return (
              <button key={k} type="button" disabled={!canEdit} className={`chip ${on ? 'sel fear' : ''}`}
                onClick={() => setData({ conditions: on ? d.conditions.filter(x => x !== k) : [...(d.conditions ?? []), k] })}>
                <span>{k}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Inventario</h2>
        <div className="gold">
          {(['handfuls', 'bags', 'chests'] as const).map(k => (
            <div key={k} className="gold-item">
              <span>{{ handfuls: 'Manciate', bags: 'Sacchi', chests: 'Forzieri' }[k]}</span>
              {canEdit ? <Stepper value={d.gold[k]} min={0} max={10} onChange={n => setData({ gold: { ...d.gold, [k]: n } })} /> : <b>{d.gold[k]}</b>}
            </div>
          ))}
        </div>
        <LazyText value={d.inventory} disabled={!canEdit} rows={4} onSave={v => setData({ inventory: v })} />
      </section>

      <section>
        <h2>Note</h2>
        <LazyText value={d.notes} disabled={!canEdit} rows={5} placeholder="PNG incontrati, indizi, promesse fatte" onSave={v => setData({ notes: v })} />
        {(d.description || d.background || d.connections) && (
          <details className="story">
            <summary>Aspetto, passato e legami</summary>
            {d.description && <p>{d.description}</p>}
            {d.background && <p className="pre">{d.background}</p>}
            {d.connections && <p className="pre">{d.connections}</p>}
          </details>
        )}
      </section>
    </div>
  )
}

/** Textarea che salva quando perde il focus, così non si scrive sul DB a ogni tasto. */
function LazyText({ value, onSave, disabled, rows, placeholder }: { value: string; onSave: (v: string) => void; disabled?: boolean; rows: number; placeholder?: string }) {
  const [v, setV] = useState(value)
  const [focused, setFocused] = useState(false)
  const shown = focused ? v : value
  return (
    <textarea rows={rows} value={shown} disabled={disabled} placeholder={placeholder}
      onFocus={() => { setV(value); setFocused(true) }}
      onChange={e => setV(e.target.value)}
      onBlur={() => { setFocused(false); if (v !== value) onSave(v) }} />
  )
}
