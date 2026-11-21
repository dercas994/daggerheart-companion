import { accentVars } from '../components/Portrait'
import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { useApp } from '../App'
import type { Character, Roll, TraitKey } from '../lib/types'
import { useCampaignLive } from '../lib/live'
import { className, getAncestry, getCommunity, getSubclass } from '../data'
import { evasion, hopeMax, thresholds, massiveThreshold, spellcastTrait, attackWeapon, weaponModes, type WeaponModeKey } from '../lib/rules'
import { ErrorLine, Pips, Spinner, useToast } from '../components/ui'
import { TopBar } from '../components/TopBar'
import { DiceOverlay, outcomeText, rollTone } from '../components/Dice'
import { RollSheet, type RollChoice } from '../components/RollSheet'
import { DiceSheet, type DicePreset } from '../components/DiceSheet'
import { bonusText, type PendingBonus, type StressUse } from '../lib/costs'
import { parseDice } from '../lib/adversaries'
import type { DiceRequest } from '../lib/types'
import { GroupMoves } from '../components/GroupMoves'
import { TagTeamFlow } from '../components/TagTeam'
import { Countdowns } from '../components/Countdowns'
import { FearAura, HopeAura } from '../components/FearAura'
import { DeathCrack, LongRestSky, useRise } from '../components/Effects'
import { CardFlowDock, ModeSheet, ScaleSheet, type CardFlow } from '../components/CardPlay'
import { cannotUse, cardPatch, unstoppable, UNSTOPPABLE, type CardAction } from '../lib/cardEffects'
import { FearTrack, ownerName, PartyCard, RollLog } from '../components/Party'
import { SheetTab } from '../components/SheetTab'
import { CardsTab } from '../components/CardsTab'
import { DamageSheet, RestSheet, StressSheet } from '../components/Actions'
import { LevelUpSheet } from '../components/LevelUp'
import { EditSheet } from '../components/EditSheet'
import { BeastPanel, BeastSheet } from '../components/Beastform'
import type { BeastState } from '../lib/types'

type Tab = 'scheda' | 'carte' | 'gruppo' | 'tiri'

