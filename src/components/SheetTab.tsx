import { useState, type ReactNode } from 'react'
import type { Character, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { className, fname, ftext, getAncestry, getClass, getCommunity, getSubclass, IT, type Feature } from '../data'
import { ancestryFeatures, fmt, getArmor, getWeapon, spellcastTrait, traitValue, weaponDamage, weaponDamageSpec, weaponModes, modeDamageSpec } from '../lib/rules'
import type { DicePreset } from './DiceSheet'
import { HomebrewSection } from './Homebrew'
import { FeatureList } from './CardView'
import { ErrorLine, Sheet, Stepper, useAsync, useToast } from './ui'
import { StressButtons } from './StressUse'
import type { StressUse } from '../lib/costs'
import { cardDef, featureKey, type CardAction } from '../lib/cardEffects'
import { CardActionButtons } from './CardPlay'
import { HbAbilities } from './Homebrew'
import { useApp } from '../App'
import { beastWeapon } from '../lib/beast'

const CONDITIONS = ['Vulnerabile', 'Trattenuto', 'Nascosto', 'Distratto', 'Avvelenato', 'In fiamme']

export function SheetTab({ c, canEdit, patch, onRoll, onDamage, allies = [], afterGear, onStress, onPlayCard, onCardTokens, onBeastEvo }: {
  c: Character; canEdit: boolean; patch: (p: Partial<Character>) => void; onRoll: (t: TraitKey | null, o?: { label?: string; adv?: -1 | 0 | 1; cost?: { stress?: number; hope?: number } }) => void; onDamage?: (p: DicePreset) => void
  allies?: Character[]; afterGear?: ReactNode; onStress?: (u: StressUse, src: string) => void
  onPlayCard?: (card: { id: string; name: string }, a: CardAction) => void; onCardTokens?: (cardId: string, n: number) => void; onBeastEvo?: () => void
}) {
  const toast = useToast()
  const [allyPick, setAllyPick] = useState(false)
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

  // in Forma Bestiale si attacca solo con la bestia
  const beastW = beastWeapon(d)
  const weapons = beastW ? [beastW] : [getWeapon(d.primary_weapon_id, d), getWeapon(d.secondary_weapon_id, d)].filter(Boolean)
  const armor = getArmor(d.armor_id, d)
  // privilegio giocabile: i suoi pulsanti; altrimenti i soli usi di Stress letti dal testo
  const sb = (f: { name: string; text: string }) => cardDef(featureKey(f.name))
    ? <CardActionButtons cardId={featureKey(f.name)} cardName={f.name} c={c} canEdit={canEdit} onPlay={onPlayCard} onTokens={onCardTokens} />
    : <StressButtons text={f.text} src={f.name} c={c} canEdit={canEdit} onUse={onStress} />
  // privilegio dell'arma o armatura: per l'homebrew con abilità separate, i loro pulsanti
  const gearFeature = (id: string, name: string, text: string) => {
    const h = id.startsWith('hb:') ? d.homebrew?.find(x => 'hb:' + x.id === id) : undefined
    if (h?.abilities?.length) return <HbAbilities h={h} c={c} canEdit={canEdit} onStress={onStress} onPlayCard={onPlayCard} onCardTokens={onCardTokens} compact />
    return <>{text && <span className="gear-feat">{text}</span>}{sb({ name, text })}</>
  }

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
                {canEdit && !w.alts?.length && (
                  <span className="gear-btns">
                    <button className="btn btn-ghost small" onClick={() => onRoll(w.trait === 'spellcast' ? spell : (w.trait as TraitKey), { label: w.name })}>Attacca</button>
                    {onDamage && weaponDamageSpec(w.damage, d.proficiency) && (
                      <button className="btn btn-ghost small btn-dmg" onClick={() => onDamage({ label: w.name, ...weaponDamageSpec(w.damage, d.proficiency)! })}>Danno</button>
                    )}
                  </span>
                )}
              </div>
              {weaponModes(w).map(m => {
                const multi = (w.alts?.length ?? 0) > 0
                const label = m.key === 'main' ? w.name : `${w.name}, ${m.name.toLowerCase()}`
                const cost = [m.hope ? `${m.hope} Speranza` : '', m.stress ? `${m.stress} Stress` : ''].filter(Boolean).join(' e ')
                const blocked = (m.hope ?? 0) > c.hope ? 'Speranza insufficiente' : c.stress_marked + (m.stress ?? 0) > c.stress_max ? 'Stress esaurito' : null
                const spec = modeDamageSpec(m, d.proficiency)
                return (
                  <div key={m.key} className={`gear-mode ${multi ? 'multi' : ''}`}>
                    <span className="gear-stats">
                      {multi && <b className="mode-name">{m.key === 'main' ? (IT.range[m.range] ?? m.range) : m.name}: </b>}
                      {IT.traits[m.trait]}, {IT.range[m.range] ?? m.range}, <b>{weaponDamage(m.damage, d.proficiency)}{m.extra ? ` +${m.extra.replace(/^\+/, '')}` : ''}</b>
                      {m.key === 'main' && w.id !== 'beast' ? `, ${IT.burden[w.burden]}` : ''}{m.adv === -1 ? ', con svantaggio' : ''}{cost ? `, costa ${cost}` : ''}
                    </span>
                    {canEdit && multi && (
                      <span className="gear-btns">
                        <button className="btn btn-ghost small" disabled={!!blocked} title={blocked ?? undefined}
                          onClick={() => onRoll(m.trait === 'spellcast' ? spell : (m.trait as TraitKey), { label, adv: m.adv, cost: { stress: m.stress, hope: m.hope } })}>
                          Attacca{cost ? `, ${cost}` : ''}
                        </button>
                        {onDamage && spec && <button className="btn btn-ghost small btn-dmg" onClick={() => onDamage({ label, ...spec })}>Danno</button>}
                      </span>
                    )}
                  </div>
                )
              })}
              {gearFeature(w.id, w.name, w.feature_it || w.feature || '')}
            </div>
          ))}
          {armor && (
            <div className="gear-item">
              <div className="gear-top"><b>{armor.name}</b></div>
              <span className="gear-stats">Soglie base {armor.thresholds[0]}/{armor.thresholds[1]}, punteggio {armor.score}</span>
              {gearFeature(armor.id, armor.name, armor.feature_it || armor.feature || '')}
            </div>
          )}
        </div>
      </section>

      {afterGear}
      {allyPick && <ProtectLife c={c} allies={allies} onClose={() => setAllyPick(false)} />}

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
              <HopeFeatureButton c={c} classId={d.class_id} patch={patch} toast={toast} onAlly={() => setAllyPick(true)} onBeast={onBeastEvo} />
            )}
          </div>
          <FeatureList extra={sb} items={cls.features.map(f => ({ name: fname(f), text: ftext(f) }))} />
          {sub && (
            <>
              <p className="field-title">{sub.name} <small>({{ foundation: 'base', specialization: 'specializzazione', mastery: 'maestria' }[d.subclass_tier]})</small></p>
              <FeatureList extra={sb} items={subFeatures.map(f => ({ name: fname(f), text: ftext(f) }))} />
            </>
          )}
          {d.multiclass && (() => {
            const mc = getClass(d.multiclass.class_id)
            const ms = getSubclass(d.multiclass.class_id, d.multiclass.subclass_id)
            return mc ? (
              <>
                <p className="field-title">Multiclasse: {className(mc.id)}{ms ? `, ${ms.name}` : ''}</p>
                <FeatureList extra={sb} items={[...mc.features, ...(ms?.foundation ?? [])].map(f => ({ name: fname(f), text: ftext(f) }))} />
              </>
            ) : null
          })()}
          <p className="field-title">Retaggio e comunità</p>
          <FeatureList extra={sb} items={[...ancFeatures, ...(getCommunity(d.community_id)?.features ?? [])].map(f => ({ name: fname(f), text: ftext(f) }))} />
        </section>
      )}

      <HomebrewSection c={c} canEdit={canEdit} patch={patch} onStress={onStress} onPlayCard={onPlayCard} onCardTokens={onCardTokens} />

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

