import { useState } from 'react'
import { useApp } from '../App'
import { useCampaignLive } from '../lib/live'
import { go } from '../lib/router'
import { ErrorLine, Sheet, Spinner, useAsync, useToast } from '../components/ui'
import { TopBar } from '../components/TopBar'
import { FearTrack, ownerName, PartyCard, RollLog, UndoRollSheet } from '../components/Party'
import { DiceOverlay, outcomeText, rollTone } from '../components/Dice'
import { Avatar, accentVars } from '../components/Portrait'
import type { Roll } from '../lib/types'
import type { CampaignTab } from '../lib/router'
import { useLiveList } from '../lib/liveList'
import { Chronicle } from '../components/Chronicle'
import { Gallery } from '../components/Gallery'
import { MiniPlayer, Music, usePlayer } from '../components/Music'
import { DiceSheet } from '../components/DiceSheet'
import { FearAura, HopeAura } from '../components/FearAura'
import { TagTeamFlow } from '../components/TagTeam'
import { Countdowns } from '../components/Countdowns'
import { EncounterTab } from '../components/Encounter'

const TAB_LABEL: Record<CampaignTab, string> = { tavolo: 'Tavolo', scontro: 'Scontro', storia: 'Storia', galleria: 'Galleria', musica: 'Musica' }

export function CampaignPage({ id, tab }: { id: string; tab: CampaignTab }) {
  const { be, user } = useApp()
  const toast = useToast()
  const [watching, setWatching] = useState<Roll | null>(null)
  const live = useCampaignLive(be, id, user.id, r => {
    toast({ text: outcomeText(r), tone: rollTone(r) })
    if (isGm) setWatching(r)
  })
  const { campaign, characters, members, rolls } = live
  const isGm = campaign?.gm_id === user.id
  const [settings, setSettings] = useState(false)
  const [undoing, setUndoing] = useState<Roll | null>(null)
  const [gmDice, setGmDice] = useState(false)
  const [ownRoll, setOwnRoll] = useState(false)
  const media = useLiveList(be, id, cid => be.listMedia(cid), 'onMedia')
  const player = usePlayer(media.items)

  if (live.loading) return <div className="center-screen"><Spinner /></div>
  if (!campaign) return <div className="center-screen"><ErrorLine error={live.error ?? 'Campagna non trovata.'} /><a href="#/">Torna alla home</a></div>

  const mine = characters.filter(c => c.owner_id === user.id)
  const others = characters.filter(c => c.owner_id !== user.id)

  return (
    <>
      <TopBar title={campaign.name} back="#/" right={isGm && <button className="btn btn-ghost small" onClick={() => setSettings(true)}>Gestisci</button>} />
      <nav className="tabs campaign-tabs" role="tablist">
        {(Object.keys(TAB_LABEL) as CampaignTab[]).filter(t => t !== 'scontro' || isGm).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'sel' : ''}
            onClick={() => go(t === 'tavolo' ? `/c/${id}` : `/c/${id}/${t}`)}>{TAB_LABEL[t]}</button>
        ))}
      </nav>
      <main className={`page tab-page ${isGm && tab === 'tavolo' ? 'gm-page' : ''} ${player.current ? 'with-player' : ''}`}>
        {tab === 'scontro' && isGm && <EncounterTab campaignId={id} campaign={campaign} partySize={characters.length} patchCampaign={live.patchCampaign} />}
        {tab === 'storia' && <Chronicle campaignId={id} isGm={isGm} members={members} />}
        {tab === 'galleria' && <Gallery campaignId={id} media={media.items} reload={media.reload} isGm={isGm} />}
        {tab === 'musica' && <Music campaignId={id} media={media.items} reload={media.reload} isGm={isGm} p={player} />}
        {tab !== 'tavolo' && !(tab === 'scontro' && !isGm) ? null : isGm ? (
          <div className="gm-grid">
            <section className="panel fear-panel">
              <FearTrack big value={campaign.fear} onChange={n => live.patchCampaign({ fear: n }).catch(e => toast({ text: e.message, tone: 'error' }))} />
            </section>
            <div className="panel cd-panel"><Countdowns campaignId={id} isGm /></div>
            <section className="panel invite">
              <p>Codice invito per i giocatori</p>
              <InviteCode code={campaign.invite_code} />
            </section>
            <section className="gm-party">
              <h2>Il gruppo</h2>
              {characters.length === 0 && <p className="empty">Nessun personaggio ancora. Quando i giocatori entrano con il codice e creano la scheda, compaiono qui.</p>}
              <div className="party-grid">
                {characters.map(c => (
                  <PartyCard key={c.id} c={c} owner={ownerName(members, c.owner_id)} editable
                    onPatch={p => live.patchCharacter(c.id, p).catch(e => toast({ text: e.message, tone: 'error' }))} />
                ))}
              </div>
              <button className="btn btn-ghost" onClick={() => go(`/c/${id}/nuovo`)}>Crea un PNG alleato</button>
            </section>
            <section className="gm-log">
              <div className="section-head">
                <h2>Tiri della sessione</h2>
                <button className="btn btn-ghost small" onClick={() => setGmDice(true)}>Tira i dadi</button>
              </div>
              <RollLog rolls={rolls} limit={20} onUndo={setUndoing} />
            </section>
          </div>
        ) : (
          <>
            {campaign.description && <p className="premise">{campaign.description}</p>}
            <section>
              <h2>I tuoi personaggi</h2>
              {mine.length === 0 && <p className="empty">Non hai ancora un personaggio in questa campagna.</p>}
              <div className="mine-list">
                {mine.map(c => (
                  <a key={c.id} className="mine-item" href={`#/pg/${c.id}`} style={accentVars(c.data)}>
                    <Avatar url={c.data.portrait_url} name={c.name} accent={c.data.accent} accent2={c.data.accent2} size={40} />
                    <span className="mine-name">{c.name}</span>
                    <span className="mine-go">Apri la scheda</span>
                  </a>
                ))}
              </div>
              <button className="btn btn-primary" onClick={() => go(`/c/${id}/nuovo`)}>Crea un personaggio</button>
            </section>
            <section className="panel"><FearTrack value={campaign.fear} /></section>
            <Countdowns campaignId={id} isGm={false} />
            <section>
              <h2>Compagni</h2>
              {others.length === 0 && <p className="empty">Gli altri personaggi del gruppo compariranno qui.</p>}
              <div className="party-grid">{others.map(c => <PartyCard key={c.id} c={c} owner={ownerName(members, c.owner_id)} />)}</div>
            </section>
            <section>
              <h2>Ultimi tiri</h2>
              <RollLog rolls={rolls} />
            </section>
          </>
        )}
      </main>

      <FearAura fear={campaign.fear} enabled />
      <HopeAura hope={mine.length === 1 ? mine[0].hope : undefined} enabled={!isGm && mine.length === 1} name={mine[0]?.name} />
      <TagTeamFlow tag={live.tag} characters={characters} rolls={rolls} isGm={isGm} onRollAdded={live.addRoll} />
      {tab !== 'musica' && <MiniPlayer p={player} onOpen={() => go(`/c/${id}/musica`)} />}
      {isGm && <UndoRollSheet key={undoing?.id} roll={undoing} onClose={() => setUndoing(null)} onConfirm={async revert => {
        await be.undoRoll(undoing!.id, revert)
        live.removeRoll(undoing!.id)
        toast({ text: 'Tiro annullato' })
      }} />}
      {watching && <DiceOverlay roll={watching} ownRoll={ownRoll} onClose={() => { setWatching(null); setOwnRoll(false) }} />}
      {isGm && <DiceSheet open={gmDice} onClose={() => setGmDice(false)} character={null} preset={null} onRoll={async req => {
        setGmDice(false)
        try { const r = await be.rollDice(id, null, req); live.addRoll(r); setOwnRoll(true); setWatching(r) }
        catch (e) { toast({ text: e instanceof Error ? e.message : String(e), tone: 'error' }) }
      }} />}
      {isGm && <CampaignSettings open={settings} onClose={() => setSettings(false)} campaignId={id}
        name={campaign.name} description={campaign.description} members={members.filter(m => m.role === 'player').map(m => m.display_name)} />}
    </>
  )
}

