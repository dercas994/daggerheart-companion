import { useEffect, useState } from 'react'
import { useApp } from '../App'
import type { Character, Roll, TagTeam, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { IT } from '../data'
import { fmt, getWeapon, traitValue, weaponDamageSpec, DAMAGE_TYPE_IT } from '../lib/rules'
import { DiceOverlay } from './Dice'
import { DiceSheet, type DicePreset } from './DiceSheet'
import { ErrorLine, Stepper, useAsync, useToast } from './ui'

const OUT = { hope: 'con Speranza', fear: 'con Paura', crit: 'Successo critico' }
const FRESH_MS = 3 * 3600_000
const RESULT_MS = 30 * 60_000

/**
 * Tiro Combinato su invito, visibile a tutti al tavolo:
 * proposta → gli altri giocatori accettano o rifiutano → ognuno tira i suoi dadi →
 * il master fissa la Difficoltà → si sceglie il risultato → se riesce, si tirano i danni.
 */
export function TagTeamFlow({ tag, characters, rolls, isGm, onRollAdded }: {
  tag: TagTeam | null; characters: Character[]; rolls: Roll[]; isGm: boolean; onRollAdded: (r: Roll) => void
}) {
  const { be, user } = useApp()
  const toast = useToast()
  const [declined, setDeclined] = useState<string | null>(() => sessionStorage.getItem('dh.tagDeclined'))
  const [closed, setClosed] = useState<string | null>(() => sessionStorage.getItem('dh.tagClosed'))
  const [mini, setMini] = useState(false)
  const [overlay, setOverlay] = useState<Roll | null>(null)
  const [dmgOpen, setDmgOpen] = useState(false)
  const job = useAsync()

  useEffect(() => { setMini(false) }, [tag?.status])

  if (!tag || tag.status === 'cancelled') return overlay ? <DiceOverlay roll={overlay} onClose={() => setOverlay(null)} /> : null
  const age = Date.now() - new Date(tag.created_at).getTime()
  if (age > FRESH_MS) return null
  if (tag.status === 'resolved' && (closed === tag.id || Date.now() - new Date(tag.updated_at).getTime() > RESULT_MS)) {
    return overlay ? <DiceOverlay roll={overlay} onClose={() => setOverlay(null)} /> : null
  }

  const byId = (id: string | null) => characters.find(c => c.id === id)
  const a = byId(tag.initiator_char)
  const b = byId(tag.partner_char)
  const myChar = tag.initiator_user === user.id ? a : tag.partner_user === user.id ? b : null
  const groupRolls = rolls.filter(r => r.group_id === tag.id)
  const duality = groupRolls.filter(r => (r.kind ?? 'duality') === 'duality').sort((x, y) => x.created_at.localeCompare(y.created_at))
  const damage = groupRolls.filter(r => r.kind === 'damage')
  const mine = myChar ? duality.find(r => r.character_id === myChar.id) : undefined
  const eligible = characters.filter(c => c.owner_id === user.id && c.id !== tag.initiator_char)
  const close = () => { sessionStorage.setItem('dh.tagClosed', tag.id); setClosed(tag.id) }
  const cancel = () => job.run(() => be.tagCancel(tag.id).then(() => { toast({ text: 'Tiro Combinato annullato: Speranza restituita' }); return true }))

  // ---- invito per gli altri giocatori
  if (tag.status === 'open' && !isGm && !myChar) {
    if (!eligible.length || declined === tag.id) return null
    return (
      <div className="tt-modal" role="dialog" aria-label="Invito al Tiro Combinato">
        <div className="tt-card tt-invite">
          <div className="tt-sigil" aria-hidden="true"><i /><i /></div>
          <h2>Vuoi partecipare al Tiro Combinato?</h2>
          <p><b>{a?.name ?? 'Un compagno'}</b> ha speso 3 Speranza e cerca qualcuno con cui agire insieme. Il primo che accetta partecipa.</p>
          <ErrorLine error={job.error} />
          <div className="tt-actions">
            {eligible.map(c => (
              <button key={c.id} className="btn btn-primary" disabled={job.busy}
                onClick={() => job.run(() => be.tagJoin(tag.id, c.id).then(() => true))}>Partecipa con {c.name}</button>
            ))}
            <button className="btn btn-ghost" onClick={() => { sessionStorage.setItem('dh.tagDeclined', tag.id); setDeclined(tag.id) }}>No, grazie</button>
          </div>
        </div>
      </div>
    )
  }

  // chi non c'entra non vede nulla dopo l'invito
  if (!isGm && !myChar) return null

  const difficulty = isGm && tag.status !== 'resolved' ? <DifficultyInput tag={tag} /> : null

  // ---- in attesa di un compagno
  if (tag.status === 'open') {
    return (
      <div className="tt-dock" role="status">
        <p><b>Tiro Combinato</b> {isGm ? `proposto da ${a?.name ?? ''}` : ''}: in attesa che qualcuno accetti…</p>
        {difficulty}
        <ErrorLine error={job.error} />
        <button className="btn btn-ghost small" disabled={job.busy} onClick={cancel}>Annulla</button>
      </div>
    )
  }

  const title = `${a?.name ?? '?'} e ${b?.name ?? '?'}`

  if (mini && tag.status === 'joined') {
    return <button className="tt-pill" onClick={() => setMini(false)}>Tiro Combinato in corso: apri</button>
  }

  // ---- risultato e danni
  if (tag.status === 'resolved') {
    const chosen = duality.find(r => r.id === tag.chosen_roll)
    const total = damage.reduce((s, r) => s + r.total, 0)
    const myDamage = myChar ? damage.find(r => r.character_id === myChar.id) : undefined
    const w = myChar ? getWeapon(myChar.data.primary_weapon_id, myChar.data) : undefined
    const spec = w && myChar ? weaponDamageSpec(w.damage, myChar.data.proficiency) : null
    const preset: DicePreset | null = spec && w ? { label: `${w.name} (Tiro Combinato)`, ...spec } : null
    return (
      <>
        <div className={`tt-dock tt-result ${tag.success ? 'ok' : 'ko'}`} role="status">
          <p className="tt-head"><b>Tiro Combinato</b> di {title}</p>
          {chosen && <p className="tt-verdict">{tag.success ? 'Riuscito' : 'Fallito'}: {chosen.total} contro Difficoltà {tag.difficulty}{chosen.outcome ? `, ${OUT[chosen.outcome]}` : ''}</p>}
          {tag.success && (
            <>
              <ul className="tt-dmg">
                {[a, b].map(c => c && (() => {
                  const d = damage.find(r => r.character_id === c.id)
                  return <li key={c.id}><span>{c.name}</span><b>{d ? `${d.total} ${DAMAGE_TYPE_IT[d.damage_type ?? 'phy']}` : 'deve tirare'}</b></li>
                })())}
              </ul>
              {damage.length > 0 && <p className="tt-total">Danno combinato <b>{total}</b></p>}
              {myChar && !myDamage && <button className="btn btn-roll dmg-roll wide" onClick={() => setDmgOpen(true)}>Tira i danni</button>}
            </>
          )}
          <button className="btn btn-ghost small" onClick={close}>Chiudi</button>
        </div>
        {myChar && (
          <DiceSheet open={dmgOpen} onClose={() => setDmgOpen(false)} character={myChar} preset={preset} onRoll={async req => {
            setDmgOpen(false)
            const r = await be.rollDice(tag.campaign_id, myChar.id, { ...req, kind: 'damage', groupId: tag.id }).catch(e => { toast({ text: e.message, tone: 'error' }); return null })
            if (r) { onRollAdded(r); setOverlay(r) }
          }} />
        )}
        {overlay && <DiceOverlay roll={overlay} onClose={() => setOverlay(null)} />}
      </>
    )
  }

  // ---- in corso: si tira e si sceglie
  const both = duality.length >= 2
  const canChoose = both && tag.difficulty != null && (!!myChar || isGm)
  return (
    <>
      <div className="tt-modal" role="dialog" aria-label="Tiro Combinato">
        <div className="tt-card">
          <div className="tt-top">
            <h2>Tiro Combinato</h2>
            <button className="btn btn-ghost small" onClick={() => setMini(true)}>Riduci</button>
          </div>
          <p className="tt-sub">{title}. {tag.difficulty != null ? <>Difficoltà <b>{tag.difficulty}</b>.</> : isGm ? 'Fissa la Difficoltà.' : 'Il master sta fissando la Difficoltà.'}</p>
          {difficulty}

          {myChar && !mine && <MyRoll tag={tag} c={myChar} onRolled={r => { onRollAdded(r); setOverlay(r) }} />}

          <div className="tag-pair">
            {[a, b].map(c => c && (() => {
              const r = duality.find(x => x.character_id === c.id)
              if (!r) return <div key={c.id} className="tag-opt waiting"><span className="to-name">{c.name}</span><span className="to-wait">sta tirando…</span></div>
              const ok = tag.difficulty != null ? r.outcome === 'crit' || r.total >= tag.difficulty : null
              return (
                <button key={r.id} className={`tag-opt out-${r.outcome}`} disabled={!canChoose || job.busy}
                  onClick={() => job.run(() => be.tagResolve(tag.id, r.id).then(() => true))}>
                  <span className="to-name">{c.name}</span>
                  <span className="to-total">{r.total}</span>
                  <span className="to-out">{r.outcome && OUT[r.outcome]}</span>
                  <span className="to-dice">{r.hope_die} Speranza, {r.fear_die} Paura{r.modifier ? `, ${fmt(r.modifier)}` : ''}</span>
                  {ok != null && <span className={`to-ok ${ok ? 'ok' : 'ko'}`}>{ok ? 'riuscirebbe' : 'fallirebbe'}</span>}
                  {canChoose && <span className="to-use">Usa questo</span>}
                </button>
              )
            })())}
          </div>
          {both && tag.difficulty == null && <p className="hint">Manca solo la Difficoltà del master.</p>}
          {canChoose && <p className="hint">Scegliete il risultato che vale per entrambi: con Speranza ne guadagnate una a testa, con Paura il master ne prende due.</p>}
          <ErrorLine error={job.error} />
          {(isGm || tag.initiator_user === user.id) && <button className="btn btn-ghost small tt-cancel" disabled={job.busy} onClick={cancel}>Annulla il Tiro Combinato</button>}
        </div>
      </div>
      {overlay && <DiceOverlay roll={overlay} onClose={() => setOverlay(null)} />}
    </>
  )
}

function DifficultyInput({ tag }: { tag: TagTeam }) {
  const { be } = useApp()
  const [v, setV] = useState(String(tag.difficulty ?? ''))
  const job = useAsync()
  useEffect(() => { if (tag.difficulty != null) setV(String(tag.difficulty)) }, [tag.difficulty])
  const n = parseInt(v, 10)
  return (
    <div className="tt-diff">
      <label>Difficoltà
        <input type="number" inputMode="numeric" min={1} max={40} value={v} onChange={e => setV(e.target.value)} />
      </label>
      <button className="btn btn-primary small" disabled={!(n >= 1 && n <= 40) || n === tag.difficulty || job.busy}
        onClick={() => job.run(() => be.tagSetDifficulty(tag.id, n).then(() => true))}>{tag.difficulty == null ? 'Imposta' : 'Cambia'}</button>
      <ErrorLine error={job.error} />
    </div>
  )
}

function MyRoll({ tag, c, onRolled }: { tag: TagTeam; c: Character; onRolled: (r: Roll) => void }) {
  const { be } = useApp()
  const [trait, setTrait] = useState<TraitKey | null>(null)
  const [extra, setExtra] = useState(0)
  const [physical, setPhysical] = useState(() => { try { return localStorage.getItem('dh.diceMode') === 'physical' } catch { return false } })
  const [h, setH] = useState('')
  const [f, setF] = useState('')
  const job = useAsync()
  const mod = (trait ? traitValue(c.data, trait) : 0) + extra
  const hv = parseInt(h, 10), fv = parseInt(f, 10)
  const physOk = hv >= 1 && hv <= 12 && fv >= 1 && fv <= 12
  return (
    <div className="tt-myroll">
      <p className="field-title">Il tuo tiro ({c.name})</p>
      <div className="chip-grid">
        {TRAITS.map(t => (
          <button key={t} type="button" className={`chip ${trait === t ? 'sel' : ''}`} onClick={() => setTrait(trait === t ? null : t)}>
            <span>{IT.traits[t]}</span><b>{fmt(traitValue(c.data, t))}</b>
          </button>
        ))}
      </div>
      <div className="row-between"><span className="field-title">Altri modificatori</span><Stepper value={extra} onChange={setExtra} min={-10} max={10} /></div>
      <label className="toggle"><input type="checkbox" checked={physical} onChange={e => setPhysical(e.target.checked)} /> Uso i dadi fisici</label>
      {physical && (
        <div className="tt-phys">
          <label className="hope-t">Speranza <input type="number" inputMode="numeric" min={1} max={12} value={h} onChange={e => setH(e.target.value)} /></label>
          <label className="fear-t">Paura <input type="number" inputMode="numeric" min={1} max={12} value={f} onChange={e => setF(e.target.value)} /></label>
        </div>
      )}
      <ErrorLine error={job.error} />
      <button className="btn btn-roll wide" disabled={job.busy || (physical && !physOk)} onClick={async () => {
        const r = await job.run(() => be.tagRoll(tag.id, c.id, mod, trait ? IT.traits[trait] : '', physical ? { hope: hv, fear: fv } : undefined))
        if (r) onRolled(r)
      }}>{physical ? 'Registra il tiro' : <>Tira 2d12 {mod !== 0 && <span>{fmt(mod)}</span>}</>}</button>
    </div>
  )
}
