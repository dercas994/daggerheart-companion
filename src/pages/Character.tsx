import { useEffect, useState } from 'react'
import { useApp } from '../App'
import type { Character, Roll, TraitKey } from '../lib/types'
import { useCampaignLive } from '../lib/live'
import { className, getAncestry, getCommunity, getSubclass } from '../data'
import { evasion, hopeMax, thresholds, massiveThreshold } from '../lib/rules'
import { ErrorLine, Pips, Spinner, useToast } from '../components/ui'
import { TopBar } from '../components/TopBar'
import { DiceOverlay, outcomeText, rollTone } from '../components/Dice'
import { RollSheet, type RollChoice } from '../components/RollSheet'
import { DiceSheet, type DicePreset } from '../components/DiceSheet'
import type { DiceRequest } from '../lib/types'
import { GroupMoves } from '../components/GroupMoves'
import { TagTeamFlow } from '../components/TagTeam'
import { Countdowns } from '../components/Countdowns'
import { FearAura } from '../components/FearAura'
import { FearTrack, ownerName, PartyCard, RollLog } from '../components/Party'
import { SheetTab } from '../components/SheetTab'
import { CardsTab } from '../components/CardsTab'
import { DamageSheet, RestSheet } from '../components/Actions'
import { LevelUpSheet } from '../components/LevelUp'
import { EditSheet } from '../components/EditSheet'

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
  const [sheet, setSheet] = useState<null | 'damage' | 'rest' | 'level' | 'edit'>(null)
  const [rolling, setRolling] = useState(false)
  const [diceOpen, setDiceOpen] = useState(false)
  const [dicePreset, setDicePreset] = useState<DicePreset | null>(null)
  const [rollPreset, setRollPreset] = useState<{ extra: number; label: string }>({ extra: 0, label: '' })

  // ricavo la campagna dal PG, poi uso lo stato live della campagna
  useEffect(() => { be.getCharacter(id).then(c => setCampaignId(c.campaign_id)).catch(e => setLoadErr(e.message)) }, [be, id])

  const live = useCampaignLive(be, campaignId, user.id, r => {
    toast({ text: outcomeText(r), tone: rollTone(r) })
  })
  const c = live.characters.find(x => x.id === id)

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

  function openRoll(t: TraitKey | null) { setPreset(t); setRollPreset({ extra: 0, label: '' }); setRollOpen(true) }

  async function doRoll(choice: RollChoice) {
    if (!c || !campaignId || rolling) return
    setRollOpen(false); setRolling(true)
    try {
      if (choice.hopeSpent > 0) await live.patchCharacter(c.id, { hope: Math.max(0, c.hope - choice.hopeSpent) })
      const r = await be.roll(campaignId, c.id, { modifier: choice.modifier, label: choice.label, advantage: choice.advantage, manual: choice.manual, reaction: choice.reaction })
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
      live.addRoll(r)
      setOverlay({ roll: r, own: true })
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : String(e), tone: 'error' })
    } finally { setRolling(false) }
  }
  function openDice(p: DicePreset | null) { setDicePreset(p); setRollOpen(false); setDiceOpen(true) }

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
    <div className="char-page" style={{ ['--accent' as any]: c.data.accent || 'var(--hope)' }}>
      <TopBar title={live.campaign.name} back={`#/c/${live.campaign.id}`}
        right={canEdit && <button className="btn btn-ghost small" onClick={() => setSheet('edit')}>Modifica</button>} />

      <header className="char-hero">
        {portrait && <img className={`char-portrait ${ownPortrait ? 'own' : ''}`} src={portrait} alt={ownPortrait ? `Ritratto di ${c.name}` : ''} />}
        {!ownPortrait && canEdit && <button className="btn btn-ghost small hero-add-portrait" onClick={() => setSheet('edit')}>Aggiungi il ritratto del personaggio</button>}
        <h1 className="char-name">{c.name}</h1>
        <p className="char-line">
          {className(c.data.class_id)}{sub ? `, ${sub.name}` : ''}, livello {c.level}
          {c.data.pronouns && <span className="pron"> ({c.data.pronouns})</span>}
        </p>
        <p className="char-line dim">{[anc, getCommunity(c.data.community_id)?.name].filter(Boolean).join(', ')}</p>
      </header>

      {campaignId && <Countdowns campaignId={campaignId} isGm={live.campaign.gm_id === user.id} compact />}

      <section className="vitals panel">
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
            <button className="btn btn-ghost small" onClick={() => setSheet('rest')}>Riposo</button>
            {c.level < 10 && <button className="btn btn-ghost small" onClick={() => setSheet('level')}>Sali di livello</button>}
          </div>
        )}
      </section>

      <nav className="tabs" role="tablist">
        {(['scheda', 'carte', 'gruppo', 'tiri'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'sel' : ''} onClick={() => setTab(t)}>
            {{ scheda: 'Scheda', carte: 'Carte', gruppo: 'Gruppo', tiri: 'Tiri' }[t]}
          </button>
        ))}
      </nav>

      <main className="page tab-page">
        {tab === 'scheda' && <SheetTab c={c} canEdit={canEdit} patch={patch} onRoll={openRoll} onDamage={openDice} allies={allies}
          afterGear={canEdit && <GroupMoves c={c} allies={allies} onHelp={help} onTagTeam={proposeTagTeam}
            onGroupAction={(m, l) => { setPreset(null); setRollPreset({ extra: m, label: l }); setRollOpen(true) }} />} />}
        {tab === 'carte' && <CardsTab c={c} canEdit={canEdit} patch={patch} />}
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

      <RollSheet open={rollOpen} onClose={() => setRollOpen(false)} character={c} presetTrait={preset} presetExtra={rollPreset.extra} presetLabel={rollPreset.label} onRoll={doRoll} onOtherDice={() => openDice(null)} />
      <FearAura fear={live.campaign.fear} enabled />
      <TagTeamFlow tag={live.tag} characters={live.characters} rolls={live.rolls} isGm={live.campaign.gm_id === user.id} onRollAdded={live.addRoll} />
      <DiceSheet open={diceOpen} onClose={() => setDiceOpen(false)} character={c} preset={dicePreset} onRoll={doDice} />
      {overlay && <DiceOverlay roll={overlay.roll} ownRoll={overlay.own} onClose={() => setOverlay(null)} />}
      <DamageSheet open={sheet === 'damage'} onClose={() => setSheet(null)} c={c} patch={patch} />
      <RestSheet open={sheet === 'rest'} onClose={() => setSheet(null)} c={c} patch={patch} />
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
