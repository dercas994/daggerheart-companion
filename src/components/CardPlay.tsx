import { useState } from 'react'
import type { Character, Roll } from '../lib/types'
import {
  actionCost, cannotUse, cardDef, cardState, diceSpec, scaleMax, sourceValue, specText, type CardAction,
} from '../lib/cardEffects'
import { getWeapon, modeDamageSpec, weaponDamage, weaponModes, type WeaponModeKey } from '../lib/rules'
import { IT } from '../data'
import { Sheet, Stepper } from './ui'

export interface CardFlow {
  card: { id: string; name: string }
  action: CardAction
  /** Unità scelte per un costo variabile (1 se non c'è). */
  n: number
  /** Il tiro fatto per la carta, quando arriva. */
  roll?: Roll
  paid: boolean
  /** Modo d'uso dell'arma scelto (armi con due portate). */
  mode?: WeaponModeKey
}

/** Pulsanti delle azioni giocabili di una carta, con il contatore dei segnalini. */
export function CardActionButtons({ cardId, cardName, c, canEdit, onPlay, onTokens }: {
  cardId: string; cardName: string; c: Character; canEdit: boolean
  onPlay?: (card: { id: string; name: string }, a: CardAction) => void
  onTokens?: (cardId: string, n: number) => void
}) {
  const def = cardDef(cardId, c.data)
  if (!def || (!canEdit && !def.passive) || (!onPlay && !def.passive)) return null
  const st = cardState(c, cardId)
  const max = def.tokensMax?.(c)
  return (
    <div className="card-play">
      {def.passive && <p className="card-passive">{def.passive}</p>}
      {def.tokens && canEdit && (
        <span className={`card-tokens ${def.tokensLabel && (st.tokens ?? 0) > 0 ? 'live' : ''}`} aria-label={def.tokensLabel ?? 'Segnalini sulla carta'}>
          <span>{def.tokensLabel ?? 'Segnalini'}{max ? ` (d${max})` : ''}</span>
          <Stepper value={st.tokens ?? 0} min={0} max={max ?? 20} onChange={n => onTokens?.(cardId, n)} />
        </span>
      )}
      {canEdit && onPlay && def.actions.map(a => {
        const why = cannotUse(a, c, cardId)
        const cost = actionCost(a)
        const used = a.per && st.used?.includes(a.id)
        return (
          <button key={a.id} type="button" className={`btn small ${a.hope || a.scale?.by === 'hope' ? 'btn-hope' : a.roll ? 'btn-primary' : 'btn-ghost'}`}
            disabled={!!why} title={why ?? undefined} onClick={() => onPlay({ id: cardId, name: cardName }, a)}>
            {a.label}{cost ? `, ${cost}` : ''}{used ? ' (usata)' : a.per ? (a.per === 'rest' ? ' (1/riposo)' : ' (1/riposo lungo)') : ''}
          </button>
        )
      })}
    </div>
  )
}

/** Scelta di quante Speranze/Stress/segnalini spendere. */
export function ScaleSheet({ ask, c, onPick, onClose }: {
  ask: { card: { id: string; name: string }; action: CardAction } | null; c: Character
  onPick: (n: number) => void; onClose: () => void
}) {
  const [n, setN] = useState(1)
  if (!ask) return null
  const max = Math.max(1, scaleMax(ask.action, c, ask.card.id))
  const v = Math.min(n, max)
  return (
    <Sheet open onClose={onClose} title={ask.card.name}>
      <p className="hint">Quante? {ask.action.scale!.what}.</p>
      <div className="scale-pick">
        <Stepper value={v} min={1} max={max} onChange={setN} />
        <span className="hint">massimo {max}</span>
      </div>
      <button className="btn btn-primary" onClick={() => onPick(v)}>{ask.action.label}: {v}</button>
    </Sheet>
  )
}

/** Dadi effettivi del danno di una carta, con la Competenza o il tratto già contati. */
export function flowDamage(flow: CardFlow, c: Character) {
  const dmg = flow.action.damage
  if (!dmg) return null
  if (dmg.dice === 'weapon') {
    const w = getWeapon(c.data.primary_weapon_id, c.data)
    if (!w) return null
    const base = Math.max(1, c.data.proficiency ?? 1)
    const prof = dmg.halfProf ? Math.max(1, Math.ceil(base / 2)) : base + (dmg.profDelta ?? 0)
    const m = weaponModes(w).find(x => x.key === (flow.mode ?? 'main')) ?? weaponModes(w)[0]
    return modeDamageSpec(m, prof)
  }
  const formula = flow.roll?.outcome === 'fear' && dmg.onFear ? dmg.onFear : dmg.dice
  const count = dmg.count !== undefined ? sourceValue(dmg.count, c, 0, flow.n, flow.card.id) : undefined
  return diceSpec(formula, { count, times: dmg.perUnit ? flow.n : 1 })
}

