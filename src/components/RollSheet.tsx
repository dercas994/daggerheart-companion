import { useEffect, useState } from 'react'
import type { Character, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { IT } from '../data'
import { fmt, spellcastTrait, traitValue } from '../lib/rules'
import { Sheet, Stepper } from './ui'

export interface RollChoice { modifier: number; label: string; advantage: -1 | 0 | 1; hopeSpent: number }

export function RollSheet({ open, onClose, character, presetTrait, onRoll }: {
  open: boolean; onClose: () => void; character: Character | null
  presetTrait?: TraitKey | null; onRoll: (c: RollChoice) => void
}) {
  const [trait, setTrait] = useState<TraitKey | null>(null)
  const [exps, setExps] = useState<number[]>([])
  const [adv, setAdv] = useState<-1 | 0 | 1>(0)
  const [extra, setExtra] = useState(0)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (open) { setTrait(presetTrait ?? null); setExps([]); setAdv(0); setExtra(0); setLabel('') }
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

      <button type="button" className="btn btn-roll" onClick={() => onRoll({ modifier: total, label: label.trim() || autoLabel, advantage: adv, hopeSpent: exps.length })}>
        Tira 2d12 {total !== 0 && <span>{fmt(total)}</span>}{adv !== 0 && <span>{adv > 0 ? '+d6' : '−d6'}</span>}
      </button>
    </Sheet>
  )
}