function InviteCode({ code }: { code: string }) {
  const toast = useToast()
  async function share() {
    const text = `Entra nella mia campagna di Daggerheart con il codice ${code}`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(code); toast({ text: 'Codice copiato' }) }
    } catch { /* condivisione annullata */ }
  }
  return (
    <div className="invite-row">
      <span className="invite-code">{code}</span>
      <button className="btn btn-ghost small" onClick={share}>Condividi</button>
    </div>
  )
}

function CampaignSettings({ open, onClose, campaignId, name, description, members }: {
  open: boolean; onClose: () => void; campaignId: string; name: string; description: string; members: string[]
}) {
  const { be } = useApp()
  const [n, setN] = useState(name)
  const [d, setD] = useState(description)
  const [confirm, setConfirm] = useState('')
  const save = useAsync()
  return (
    <Sheet open={open} onClose={onClose} title="Gestisci campagna">
      <label className="field"><span>Nome</span><input value={n} onChange={e => setN(e.target.value)} /></label>
      <label className="field"><span>Premessa</span><textarea rows={3} value={d} onChange={e => setD(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={save.busy} onClick={async () => { await save.run(() => be.updateCampaign(campaignId, { name: n.trim(), description: d.trim() })); onClose() }}>Salva</button>
      <p className="field-title">Giocatori ({members.length})</p>
      <p>{members.join(', ') || 'Nessuno ancora'}</p>
      <hr />
      <p className="field-title">Elimina campagna</p>
      <p className="hint">Elimina anche tutte le schede e i tiri. Scrivi il nome della campagna per confermare.</p>
      <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={name} />
      <ErrorLine error={save.error} />
      <button className="btn btn-danger" disabled={confirm !== name || save.busy}
        onClick={async () => { await save.run(() => be.deleteCampaign(campaignId)); go('/') }}>Elimina definitivamente</button>
    </Sheet>
  )
}
