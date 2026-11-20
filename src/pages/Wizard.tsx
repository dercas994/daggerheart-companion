import { useMemo, useState } from 'react'
import { useApp } from '../App'
import type { SheetData, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import {
  ANCESTRIES, ARMOR, CARDS, CLASSES, COMMUNITIES, WEAPONS, className, domainName, DOMAIN_COLOR, getAncestry, getArmor,
  getClass, getCommunity, getSubclass, getWeapon, IT,
} from '../data'
import { ancestryMods, armorScore, emptySheet, evasion, fmt, thresholds, TRAIT_ARRAY, weaponDamage } from '../lib/rules'
import { go } from '../lib/router'
import { ErrorLine, useAsync } from '../components/ui'
import { TopBar } from '../components/TopBar'
import { DomainCardView, FeatureList } from '../components/CardView'
import { PortraitPicker } from '../components/Portrait'

const STEPS = ['Classe', 'Sottoclasse', 'Retaggio', 'Comunità', 'Tratti', 'Equipaggiamento', 'Esperienze', 'Carte dominio', 'Dettagli'] as const
const ACCENTS = ['#E9B949', '#D9774B', '#C8553D', '#C9579A', '#9A6BE0', '#5B7BD6', '#4FA3A5', '#5E9A57', '#B9AE96']

export function WizardPage({ campaignId }: { campaignId: string }) {
  const { be } = useApp()
  const [step, setStep] = useState(0)
  const [d, setD] = useState<SheetData>(() => emptySheet())
  const [name, setName] = useState('')
  const [portrait, setPortrait] = useState<{ blob: Blob; url: string } | null>(null)
  const save = useAsync()
  const set = (p: Partial<SheetData>) => setD(x => ({ ...x, ...p }))

  const cls = getClass(d.class_id)
  const valid = [
    !!cls,
    !!getSubclass(d.class_id, d.subclass_id),
    d.ancestry_id === 'mixed' ? !!(d.mixed?.[0] && d.mixed?.[1]) : !!d.ancestry_id,
    !!d.community_id,
    [...Object.values(d.traits)].sort((a, b) => b - a).join() === TRAIT_ARRAY.join(),
    !!d.primary_weapon_id && !!d.armor_id,
    d.experiences.every(e => e.name.trim()),
    d.loadout.length === 2,
    name.trim().length > 0,
  ]

  async function create() {
    const c = getClass(d.class_id)!
    const mods = ancestryMods(d)
    const data = { ...d, hope_max: 6 + mods.hope }
    const created = await save.run(() => be.createCharacter({
      campaign_id: campaignId, name: name.trim(), level: 1,
      hp_max: c.hp + mods.hp, hp_marked: 0, stress_max: 6, stress_marked: 0, hope: 2,
      armor_max: armorScore(d), armor_marked: 0, data,
    }))
    if (created && portrait) {
      // il ritratto si carica dopo, perché serve l'id del personaggio
      try {
        const url = await be.uploadPortrait(campaignId, created.id, portrait.blob)
        await be.updateCharacter(created.id, { data: { ...created.data, portrait_url: url } })
      } catch { /* il PG è creato comunque: il ritratto si può aggiungere da Modifica */ }
    }
    if (created) go(`/pg/${created.id}`)
  }

  return (
    <>
      <TopBar title="Nuovo personaggio" back={`#/c/${campaignId}`} />
      <main className="page wizard">
        <ol className="steps" aria-label="Passaggi">
          {STEPS.map((s, i) => (
            <li key={s} className={`${i === step ? 'cur' : ''} ${valid[i] ? 'ok' : ''}`}>
              <button type="button" disabled={i > 0 && !valid.slice(0, i).every(Boolean)} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
                <span className="step-n">{i + 1}</span><span className="step-l">{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="wizard-body">
          {step === 0 && <StepClass d={d} set={set} />}
          {step === 1 && cls && <StepSubclass d={d} set={set} />}
          {step === 2 && <StepAncestry d={d} set={set} />}
          {step === 3 && <StepCommunity d={d} set={set} />}
          {step === 4 && <StepTraits d={d} set={set} />}
          {step === 5 && <StepGear d={d} set={set} />}
          {step === 6 && <StepExperiences d={d} set={set} />}
          {step === 7 && <StepCards d={d} set={set} />}
          {step === 8 && <StepDetails d={d} set={set} name={name} setName={setName} portrait={portrait?.url} setPortrait={(blob, url) => setPortrait(blob ? { blob, url } : null)} />}
        </div>

        <ErrorLine error={save.error} />
        <div className="wizard-nav">
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Indietro</button>
          {step < STEPS.length - 1
            ? <button className="btn btn-primary" disabled={!valid[step]} onClick={() => setStep(s => s + 1)}>Avanti: {STEPS[step + 1]}</button>
            : <button className="btn btn-primary" disabled={!valid.every(Boolean) || save.busy} onClick={create}>Crea il personaggio</button>}
        </div>
      </main>
    </>
  )
}

type StepProps = { d: SheetData; set: (p: Partial<SheetData>) => void }

function StepClass({ d, set }: StepProps) {
  return (
    <>
      <h2>Scegli la classe</h2>
      <div className="pick-grid">
        {CLASSES.map(c => (
          <button key={c.id} type="button" className={`pick ${d.class_id === c.id ? 'sel' : ''}`}
            onClick={() => set({ class_id: c.id, subclass_id: '', loadout: [], primary_weapon_id: '', secondary_weapon_id: '' })}>
            <span className="pick-title">{className(c.id)}</span>
            <span className="pick-domains">
              {c.domains.map(x => <span key={x} className="dom-tag" style={{ ['--dom' as any]: DOMAIN_COLOR[x] }}>{domainName(x)}</span>)}
            </span>
            <span className="pick-stats">Evasione {c.evasion}, PF {c.hp}</span>
          </button>
        ))}
      </div>
      {getClass(d.class_id) && <ClassDetail id={d.class_id} />}
    </>
  )
}

function ClassDetail({ id }: { id: string }) {
  const c = getClass(id)!
  return (
    <div className="panel detail">
      <h3>{className(c.id)}</h3>
      <p className="lore">{c.description}</p>
      <p className="field-title">Privilegio della Speranza</p>
      <FeatureList items={[c.hope_feature]} />
      <p className="field-title">Privilegi di classe</p>
      <FeatureList items={c.features} />
      <p className="hint">Oggetti di classe: {c.items}</p>
    </div>
  )
}

function StepSubclass({ d, set }: StepProps) {
  const c = getClass(d.class_id)!
  return (
    <>
      <h2>Sottoclasse di {className(c.id)}</h2>
      <div className="sub-grid">
        {c.subclasses.map(s => (
          <button key={s.id} type="button" className={`pick big ${d.subclass_id === s.id ? 'sel' : ''}`} onClick={() => set({ subclass_id: s.id })}>
            <span className="pick-title">{s.name}</span>
            <span className="pick-desc">{s.description}</span>
            {s.spellcast && <span className="pick-stats">Tratto da incantatore: {IT.traits[s.spellcast]}</span>}
            <FeatureList items={s.foundation} />
          </button>
        ))}
      </div>
    </>
  )
}

function HeritagePicker({ items, value, onPick, label }: { items: typeof ANCESTRIES; value: string; onPick: (id: string) => void; label: string }) {
  const [q, setQ] = useState('')
  const list = items.filter(a => a.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <input className="search" placeholder={`Cerca ${label}`} value={q} onChange={e => setQ(e.target.value)} />
      <div className="list-pick">
        {list.map(a => (
          <button key={a.id} type="button" className={`list-item heritage ${value === a.id ? 'sel' : ''} ${a.image ? 'has-img' : ''}`} onClick={() => onPick(a.id)}>
            {a.image && <img src={a.image} alt="" loading="lazy" />}
            <span className="pick-title">{a.name}{a.custom && <span className="hb-tag">del tavolo</span>}</span>
            <span className="list-feats">{a.features.map(f => f.name).join(', ') || 'Due retaggi combinati'}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function StepAncestry({ d, set }: StepProps) {
  const a = getAncestry(d.ancestry_id)
  const pure = ANCESTRIES.filter(x => x.id !== 'mixed')
  return (
    <>
      <h2>Retaggio</h2>
      <HeritagePicker items={ANCESTRIES} value={d.ancestry_id} label="un retaggio" onPick={id => set({ ancestry_id: id, mixed: id === 'mixed' ? ['', ''] : undefined })} />
      {a && a.id !== 'mixed' && (
        <div className={`panel detail ${a.card ? 'with-card' : ''}`}>
          {a.card && <img className="heritage-card" src={a.card} alt={`Carta del retaggio ${a.name}`} />}
          <div><h3>{a.name}</h3><p className="lore">{a.description}</p><FeatureList items={a.features} /></div>
        </div>
      )}
      {a?.id === 'mixed' && (
        <div className="panel detail">
          <h3>Retaggio misto</h3>
          <p className="hint">Prendi la prima capacità da un retaggio e la seconda da un altro.</p>
          <div className="two-col">
            <label className="field"><span>Prima capacità da</span>
              <select value={d.mixed?.[0] ?? ''} onChange={e => set({ mixed: [e.target.value, d.mixed?.[1] ?? ''] })}>
                <option value="">Scegli</option>{pure.map(x => <option key={x.id} value={x.id}>{x.name}: {x.features[0]?.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Seconda capacità da</span>
              <select value={d.mixed?.[1] ?? ''} onChange={e => set({ mixed: [d.mixed?.[0] ?? '', e.target.value] })}>
                <option value="">Scegli</option>{pure.map(x => <option key={x.id} value={x.id}>{x.name}: {x.features[1]?.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </>
  )
}

function StepCommunity({ d, set }: StepProps) {
  const c = getCommunity(d.community_id)
  return (
    <>
      <h2>Comunità</h2>
      <HeritagePicker items={COMMUNITIES} value={d.community_id} label="una comunità" onPick={id => set({ community_id: id })} />
      {c && <div className="panel detail"><h3>{c.name}</h3><p className="lore">{c.description}</p><FeatureList items={c.features} /></div>}
    </>
  )
}

function StepTraits({ d, set }: StepProps) {
  const used = Object.values(d.traits)
  const remaining = [...TRAIT_ARRAY]
  for (const v of used) { const i = remaining.indexOf(v); if (i >= 0) remaining.splice(i, 1) }
  const spell = getSubclass(d.class_id, d.subclass_id)?.spellcast
  function assign(t: TraitKey, v: number) { set({ traits: { ...d.traits, [t]: v } }) }
  const ok = [...used].sort((a, b) => b - a).join() === TRAIT_ARRAY.join()
  return (
    <>
      <h2>Tratti</h2>
      <p className="hint">Distribuisci +2, +1, +1, +0, +0, −1. {spell && `Il tuo tratto da incantatore è ${IT.traits[spell]}.`}</p>
      <div className="trait-assign">
        {TRAITS.map(t => (
          <div key={t} className={`trait-row ${spell === t ? 'spell' : ''}`}>
            <div><b>{IT.traits[t]}</b><small>{IT.traitVerbs[t]}</small></div>
            <div className="seg tight">
              {[2, 1, 0, -1].map(v => (
                <button key={v} type="button" className={d.traits[t] === v ? 'sel' : ''} onClick={() => assign(t, v)}>{fmt(v)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className={ok ? 'notice' : 'hint'}>{ok ? 'Distribuzione corretta.' : `Ancora da assegnare: ${remaining.map(fmt).join(', ')}`}</p>
    </>
  )
}

function StepGear({ d, set }: StepProps) {
  const spell = getSubclass(d.class_id, d.subclass_id)?.spellcast
  const prim = WEAPONS.filter(w => w.tier === 1 && w.category === 'primary' && !w.id.includes('wheelchair') && (spell || !w.damage.endsWith('mag')))
  const wheel = WEAPONS.filter(w => w.tier === 1 && w.id.includes('wheelchair'))
  const p = getWeapon(d.primary_weapon_id)
  const sec = WEAPONS.filter(w => w.tier === 1 && w.category === 'secondary')
  const arm = ARMOR.filter(a => a.tier === 1)
  const [maj, sev] = thresholds(d, 1)
  return (
    <>
      <h2>Equipaggiamento</h2>
      <p className="field-title">Arma primaria</p>
      <WeaponTable list={[...prim, ...wheel]} value={d.primary_weapon_id} prof={1}
        onPick={id => set({ primary_weapon_id: id, secondary_weapon_id: getWeapon(id)?.burden === 'Two-Handed' ? '' : d.secondary_weapon_id })} />
      <p className="field-title">Arma secondaria {p?.burden === 'Two-Handed' && <small>(non disponibile con un’arma a due mani)</small>}</p>
      {p?.burden !== 'Two-Handed' && (
        <WeaponTable list={sec} value={d.secondary_weapon_id} prof={1} allowNone onPick={id => set({ secondary_weapon_id: id })} />
      )}
      <p className="field-title">Armatura</p>
      <div className="list-pick">
        {arm.map(a => (
          <button key={a.id} type="button" className={`list-item ${d.armor_id === a.id ? 'sel' : ''}`} onClick={() => set({ armor_id: a.id })}>
            <span className="pick-title">{a.name}</span>
            <span className="list-feats">Soglie {a.thresholds[0] + 1}/{a.thresholds[1] + 1}, Armatura {a.score}{a.feature ? `. ${a.feature_it || a.feature}` : ''}</span>
          </button>
        ))}
      </div>
      {d.armor_id && <p className="notice">Con questa scelta: Evasione {evasion(d)}, Armatura {armorScore(d)}, soglie {maj}, {sev} e {sev * 2} (danno massiccio).</p>}
    </>
  )
}

function WeaponTable({ list, value, onPick, allowNone, prof }: { list: typeof WEAPONS; value: string; onPick: (id: string) => void; allowNone?: boolean; prof: number }) {
  return (
    <div className="list-pick weapons">
      {allowNone && (
        <button type="button" className={`list-item ${!value ? 'sel' : ''}`} onClick={() => onPick('')}><span className="pick-title">Nessuna</span></button>
      )}
      {list.map(w => (
        <button key={w.id} type="button" className={`list-item ${value === w.id ? 'sel' : ''}`} onClick={() => onPick(w.id)}>
          <span className="pick-title">{w.name}</span>
          <span className="w-stats">{IT.traits[w.trait]}, {IT.range[w.range] ?? w.range}, {weaponDamage(w.damage, prof)}, {IT.burden[w.burden]}</span>
          {w.feature && <span className="list-feats">{w.feature_it || w.feature}</span>}
        </button>
      ))}
    </div>
  )
}

function StepExperiences({ d, set }: StepProps) {
  const upd = (i: number, name: string) => set({ experiences: d.experiences.map((e, j) => (j === i ? { ...e, name } : e)) })
  return (
    <>
      <h2>Esperienze</h2>
      <p className="hint">Due Esperienze a +2: un mestiere, un tratto del carattere, un passato. Spendi una Speranza per aggiungerne il bonus a un tiro.</p>
      {d.experiences.map((e, i) => (
        <label key={i} className="field"><span>Esperienza {i + 1} (+2)</span>
          <input value={e.name} maxLength={40} onChange={ev => upd(i, ev.target.value)} placeholder={i === 0 ? 'Cacciatore di taglie' : 'So sempre dove trovare un letto'} />
        </label>
      ))}
    </>
  )
}

function StepCards({ d, set }: StepProps) {
  const cls = getClass(d.class_id)!
  const [dom, setDom] = useState(cls.domains[0])
  const cards = useMemo(() => CARDS.filter(c => c.level === 1 && cls.domains.includes(c.domain)), [cls])
  function toggle(id: string) {
    const has = d.loadout.includes(id)
    set({ loadout: has ? d.loadout.filter(x => x !== id) : d.loadout.length < 2 ? [...d.loadout, id] : d.loadout })
  }
  return (
    <>
      <h2>Carte dominio <small>({d.loadout.length}/2)</small></h2>
      <p className="hint">Scegli due carte di livello 1 dai domini della tua classe.</p>
      <div className="seg">
        {cls.domains.map(x => <button key={x} type="button" className={dom === x ? 'sel' : ''} onClick={() => setDom(x)}>{domainName(x)}</button>)}
      </div>
      <div className="card-grid">
        {cards.filter(c => c.domain === dom).map(c => (
          <DomainCardView key={c.id} card={c} selected={d.loadout.includes(c.id)} dim={!d.loadout.includes(c.id) && d.loadout.length >= 2} onClick={() => toggle(c.id)} />
        ))}
      </div>
    </>
  )
}

function StepDetails({ d, set, name, setName, portrait, setPortrait }: StepProps & { name: string; setName: (s: string) => void; portrait?: string; setPortrait: (b: Blob | null, url: string) => void }) {
  const cls = getClass(d.class_id)!
  return (
    <>
      <h2>Chi è il tuo personaggio</h2>
      <div className="two-col">
        <label className="field"><span>Nome</span><input value={name} maxLength={60} onChange={e => setName(e.target.value)} autoFocus /></label>
        <label className="field"><span>Pronomi</span><input value={d.pronouns} onChange={e => set({ pronouns: e.target.value })} placeholder="lei/la" /></label>
      </div>
      <p className="field-title">Ritratto</p>
      <PortraitPicker current={portrait} name={name} accent={d.accent} onPick={(b, url) => setPortrait(b, url)} onRemove={() => setPortrait(null, '')} />
      <p className="field-title">Colore del personaggio</p>
      <div className="accent-row">
        {ACCENTS.map(a => <button key={a} type="button" className={`swatch ${d.accent === a ? 'sel' : ''}`} style={{ background: a }} onClick={() => set({ accent: a })} aria-label={`Colore ${a}`} />)}
      </div>
      <label className="field"><span>Aspetto</span>
        <textarea rows={2} value={d.description} onChange={e => set({ description: e.target.value })} placeholder="Abiti, occhi, corporatura, atteggiamento" />
      </label>
      <label className="field"><span>Passato</span>
        <textarea rows={4} value={d.background} onChange={e => set({ background: e.target.value })} placeholder={cls.background_questions.join('\n')} />
      </label>
      <label className="field"><span>Legami</span>
        <textarea rows={3} value={d.connections} onChange={e => set({ connections: e.target.value })} placeholder={cls.connections.join('\n')} />
      </label>
      <Summary d={d} name={name} />
    </>
  )
}

function Summary({ d, name }: { d: SheetData; name: string }) {
  const c = getClass(d.class_id), s = getSubclass(d.class_id, d.subclass_id)
  const anc = d.ancestry_id === 'mixed' ? `${getAncestry(d.mixed?.[0])?.name}/${getAncestry(d.mixed?.[1])?.name}` : getAncestry(d.ancestry_id)?.name
  return (
    <div className="panel summary">
      <h3>{name || 'Senza nome'}</h3>
      <p>{className(c?.id)}, {s?.name}. {anc}, {getCommunity(d.community_id)?.name}.</p>
      <p>{TRAITS.map(t => `${IT.traits[t]} ${fmt(d.traits[t])}`).join(', ')}</p>
      <p>{getWeapon(d.primary_weapon_id)?.name}{d.secondary_weapon_id ? ` e ${getWeapon(d.secondary_weapon_id)?.name}` : ''}, {getArmor(d.armor_id)?.name}</p>
    </div>
  )
}
