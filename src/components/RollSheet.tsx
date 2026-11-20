import { useEffect, useState } from 'react'
import type { Character, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { IT } from '../data'
import { fmt, spellcastTrait, traitValue } from '../lib/rules'
import { Sheet, Stepper } from './ui'

export interface RollChoice {
  modifier: number; label: string; advantage: -1 | 0 | 1; hopeSpent: number
  manual?: { hope: number; fear: number; adv?: number }
}

const MODE_KEY = 'dh.diceMode'
const loadMode = (): 'app' | 'physical' => { try { return localStorage.getItem(MODE_KEY) === 'physical' ? 'physical' : 'app' } catch { return 'app' } }

function DieGrid({ sides, value, onPick, tone, label }: { sides: number; value: number | null; onPick: (n: number) => void; tone: 'hope' | 'fear' | 'adv'; label: string }) {
  return (
    <div className={`die-grid tone-${tone}`} role="radiogroup" aria-label={label}>
      {Array.from({ length: sides }, (_, i) => i + 1).map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={value === n ? 'sel' : ''} onClick={() => onPick(n)}>{n}</button>
      ))}
    </div>
  )
}

export function RollSheet({ open, onClose, character, presetTrait, onRoll }: {
  open: boolean; onClose: () => void; character: Character | null
  presetTrait?: TraitKey | null; onRoll: (c: RollChoice) => void
}) {
  const [trait, setTrait] = useState<TraitKey | null>(null)
  const [exps, setExps] = useState<number[]>([])
  const [adv, setAdv] = useState<-1 | 0 | 1>(0)
  const [extra, setExtra] = useState(0)
  const [label, setLabel] = useState('')
  const [mode, setModeState] = useState<'app' | 'physical'>(loadMode)
  const [hDie, setHDie] = useState<number | null>(null)
  const [fDie, setFDie] = useState<number | null>(null)
  const [aDie, setADie] = useState<number | null>(null)
  const setMode = (m: 'app' | 'physical') => { setModeState(m); try { localStorage.setItem(MODE_KEY, m) } catch { /* niente */ } }

  useEffect(() => {
    if (open) { setTrait(presetTrait ?? null); setExps([]); setAdv(0); setExtra(0); setLabel(''); setHDie(null); setFDie(null); setADie(null) }
  }, [open, presetTrait])

  const d = character?.data
  const spell = d ? spellcastTrait(d) : null
  const expList = d?.experiences.filter(e => e.name.trim()) ?? []
  const hope = character?.hope ?? 0
  const traitMod = d && trait ? traitValue(d, trait) : 0
  const expMod = exps.reduce((s, i) => s + (expList[i]?.bonus ?? 0), 0)
  const total = traitMod + expMod + extra

  const autoLabel = [trait ? IT.traits[trait] : '', ...exps.map(i => expList[i]?.name)].filter(Boolean).join(' + ')

  function toggleExp(i: number) {
    setExps(x => (x.includes(i) ? x.filter(y => y !== i) : x.length < hope ? [...x, i] : x))
  }

  return (
    <Sheet open={open} onClose={onClose} title="Tiro di Dualità">
      <div className="seg dice-mode">
        <button type="button" className={mode === 'app' ? 'sel' : ''} onClick={() => setMode('app')}>Dadi dell’app</button>
        <button type="button" className={mode === 'physical' ? 'sel' : ''} onClick={() => setMode('physical')}>Dadi fisici</button>
      </div>
      {d && (
        <>
          <p className="field-title">Tratto</p>
          <div className="chip-grid">
            {TRAITS.map(t => (
              <button key={t} type="button" className={`chip ${trait === t ? 'sel' : ''}`} onClick={() => setTrait(trait === t ? null : t)}>
                <span>{IT.traits[t]}{spell === t ? ' ✦' : ''}</span><b>{fmt(traitValue(d, t))}</b>
              </button>
            ))}
          </div>
          {spell && <p className="hint">✦ tratto da incantatore della tua sottoclasse</p>}

          {expList.length > 0 && (
            <>
              <p className="field-title">Esperienze <small>(1 Speranza ciascuna, ne hai {hope})</small></p>
              <div className="chip-grid">
                {expList.map((e, i) => (
                  <button key={i} type="button" disabled={!exps.includes(i) && exps.length >= hope}
                    className={`chip ${exps.includes(i) ? 'sel hope' : ''}`} onClick={() => toggleExp(i)}>
                    <span>{e.name}</span><b>{fmt(e.bonus)}</b>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="field-title">Vantaggio</p>
      <div className="seg">
        <button type="button" className={adv === -1 ? 'sel' : ''} onClick={() => setAdv(-1)}>Svantaggio</button>
        <button type="button" className={adv === 0 ? 'sel' : ''} onClick={() => setAdv(0)}>Nessuno</button>
        <button type="button" className={adv === 1 ? 'sel' : ''} onClick={() => setAdv(1)}>Vantaggio</button>
      </div>

      <div className="row-between">
        <span className="field-title">Altri modificatori</span>
        <Stepper value={extra} onChange={setExtra} min={-10} max={10} />
      </div>

      <label className="field">
        <span>Descrizione (facoltativa)</span>
        <input value={label} placeholder={autoLabel || 'es. Scassinare la serratura'} onChange={e => setLabel(e.target.value)} />
      </label>

      {mode === 'physical' && (
        <div className="physical">
          <p className="field-title hope-t">Dado della Speranza</p>
          <DieGrid sides={12} value={hDie} onPick={setHDie} tone="hope" label="Dado della Speranza" />
          <p className="field-title fear-t">Dado della Paura</p>
          <DieGrid sides={12} value={fDie} onPick={setFDie} tone="fear" label="Dado della Paura" />
          {adv !== 0 && (
            <>
              <p className="field-title">d6 di {adv > 0 ? 'vantaggio' : 'svantaggio'}</p>
              <DieGrid sides={6} value={aDie} onPick={setADie} tone="adv" label="Dado di vantaggio" />
            </>
          )}
          {hDie && fDie && (
            <p className={`phys-preview out-${hDie === fDie ? 'crit' : hDie > fDie ? 'hope' : 'fear'}`}>
              Totale <b>{hDie + fDie + (adv && aDie ? adv * aDie : 0) + total}</b>{' '}
              {hDie === fDie ? 'Successo critico' : hDie > fDie ? 'con Speranza' : 'con Paura'}
            </p>
          )}
        </div>
      )}

      {mode === 'app' ? (
        <button type="button" className="btn btn-roll" onClick={() => onRoll({ modifier: total, label: label.trim() || autoLabel, advantage: adv, hopeSpent: exps.length })}>
          Tira 2d12 {total !== 0 && <span>{fmt(total)}</span>}{adv !== 0 && <span>{adv > 0 ? '+d6' : '−d6'}</span>}
        </button>
      ) : (
        <button type="button" className="btn btn-roll" disabled={!hDie || !fDie || (adv !== 0 && !aDie)}
          onClick={() => onRoll({ modifier: total, label: label.trim() || autoLabel, advantage: adv, hopeSpent: exps.length, manual: { hope: hDie!, fear: fDie!, adv: adv !== 0 ? aDie! : undefined } })}>
          Registra il tiro
        </button>
      )}
    </Sheet>
  )
}