/**
 * Privilegio Speranza della classe (3 Speranza). Dove l'effetto è un numero sulla scheda
 * lo applico; negli altri casi tolgo la Speranza e ricordo cosa fare.
 */
const HOPE_EFFECT: Record<string, { apply?: (c: Character) => Partial<Character>; can?: (c: Character) => string | null; done: string }> = {
  guardian: { apply: c => ({ armor_marked: Math.max(0, c.armor_marked - 2) }), can: c => c.armor_marked === 0 ? 'Non hai slot Armatura segnati' : null, done: 'Liberati 2 slot Armatura' },
  assassin: { apply: c => ({ stress_marked: Math.max(0, c.stress_marked - 2) }), can: c => c.stress_marked === 0 ? 'Non hai Stress segnato' : null, done: 'Rimossi 2 Stress' },
  rogue: { done: '+2 Evasione fino al prossimo attacco che ti colpisce (o al riposo): ricordalo al master' },
  warrior: { done: '+1 ai tiri attacco fino al prossimo riposo: aggiungilo in «Altri modificatori»' },
  warlock: { done: 'Ripeti il tiro fallito con vantaggio' },
  witch: { done: 'Il tiro fallito diventa un successo con Paura' },
  sorcerer: { done: 'Ritira i dadi di danno che vuoi' },
  druid: { done: 'Ti trasformi senza segnare Stress; +1 a un tratto finché resti in Forma Bestiale' },
}