/**
 * Pannello che accompagna l'uso di una carta dopo il tiro (o subito, se non c'è tiro):
 * esito, danni da tirare, dadi liberi, promemoria, carta nel Rifugio.
 */
export function CardFlowDock({ flow, c, onDamage, onDice, onVault, onClose }: {
  flow: CardFlow; c: Character
  onDamage: (spec: { groups: { n: number; sides: number }[]; bonus: number }, type: 'mag' | 'phy', label: string) => void
  onDice: (spec: { groups: { n: number; sides: number }[]; bonus: number }, label: string) => void
  onVault: () => void
  onClose: () => void
}) {
  const { action: a, roll, card } = flow
  const waiting = !!a.roll && !roll
  const dmg = flowDamage(flow, c)
  const dmgType: 'mag' | 'phy' = (dmg && 'type' in dmg ? (dmg as { type: 'mag' | 'phy' }).type : a.damage?.type) ?? 'phy'
  const diceCount = a.dice?.count !== undefined ? sourceValue(a.dice.count, c, 0, flow.n, card.id) : undefined
  const free = a.dice ? diceSpec(a.dice.dice, { count: diceCount, times: a.dice.perUnit ? flow.n : 1 }) : null
  const ok = !roll || !a.difficulty || roll.outcome === 'crit' || roll.total >= a.difficulty
  return (
    <aside className="card-flow" role="status">
      <header>
        <b>{card.name}{flow.n > 1 ? ` ×${flow.n}` : ''}</b>
        <button className="link-btn" onClick={onClose}>{waiting ? 'Annulla' : 'Fine'}</button>
      </header>
      {waiting && <p className="hint">Fai il tiro: il costo si paga quando tiri.</p>}
      {roll && (
        <p className={`cf-outcome tone-${roll.outcome ?? 'info'}`}>
          Tiro: <b>{roll.total}</b> {roll.outcome === 'crit' ? 'critico' : roll.outcome === 'hope' ? 'con Speranza' : 'con Paura'}
          {a.difficulty ? (ok ? `: riuscito (Difficoltà ${a.difficulty})` : `: fallito (Difficoltà ${a.difficulty})`) : ''}.
        </p>
      )}
      {!waiting && ok && (dmg || free || a.extras?.length || a.toVault) && (
        <div className="cf-actions">
          {dmg && (
            <button className="btn btn-dmg" onClick={() => onDamage(dmg, dmgType, card.name)}>
              Tira i danni: {specText(dmg)} {dmgType === 'mag' ? 'magici' : 'fisici'}
            </button>
          )}
          {free && a.dice && (
            <button className="btn btn-primary" onClick={() => onDice(free, `${card.name}: ${a.dice!.label}`)}>Tira {specText(free)}</button>
          )}
          {a.extras?.map(x => {
            const s = diceSpec(x.dice)
            return s && <button key={x.label} className="btn btn-ghost small" onClick={() => onDamage(s, x.type, `${card.name}, ${x.label.split(':')[0]}`)}>{x.label}</button>
          })}
          {a.toVault && <button className="btn btn-ghost small" onClick={onVault}>Metti nel Rifugio</button>}
        </div>
      )}
      {!waiting && ok && a.damage?.to && <p className="hint">Danni {a.damage.to}.{roll?.outcome === 'crit' ? ' Critico: attiva «Critico» nel tiro dei danni.' : ''}</p>}
      {!waiting && a.note && <p className="hint">{a.note}</p>}
    </aside>
  )
}

/** Scelta del modo d'uso dell'arma primaria quando ne ha due. */
export function ModeSheet({ ask, c, onPick, onClose }: {
  ask: { card: { id: string; name: string } } | null; c: Character
  onPick: (m: WeaponModeKey) => void; onClose: () => void
}) {
  const w = getWeapon(c.data.primary_weapon_id, c.data)
  if (!ask || !w) return null
  return (
    <Sheet open onClose={onClose} title={ask.card.name}>
      <p className="hint">Con quale modo della tua arma ({w.name})?</p>
      <div className="mode-pick">
        {weaponModes(w).map(m => (
          <button key={m.key} className="btn btn-ghost" onClick={() => onPick(m.key)}>
            <b>{m.key === 'main' ? (IT.range[m.range] ?? m.range) : m.name}</b>
            <span className="hint">{IT.traits[m.trait as keyof typeof IT.traits] ?? m.trait}, {IT.range[m.range] ?? m.range}, {weaponDamage(m.damage, c.data.proficiency ?? 1)}{m.extra ? ` +${m.extra}` : ''}{m.adv === -1 ? ', con svantaggio' : ''}{m.stress ? `, ${m.stress} Stress` : ''}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
