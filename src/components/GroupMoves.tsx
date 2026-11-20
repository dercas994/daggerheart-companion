import { useEffect, useState } from 'react'
import type { Character, Roll, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { IT } from '../data'
import { fmt, traitValue } from '../lib/rules'
import { ErrorLine, Sheet, Stepper, useAsync } from './ui'

type Move = 'help' | 'group' | 'tag'

/** Le tre mosse di gruppo del manuale, a portata di mano nella scheda. */
export function GroupMoves({ c, allies, onHelp, onGroupAction, onTagTeam }: {
  c: Character; allies: Character[]
  onHelp: (ally: Character) => Promise<void>
  onGroupAction: (modifier: number, label: string) => void
  onTagTeam: (ally: Character, mine: { trait: TraitKey | null; extra: number }, theirs: { trait: TraitKey | null; extra: number }) => Promise<void>
}) {
  const [open, setOpen] = useState<Move | null>(null)
  const noAllies = allies.length === 0
  return (
    <section className="group-moves">
      <h2>Mosse di gruppo</h2>
      <div className="gm-moves">
        <button className="move" disabled={noAllies || c.hope < 1} onClick={() => setOpen('help')}>
          <span className="move-cost"><Hope n={1} /></span>
          <b>Aiutare un alleato</b>
          <small>Tiri un d6 di vantaggio che l’alleato aggiunge al suo tiro.</small>
        </button>
        <button className="move" disabled={noAllies} onClick={() => setOpen('group')}>
          <span className="move-cost free">gratis</span>
          <b>Azione di gruppo</b>
          <small>Guidi l’azione: +1 per ogni alleato che riesce la reazione, −1 per chi fallisce.</small>
        </button>
        <button className="move" disabled={noAllies || c.hope < 3} onClick={() => setOpen('tag')}>
          <span className="move-cost"><Hope n={3} /></span>
          <b>Tiro Combinato</b>
          <small>Tirate entrambi e scegliete un risultato che vale per tutti e due. Una volta per sessione.</small>
        </button>
      </div>
      {noAllies && <p className="hint">Servono altri personaggi nella campagna.</p>}
      {open === 'help' && <HelpSheet allies={allies} onClose={() => setOpen(null)} onHelp={onHelp} />}
      {open === 'group' && <GroupSheet allies={allies} onClose={() => setOpen(null)} onGo={(m, l) => { setOpen(null); onGroupAction(m, l) }} />}
      {open === 'tag' && <TagSheet c={c} allies={allies} onClose={() => setOpen(null)} onGo={onTagTeam} />}
    </section>
  )
}

const Hope = ({ n }: { n: number }) => <>{Array.from({ length: n }, (_, i) => <i key={i} className="mc-hope" />)}</>

function AllyPicker({ allies, value, onPick }: { allies: Character[]; value: string | null; onPick: (id: string) => void }) {
  return (
    <div className="chip-grid">
      {allies.map(a => (
        <button key={a.id} type="button" className={`chip ${value === a.id ? 'sel' : ''}`} onClick={() => onPick(a.id)}>
          <span>{a.name}</span>
        </button>
      ))}
    </div>
  )
}

function HelpSheet({ allies, onClose, onHelp }: { allies: Character[]; onClose: () => void; onHelp: (a: Character) => Promise<void> }) {
  const [ally, setAlly] = useState<string | null>(allies.length === 1 ? allies[0].id : null)
  const job = useAsync()
  return (
    <Sheet open onClose={onClose} title="Aiutare un alleato">
      <p className="hint">Spendi 1 Speranza e descrivi come aiuti. Tiri un d6: l’alleato lo aggiunge al suo tiro come dado di vantaggio. Se lo aiutano in più persone, tiene il più alto.</p>
      <p className="field-title">Chi aiuti?</p>
      <AllyPicker allies={allies} value={ally} onPick={setAlly} />
      <ErrorLine error={job.error} />
      <button className="btn btn-hope wide" disabled={!ally || job.busy} onClick={async () => {
        const a = allies.find(x => x.id === ally)!
        if (await job.run(() => onHelp(a).then(() => true))) onClose()
      }}>Spendi 1 Speranza e tira il d6</button>
    </Sheet>
  )
}

function GroupSheet({ allies, onClose, onGo }: { allies: Character[]; onClose: () => void; onGo: (mod: number, label: string) => void }) {
  const [res, setRes] = useState<Record<string, 'ok' | 'ko' | undefined>>({})
  const ok = Object.values(res).filter(v => v === 'ok').length
  const ko = Object.values(res).filter(v => v === 'ko').length
  const mod = ok - ko
  const cycle = (id: string, v: 'ok' | 'ko') => setRes(r => ({ ...r, [id]: r[id] === v ? undefined : v }))
  return (
    <Sheet open onClose={onClose} title="Azione di gruppo">
      <p className="hint">Tu guidi l’azione. Chi partecipa fa un <b>tiro di reazione</b> dalla sua scheda (Tira, poi «Tiro di reazione») e ti dice se è riuscito. Segnalo qui sotto.</p>
      <ul className="ga-list">
        {allies.map(a => (
          <li key={a.id}>
            <span>{a.name}</span>
            <span className="ga-btns">
              <button type="button" className={`chip ${res[a.id] === 'ok' ? 'sel' : ''}`} aria-pressed={res[a.id] === 'ok'} onClick={() => cycle(a.id, 'ok')}>Riuscito +1</button>
              <button type="button" className={`chip ${res[a.id] === 'ko' ? 'sel ko' : ''}`} aria-pressed={res[a.id] === 'ko'} onClick={() => cycle(a.id, 'ko')}>Fallito −1</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="ga-total">Modificatore al tuo tiro: <b>{fmt(mod)}</b></p>
      <button className="btn btn-roll wide" onClick={() => onGo(mod, 'Azione di gruppo')}>Scegli il tratto e tira</button>
    </Sheet>
  )
}

function TraitPick({ c, value, onPick }: { c: Character; value: TraitKey | null; onPick: (t: TraitKey | null) => void }) {
  return (
    <div className="chip-grid">
      {TRAITS.map(t => (
        <button key={t} type="button" className={`chip ${value === t ? 'sel' : ''}`} onClick={() => onPick(value === t ? null : t)}>
          <span>{IT.traits[t]}</span><b>{fmt(traitValue(c.data, t))}</b>
        </button>
      ))}
    </div>
  )
}

function TagSheet({ c, allies, onClose, onGo }: {
  c: Character; allies: Character[]; onClose: () => void
  onGo: (ally: Character, mine: { trait: TraitKey | null; extra: number }, theirs: { trait: TraitKey | null; extra: number }) => Promise<void>
}) {
  const [ally, setAlly] = useState<string | null>(allies.length === 1 ? allies[0].id : null)
  const [mine, setMine] = useState<TraitKey | null>(null)
  const [theirs, setTheirs] = useState<TraitKey | null>(null)
  const [mx, setMx] = useState(0)
  const [tx, setTx] = useState(0)
  const job = useAsync()
  const a = allies.find(x => x.id === ally)
  return (
    <Sheet open onClose={onClose} title="Tiro Combinato">
      <p className="hint">Spendi 3 Speranza. Tirate entrambi, poi scegliete un solo risultato che vale per tutti e due. Con Speranza la guadagnate entrambi; con Paura il master ne prende una per ciascuno di voi.</p>
      <p className="field-title">Con chi?</p>
      <AllyPicker allies={allies} value={ally} onPick={setAlly} />
      <p className="field-title">Il tuo tratto ({c.name})</p>
      <TraitPick c={c} value={mine} onPick={setMine} />
      <div className="row-between"><span className="field-title">Altri modificatori</span><Stepper value={mx} onChange={setMx} min={-10} max={10} /></div>
      {a && (
        <>
          <p className="field-title">Il tratto di {a.name}</p>
          <TraitPick c={a} value={theirs} onPick={setTheirs} />
          <div className="row-between"><span className="field-title">Altri modificatori</span><Stepper value={tx} onChange={setTx} min={-10} max={10} /></div>
        </>
      )}
      <ErrorLine error={job.error} />
      <button className="btn btn-roll wide" disabled={!a || job.busy} onClick={async () => {
        if (await job.run(() => onGo(a!, { trait: mine, extra: mx }, { trait: theirs, extra: tx }).then(() => true))) onClose()
      }}>Spendi 3 Speranza e tirate</button>
    </Sheet>
  )
}

/** Due risultati del Tiro Combinato in attesa: chi partecipa sceglie quale usare. */
export function TagTeamChoice({ rolls, onChoose }: { rolls: Roll[]; onChoose: (groupId: string, rollId: string) => Promise<void> }) {
  const job = useAsync()
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), 50); return () => clearTimeout(t) }, [])
  if (rolls.length < 2) return null
  const OUT = { hope: 'con Speranza', fear: 'con Paura', crit: 'Successo critico' }
  return (
    <div className={`tag-choice ${shown ? 'in' : ''}`} role="dialog" aria-label="Scegli il risultato del Tiro Combinato">
      <div className="tag-card">
        <h2>Tiro Combinato</h2>
        <p className="hint">Scegliete quale risultato vale per entrambi.</p>
        <div className="tag-pair">
          {rolls.map(r => (
            <button key={r.id} className={`tag-opt out-${r.outcome}`} disabled={job.busy}
              onClick={() => job.run(() => onChoose(r.group_id!, r.id).then(() => true))}>
              <span className="to-name">{r.roller_name}</span>
              <span className="to-total">{r.total}</span>
              <span className="to-out">{r.outcome && OUT[r.outcome]}</span>
              <span className="to-dice">{r.hope_die} Speranza, {r.fear_die} Paura{r.modifier ? `, ${fmt(r.modifier)}` : ''}</span>
              <span className="to-use">Usa questo</span>
            </button>
          ))}
        </div>
        <ErrorLine error={job.error} />
      </div>
    </div>
  )
}