function HopeFeatureButton({ c, classId, patch, toast, onAlly, onBeast }: {
  c: Character; classId: string; patch: (p: Partial<Character>) => void; toast: ReturnType<typeof useToast>; onAlly: () => void; onBeast?: () => void
}) {
  const eff = HOPE_EFFECT[classId]
  const blocked = eff?.can?.(c) ?? null
  if (classId === 'druid' && onBeast) return <button className="btn btn-hope" disabled={c.hope < 3} onClick={onBeast}>Evoluzione, 3 Speranza</button>
  if (classId === 'seraph') return <button className="btn btn-hope" disabled={c.hope < 3} onClick={onAlly}>Usa, 3 Speranza</button>
  return (
    <button className="btn btn-hope" disabled={c.hope < 3 || !!blocked} title={blocked ?? undefined} onClick={() => {
      patch({ hope: c.hope - 3, ...(eff?.apply?.(c) ?? {}) })
      toast({ text: eff?.done ?? 'Spese 3 Speranza', tone: 'hope' })
    }}>Usa, 3 Speranza</button>
  )
}

function ProtectLife({ c, allies, onClose }: { c: Character; allies: Character[]; onClose: () => void }) {
  const { be } = useApp()
  const toast = useToast()
  const job = useAsync()
  const hurt = allies.filter(a => a.hp_marked > 0)
  return (
    <Sheet open onClose={onClose} title="Proteggere la Vita">
      <p className="hint">Spendi 3 Speranza per togliere un Punto Ferita a un alleato entro distanza Ravvicinata.</p>
      {hurt.length === 0 && <p className="empty">Nessun alleato ha Punti Ferita segnati.</p>}
      <div className="chip-grid">
        {hurt.map(a => (
          <button key={a.id} className="chip" disabled={job.busy} onClick={async () => {
            if (await job.run(() => be.protectLife(c.id, a.id).then(() => true))) { toast({ text: `${a.name}: −1 Punto Ferita`, tone: 'hope' }); onClose() }
          }}><span>{a.name}</span><b>{a.hp_marked} PF</b></button>
        ))}
      </div>
      <ErrorLine error={job.error} />
    </Sheet>
  )
}