export function CharacterPage({ id }: { id: string }) {
  const { be, user } = useApp()
  const toast = useToast()
  const [campaignId, setCampaignId] = useState<string>()
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('scheda')
  const [rollOpen, setRollOpen] = useState(false)
  const [preset, setPreset] = useState<TraitKey | null>(null)
  const [overlay, setOverlay] = useState<{ roll: Roll; own: boolean } | null>(null)
  const [sheet, setSheet] = useState<null | 'damage' | 'stress' | 'rest' | 'level' | 'edit' | 'beast' | 'beastEvo'>(null)
  const [rolling, setRolling] = useState(false)
  const [diceOpen, setDiceOpen] = useState(false)
  const [dicePreset, setDicePreset] = useState<DicePreset | null>(null)
  const [rollPreset, setRollPreset] = useState<{ extra: number; label: string; note?: string; adv?: -1 | 0 | 1; cost?: { stress?: number; hope?: number } }>({ extra: 0, label: '' })
  const [pending, setPending] = useState<PendingBonus | null>(null)
  const [diceNote, setDiceNote] = useState(false)
  const [restRun, setRestRun] = useState(0)
  const [cardFlow, setCardFlow] = useState<CardFlow | null>(null)
  const [scaleAsk, setScaleAsk] = useState<{ card: { id: string; name: string }; action: CardAction } | null>(null)
  const [modeAsk, setModeAsk] = useState<{ card: { id: string; name: string }; action: CardAction; n: number } | null>(null)
  const diceForCard = useRef<CardFlow | null>(null)
  const [dawn, setDawn] = useState(false)

  // ricavo la campagna dal PG, poi uso lo stato live della campagna
  useEffect(() => { be.getCharacter(id).then(c => setCampaignId(c.campaign_id)).catch(e => setLoadErr(e.message)) }, [be, id])

  const live = useCampaignLive(be, campaignId, user.id, r => {
    toast({ text: outcomeText(r), tone: rollTone(r) })
  })
  const c = live.characters.find(x => x.id === id)
  const levelTick = useRise(c?.level)
  // le crepe partono dall'ultimo cuore segnato
  const vitalsRef = useRef<HTMLElement>(null)
  const [crackAt, setCrackAt] = useState({ x: 14, y: 30 })
  const dying = !!c && c.hp_max > 0 && c.hp_marked >= c.hp_max
  useLayoutEffect(() => {
    const box = vitalsRef.current
    if (!dying || !box) return
    const pips = [...box.querySelectorAll<HTMLElement>('.track-hp .pip')]
    if (!pips.length) return
    const r = box.getBoundingClientRect()
    const last = pips.map(p => p.getBoundingClientRect()).sort((a, b) => a.left - b.left)[0]
    setCrackAt({ x: ((last.left + last.width / 2 - r.left) / r.width) * 100, y: ((last.top + last.height / 2 - r.top) / r.height) * 100 })
  }, [dying])

  if (loadErr) return <div className="center-screen"><ErrorLine error={loadErr} /><a href="#/">Torna alla home</a></div>
  if (!c || !live.campaign) return <div className="center-screen"><Spinner /></div>

  const canEdit = c.owner_id === user.id || live.campaign.gm_id === user.id
  const patch = (p: Partial<Character>) => live.patchCharacter(c.id, p).catch(e => toast({ text: e.message, tone: 'error' }))
  const sub = getSubclass(c.data.class_id, c.data.subclass_id)
  const anc = c.data.ancestry_id === 'mixed'
    ? `${getAncestry(c.data.mixed?.[0])?.name ?? ''}/${getAncestry(c.data.mixed?.[1])?.name ?? ''}`
    : getAncestry(c.data.ancestry_id)?.name
  const [maj, sev] = thresholds(c.data, c.level)
  const ownPortrait = c.data.portrait_url
  const portrait = ownPortrait || getAncestry(c.data.ancestry_id === 'mixed' ? c.data.mixed?.[0] : c.data.ancestry_id)?.image

  function openRoll(t: TraitKey | null, o: { label?: string; adv?: -1 | 0 | 1; cost?: { stress?: number; hope?: number } } = {}) {
    setPreset(t)
    const p = pending && (pending.roll || pending.adv) ? pending : null
    const adv = ((p?.adv ? 1 : 0) + (o.adv ?? 0)) as -1 | 0 | 1
    const cost = o.cost?.stress || o.cost?.hope ? o.cost : undefined
    setRollPreset(p ? { extra: p.roll ?? 0, label: o.label ?? '', note: `${bonusText({ roll: p.roll, adv: p.adv })} da ${p.src}`, adv, cost } : { extra: 0, label: o.label ?? '', adv, cost })
    setRollOpen(true)
  }
  /** Usa una carta dominio: costo variabile (se serve), tiro, costo, poi il pannello con danni e promemoria. */
  function playCard(card: { id: string; name: string }, a: CardAction) {
    if (!c) return
    // Forma Bestiale: prima si sceglie la creatura
    if (card.id === 'cls:Forma Bestiale' && a.id === 'use') {
      if (c.data.beastform) { toast({ text: 'Sei già in Forma Bestiale: prima torna normale', tone: 'error' }); return }
      setSheet('beast'); return
    }
    const why = cannotUse(a, c, card.id)
    if (why) { toast({ text: why, tone: 'error' }); return }
    if (a.scale) { setScaleAsk({ card, action: a }); return }
    runCard(card, a, 1)
  }
  function runCard(card: { id: string; name: string }, a: CardAction, n: number, mode?: WeaponModeKey) {
    if (!c) return
    setScaleAsk(null)
    const w = attackWeapon(c.data)
    // arma con due modi d'uso: prima si sceglie quale
    const usesWeapon = a.roll === 'weapon' || a.damage?.dice === 'weapon'
    if (usesWeapon && w?.alts?.length && !mode) { setModeAsk({ card, action: a, n }); return }
    setModeAsk(null)
    const m = w ? weaponModes(w).find(x => x.key === (mode ?? 'main')) : undefined
    if (a.roll) {
      const trait = a.roll === 'spellcast' ? spellcastTrait(c.data)
        : a.roll === 'weapon' ? (m?.trait === 'spellcast' ? spellcastTrait(c.data) : (m?.trait as TraitKey | undefined) ?? null)
        : a.roll
      setCardFlow({ card, action: a, n, paid: false, mode })
      setPreset(trait)
      setRollPreset({ extra: 0, label: `${card.name}${a.difficulty ? ` (${a.difficulty})` : ''}${n > 1 ? ` ×${n}` : ''}${mode && mode !== 'main' && m ? `, ${m.name.toLowerCase()}` : ''}`, adv: a.roll === 'weapon' ? m?.adv ?? 0 : 0, cost: a.roll === 'weapon' && m && (m.stress || m.hope) ? { stress: m.stress, hope: m.hope } : undefined })
      setRollOpen(true)
      return
    }
    patch(cardPatch(c, card.id, a, n))
    afterPay(card, a, n)
    if (a.damage || a.dice || a.note || a.extras || a.toVault) setCardFlow({ card, action: a, n, paid: true, mode })
    else toast({ text: `${card.name}: ${a.label.toLowerCase()}`, tone: 'hope' })
  }
  /** Bonus e messaggi dopo aver pagato. */
  function afterPay(card: { id: string; name: string }, a: CardAction, n: number) {
    if (!c) return
    const b = a.bonusFn ? a.bonusFn(c, n) : a.bonus
    if (b) setPending({ src: card.name, ...b })
  }
  function transform(s: BeastState, cost: { stress: number; hope: number }) {
    if (!c) return
    patch({ stress_marked: Math.min(c.stress_max, c.stress_marked + cost.stress), hope: Math.max(0, c.hope - cost.hope), data: { ...c.data, beastform: s } })
    setSheet(null)
    toast({ text: 'Ti sei trasformato', tone: 'hope' })
  }
  function untransform() {
    if (!c) return
    const { beastform: _, ...rest } = c.data
    patch({ data: rest as typeof c.data })
    toast({ text: 'Sei tornato alla tua forma' })
  }
  function cardTokens(cardId: string, tokens: number) {
    if (!c) return
    const st = c.data.card_state ?? {}
    patch({ data: { ...c.data, card_state: { ...st, [cardId]: { ...st[cardId], tokens } } } })
  }
  function cardToVault(cardId: string) {
    if (!c) return
    patch({ data: { ...c.data, loadout: c.data.loadout.filter(x => x !== cardId), vault: [...c.data.vault.filter(x => x !== cardId), cardId] } })
    setCardFlow(null)
    toast({ text: 'Carta messa nel Rifugio' })
  }
  function cardDice(spec: { groups: { n: number; sides: number }[]; bonus: number }, label: string) {
    diceForCard.current = cardFlow
    doDice({ label, groups: spec.groups, bonus: spec.bonus, kind: 'dice' })
  }
  function cardDamage(spec: { groups: { n: number; sides: number }[]; bonus: number }, type: 'mag' | 'phy', label: string) {
    openDice({ label, groups: spec.groups, bonus: spec.bonus, type })
  }

  /** Segna lo Stress di una capacità e, se compra un bonus, lo tiene pronto per il prossimo tiro. */
  function markStress(u: StressUse, src: string) {
    if (!c) return
    if (c.stress_marked + u.stress > c.stress_max) { toast({ text: 'Non hai abbastanza Stress libero', tone: 'error' }); return }
    patch({ stress_marked: c.stress_marked + u.stress })
    if (u.bonus) setPending({ src, ...u.bonus })
    toast({ text: `${src}: segnat${u.stress === 1 ? 'o' : 'i'} ${u.stress} Stress${u.bonus ? `, ${bonusText(u.bonus)} al prossimo tiro` : ''}` })
  }

  async function doRoll(choice: RollChoice) {
    if (!c || !campaignId || rolling) return
    setRollOpen(false); setRolling(true)
    try {
      // il costo di una carta si paga quando si tira davvero
      const flow = cardFlow && !cardFlow.paid ? cardFlow : null
      const cp: Partial<Character> = flow ? cardPatch(c, flow.card.id, flow.action, flow.n) : {}
      // costo del modo d'uso dell'arma (es. 1 Stress per sparare)
      const mc = rollPreset.cost
      if (mc?.stress) cp.stress_marked = Math.min(c.stress_max, (cp.stress_marked ?? c.stress_marked) + mc.stress)
      const hope = (cp.hope ?? c.hope) - choice.hopeSpent - (mc?.hope ?? 0)
      if (flow || mc || choice.hopeSpent > 0) await live.patchCharacter(c.id, { ...cp, hope: Math.max(0, hope) })
      if (flow) afterPay(flow.card, flow.action, flow.n)
      const cost = flow
      const r = await be.roll(campaignId, c.id, { modifier: choice.modifier, label: choice.label, advantage: choice.advantage, manual: choice.manual, reaction: choice.reaction })
      if (cost) setCardFlow(f => (f && !f.paid ? { ...f, roll: r, paid: true } : f))
      if (rollPreset.note) setPending(p => p && (p.dmg || p.prof) ? { src: p.src, dmg: p.dmg, prof: p.prof } : null)
      live.addRoll(r)
      setOverlay({ roll: r, own: true })
      // l'aggiornamento arriva anche via realtime; rileggo per sicurezza
      be.getCharacter(c.id).then(x => live.setCharacters(xs => xs.map(y => (y.id === x.id ? x : y)))).catch(() => {})
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : String(e), tone: 'error' })
    } finally { setRolling(false) }
  }

  async function doDice(req: DiceRequest) {
    if (!c || !campaignId || rolling) return
    setDiceOpen(false); setRolling(true)
    try {
      const r = await be.rollDice(campaignId, c.id, req)
      // dopo un tiro di danno il Dado Inarrestabile sale; oltre il massimo si esaurisce
      const un = req.kind === 'damage' ? unstoppable(c) : null
      if (un) {
        const next = un.value + 1 > un.max ? 0 : un.value + 1
        const st = c.data.card_state ?? {}
        await live.patchCharacter(c.id, { data: { ...c.data, card_state: { ...st, [UNSTOPPABLE]: { ...st[UNSTOPPABLE], tokens: next } } } })
        toast({ text: next ? `Dado Inarrestabile: ${next}` : 'Il Dado Inarrestabile si esaurisce: non sei più Inarrestabile' })
      }
      const fl = diceForCard.current
      diceForCard.current = null
      if (fl?.action.exhaustOn && r.dice?.groups.some(g => g.rolls.includes(fl.action.exhaustOn!))) {
        const st = c.data.card_state ?? {}
        const cur = st[fl.card.id] ?? {}
        await live.patchCharacter(c.id, { data: { ...c.data, card_state: { ...st, [fl.card.id]: { ...cur, used: [...new Set([...(cur.used ?? []), fl.action.id])] } } } })
        toast({ text: `${fl.card.name}: esaurita fino al prossimo riposo` })
      }
      if (diceNote) setPending(p => p && (p.roll || p.adv) ? { src: p.src, roll: p.roll, adv: p.adv } : null)
      live.addRoll(r)
      setOverlay({ roll: r, own: true })
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : String(e), tone: 'error' })
    } finally { setRolling(false) }
  }
  function openDice(p: DicePreset | null) {
    // Guardiano Inarrestabile: il valore del dado si aggiunge ai danni
    const un = c ? unstoppable(c) : null
    if (p && un) p = { ...p, bonus: p.bonus + un.value, label: `${p.label}, +${un.value} Inarrestabile` }
    const b = p && pending && (pending.dmg || pending.prof) ? pending : null
    if (p && b) {
      const groups = p.groups.map((g, i) => (i === 0 && b.prof ? { ...g, n: g.n + b.prof } : g))
      const extra = b.dmg ? parseDice(b.dmg) : { groups: [], bonus: 0 }
      for (const g of extra.groups) {
        const same = groups.find(x => x.sides === g.sides)
        if (same) same.n += g.n; else groups.push({ ...g })
      }
      p = { ...p, groups, bonus: p.bonus + extra.bonus, label: `${p.label}, ${bonusText({ dmg: b.dmg, prof: b.prof })} da ${b.src}` }
    }
    setDiceNote(!!b); setDicePreset(p); setRollOpen(false); setDiceOpen(true)
  }

  const allies = live.characters.filter(x => x.id !== c.id)
  async function help(ally: Character) {
    if (!c || !campaignId) return
    await live.patchCharacter(c.id, { hope: Math.max(0, c.hope - 1) })
    const r = await be.rollDice(campaignId, c.id, { label: `Aiuta ${ally.name}`, groups: [{ n: 1, sides: 6 }], bonus: 0, kind: 'dice' })
    live.addRoll(r); setOverlay({ roll: r, own: true })
  }
  async function proposeTagTeam() {
    if (!c) return
    const t = await be.tagOpen(c.id)
    live.setTag(t)
    be.getCharacter(c.id).then(x => live.setCharacters(xs => xs.map(y => (y.id === x.id ? x : y)))).catch(() => {})
  }

  const others = live.characters.filter(x => x.id !== c.id)

  return (
    <div className="char-page" style={accentVars(c.data)}>
      <TopBar title={live.campaign.name} back={`#/c/${live.campaign.id}`}
        right={canEdit && <button className="btn btn-ghost small" onClick={() => setSheet('edit')}>Modifica</button>} />

      <header className="char-hero">
        {portrait && (
          <div className={`portrait-frame ${levelTick ? 'leveled' : ''}`} key={`f${levelTick}`}>
            <img className={`char-portrait ${ownPortrait ? 'own' : ''}`} src={portrait} alt={ownPortrait ? `Ritratto di ${c.name}` : ''} />
            {levelTick > 0 && (
              <svg className="lv-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="4" ry="4" pathLength={1} vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
        )}
        {levelTick > 0 && <p className="lv-engrave" key={`e${levelTick}`}>Livello {c.level}</p>}
        {!ownPortrait && canEdit && <button className="btn btn-ghost small hero-add-portrait" onClick={() => setSheet('edit')}>Aggiungi il ritratto del personaggio</button>}
        <h1 className="char-name">{c.name}</h1>
        <p className="char-line">
          {className(c.data.class_id)}{sub ? `, ${sub.name}` : ''}, livello {c.level}
          {c.data.pronouns && <span className="pron"> ({c.data.pronouns})</span>}
        </p>
        <p className="char-line dim">{[anc, getCommunity(c.data.community_id)?.name].filter(Boolean).join(', ')}</p>
      </header>

      {campaignId && <Countdowns campaignId={campaignId} isGm={live.campaign.gm_id === user.id} compact />}

      <section ref={vitalsRef} className={`vitals panel ${dying ? 'dying' : ''} ${c.stress_max > 0 && c.stress_marked >= c.stress_max ? 'stress-full' : ''} ${dawn ? 'dawn' : ''}`}>
        {dying && <DeathCrack seed={c.id} x={crackAt.x} y={crackAt.y} />}
        <div className="defense">
          <div className="def-box"><span>Evasione</span><b>{evasion(c.data)}</b></div>
          <div className="thresholds" aria-label="Soglie di danno">
            <span className="th-seg"><small>Minore</small><em>1 PF</em></span>
            <b>{maj}</b>
            <span className="th-seg"><small>Maggiore</small><em>2 PF</em></span>
            <b>{sev}</b>
            <span className="th-seg"><small>Grave</small><em>3 PF</em></span>
            <b>{massiveThreshold(sev)}</b>
            <span className="th-seg"><small>Massiccio</small><em>4 PF</em></span>
          </div>
        </div>
        <Track label="Punti Ferita" kind="hp" max={c.hp_max} value={c.hp_marked} onChange={canEdit ? n => patch({ hp_marked: n }) : undefined} />
        <Track label="Stress" kind="stress" max={c.stress_max} value={c.stress_marked} onChange={canEdit ? n => patch({ stress_marked: n }) : undefined} />
        <Track label="Speranza" kind="hope" max={hopeMax(c.data)} value={c.hope} onChange={canEdit ? n => patch({ hope: n }) : undefined} />
        {c.armor_max > 0 && <Track label="Armatura" kind="armor" max={c.armor_max} value={c.armor_marked} onChange={canEdit ? n => patch({ armor_marked: n }) : undefined} />}
        {canEdit && (
          <div className="quick-actions">
            <button className="btn btn-ghost small" onClick={() => setSheet('damage')}>Subisci danno</button>
            <button className="btn btn-ghost small" onClick={() => setSheet('stress')}>Subisci Stress</button>
            <button className="btn btn-ghost small" onClick={() => setSheet('rest')}>Riposo</button>
            {c.level < 10 && <button className="btn btn-ghost small" onClick={() => setSheet('level')}>Sali di livello</button>}
          </div>
        )}
      </section>

      {unstoppable(c) && (
        <p className="pending-bonus panel unstoppable">
          <span><b>Inarrestabile</b>: dado a {unstoppable(c)!.value} su d{unstoppable(c)!.max}. +{unstoppable(c)!.value} ai danni, danni fisici subiti −1 soglia.</span>
        </p>
      )}
      {pending && (
        <p className="pending-bonus panel">
          <span>Prossimo tiro: <b>{bonusText(pending)}</b> da {pending.src}</span>
          <button className="link-btn" onClick={() => setPending(null)}>Annulla</button>
        </p>
      )}

      <nav className="tabs" role="tablist">
        {(['scheda', 'carte', 'gruppo', 'tiri'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'sel' : ''} onClick={() => setTab(t)}>
            {{ scheda: 'Scheda', carte: 'Carte', gruppo: 'Gruppo', tiri: 'Tiri' }[t]}
          </button>
        ))}
      </nav>

      <main className="page tab-page">
        {tab === 'scheda' && c.data.beastform && <BeastPanel c={c} canEdit={canEdit} onExit={untransform} onPlay={playCard} onTokens={cardTokens} />}
        {tab === 'scheda' && <SheetTab onBeastEvo={() => c.data.beastform ? toast({ text: 'Sei già in Forma Bestiale', tone: 'error' }) : setSheet('beastEvo')} c={c} canEdit={canEdit} patch={patch} onRoll={openRoll} onDamage={openDice} allies={allies} onStress={markStress} onPlayCard={playCard} onCardTokens={cardTokens}
          afterGear={canEdit && <GroupMoves c={c} allies={allies} onHelp={help} onTagTeam={proposeTagTeam}
            onGroupAction={(m, l) => { setPreset(null); setRollPreset({ extra: m, label: l }); setRollOpen(true) }} />} />}
        {tab === 'carte' && <CardsTab c={c} canEdit={canEdit} patch={patch} onStress={markStress} onPlayCard={playCard} onCardTokens={cardTokens} />}
        {tab === 'gruppo' && (
          <>
            <section className="panel"><FearTrack value={live.campaign.fear} /></section>
            {others.length === 0 && <p className="empty">Gli altri personaggi della campagna compariranno qui.</p>}
            <div className="party-grid">{others.map(o => <PartyCard key={o.id} c={o} owner={ownerName(live.members, o.owner_id)} />)}</div>
          </>
        )}
        {tab === 'tiri' && <RollLog rolls={live.rolls} limit={40} />}
      </main>

      {canEdit && (
        <button className={`fab ${rolling ? 'busy' : ''}`} onClick={() => openRoll(null)} aria-label="Tira i dadi di Dualità">
          <span className="fab-dice"><i className="fd-hope" /><i className="fd-fear" /></span>
          <span>Tira</span>
        </button>
      )}

      <RollSheet open={rollOpen} onClose={() => { setRollOpen(false); setCardFlow(f => (f && !f.paid ? null : f)) }} character={c} presetTrait={preset} presetExtra={rollPreset.extra} presetLabel={rollPreset.label} presetNote={rollPreset.note} presetAdv={rollPreset.adv ?? 0} onRoll={doRoll} onOtherDice={() => openDice(null)} />
      {cardFlow && !rollOpen && !diceOpen && <CardFlowDock flow={cardFlow} c={c} onDamage={cardDamage} onDice={cardDice} onVault={() => cardToVault(cardFlow.card.id)} onClose={() => setCardFlow(null)} />}
      <ModeSheet ask={modeAsk} c={c} onPick={m => modeAsk && runCard(modeAsk.card, modeAsk.action, modeAsk.n, m)} onClose={() => setModeAsk(null)} />
      <ScaleSheet key={scaleAsk ? scaleAsk.card.id + scaleAsk.action.id : 'none'} ask={scaleAsk} c={c} onPick={n => scaleAsk && runCard(scaleAsk.card, scaleAsk.action, n)} onClose={() => setScaleAsk(null)} />
      <FearAura fear={live.campaign.fear} enabled />
      <HopeAura hope={c.hope} enabled={c.owner_id === user.id} wait={!!overlay} />
      <TagTeamFlow tag={live.tag} characters={live.characters} rolls={live.rolls} isGm={live.campaign.gm_id === user.id} onRollAdded={live.addRoll} />
      <DiceSheet open={diceOpen} onClose={() => setDiceOpen(false)} character={c} preset={dicePreset} onRoll={doDice} />
      {overlay && <DiceOverlay roll={overlay.roll} ownRoll={overlay.own} onClose={() => setOverlay(null)} />}
      <DamageSheet open={sheet === 'damage'} onClose={() => setSheet(null)} c={c} patch={patch} />
      <BeastSheet open={sheet === 'beast' || sheet === 'beastEvo'} evolution={sheet === 'beastEvo'} onClose={() => setSheet(null)} c={c} onTransform={transform} />
      <StressSheet open={sheet === 'stress'} onClose={() => setSheet(null)} c={c} patch={patch} />
      <RestSheet open={sheet === 'rest'} onClose={() => setSheet(null)} c={c} patch={patch} onLongRest={() => { setSheet(null); setRestRun(Date.now()) }} />
      <LongRestSky run={restRun} onDone={() => { setRestRun(0); setDawn(true); setTimeout(() => setDawn(false), 1600) }} />
      {sheet === 'level' && <LevelUpSheet open onClose={() => setSheet(null)} c={c} patch={patch} />}
      {sheet === 'edit' && <EditSheet open onClose={() => setSheet(null)} c={c} patch={patch}
        onDelete={async () => { await be.deleteCharacter(c.id); location.hash = `#/c/${c.campaign_id}` }} />}
    </div>
  )
}

const TRACK_WORD = {
  hp: (n: number) => n === 1 ? 'segnato' : 'segnati',
  stress: (n: number) => n === 1 ? 'segnato' : 'segnati',
  hope: () => '',
  armor: (n: number) => n === 1 ? 'usato' : 'usati',
}
function Track({ label, kind, max, value, onChange }: { label: string; kind: 'hp' | 'stress' | 'hope' | 'armor'; max: number; value: number; onChange?: (n: number) => void }) {
  return (
    <div className={`track track-${kind}`}>
      <div className="track-head"><span>{label}</span><span><b>{value}</b><small>{[TRACK_WORD[kind](value), `su ${max}`].filter(Boolean).join(" ")}</small></span></div>
      <Pips kind={kind} max={max} value={value} onChange={onChange} label={label} />
    </div>
  )
}
