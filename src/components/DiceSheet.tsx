import { useEffect, useMemo, useState } from 'react'
import type { Character, DiceRequest } from '../lib/types'
import { diceFormula } from '../lib/rules'
import { Sheet, Stepper } from './ui'

const SIDES = [4, 6, 8, 10, 12, 20] as const
const MODE_KEY = 'dh.diceMode'
const loadMode = (): 'app' | 'physical' => { try { return localStorage.getItem(MODE_KEY) === 'physical' ? 'physical' : 'app' } catch { return 'app' } }

export interface DicePreset { label: string; groups: { n: number; sides: number }[]; bonus: number; type: 'phy' | 'mag' }

/**
 * Tiro di danno (dall'arma, con la Competenza già contata) o dadi liberi.
 * Critico: si aggiunge il massimo dei dadi al tiro normale, come da regole.
 */
export function DiceSheet({ open, onClose, character, preset, onRoll }: {
  open: boolean; onClose: () => void; character: Character | null; preset: DicePreset | null; onRoll: (r: DiceRequest) => void
}) {
  const [pool, setPool] = useState<Record<number, number>>({})
  const [bonus, setBonus] = useState(0)
  const [kind, setKind] = useState<'damage' | 'dice'>('damage')
  const [type, setType] = useState<'phy' | 'mag'>('phy')
  const [crit, setCrit] = useState(false)
  const [label, setLabel] = useState('')
  const [mode, setModeState] = useState<'app' | 'physical'>(loadMode)
  const [sum, setSum] = useState('')
  const setMode = (m: 'app' | 'physical') => { setModeState(m); try { localStorage.setItem(MODE_KEY, m) } catch { /* niente */ } }

  useEffect(() => {
    if (!open) return
    setCrit(false); setSum('')
    if (preset) {
      setPool(Object.fromEntries(preset.groups.map(g => [g.sides, g.n])))
      setBonus(preset.bonus); setType(preset.type); setKind('damage'); setLabel(preset.label)
    } else { setPool({}); setBonus(0); setType('phy'); setKind(character ? 'damage' : 'dice'); setLabel('') }
    setMode(loadMode())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset, character?.id])

  const groups = useMemo(() => SIDES.filter(s => (pool[s] ?? 0) > 0).map(s => ({ n: pool[s], sides: s })), [pool])
  const count = groups.reduce((a, g) => a + g.n, 0)
  const maxDice = groups.reduce((a, g) => a + g.n * g.sides, 0)
  const add = (s: number, d: number) => setPool(p => ({ ...p, [s]: Math.max(0, Math.min(40, (p[s] ?? 0) + d)) }))
  const manualSum = parseInt(sum, 10)
  const manualOk = Number.isFinite(manualSum) && manualSum >= count && manualSum <= maxDice
  const formula = diceFormula(groups, bonus)

  function go() {
    onRoll({
      label: label.trim(), groups, bonus, kind,
      type: kind === 'damage' ? type : undefined, crit: kind === 'damage' && crit,
      manualSum: mode === 'physical' ? manualSum : undefined,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={kind === 'damage' ? 'Tiro di danno' : 'Tira i dadi'}>
      <div className="seg dice-mode">
        <button type="button" className={mode === 'app' ? 'sel' : ''} onClick={() => setMode('app')}>Dadi dell’app</button>
        <button type="button" className={mode === 'physical' ? 'sel' : ''} onClick={() => setMode('physical')}>Dadi fisici</button>
      </div>

      <div className="seg">
        <button type="button" className={kind === 'damage' ? 'sel' : ''} onClick={() => setKind('damage')}>Danno</button>
        <button type="button" className={kind === 'dice' ? 'sel' : ''} onClick={() => setKind('dice')}>Altro tiro</button>
      </div>

      <p className="field-title">Dadi {count > 0 && <button type="button" className="link-btn pool-clear" onClick={() => setPool({})}>Svuota</button>}</p>
      <div className="pool">
        {SIDES.map(s => (
          <div key={s} className={`pool-die ${(pool[s] ?? 0) > 0 ? 'on' : ''}`}>
            <button type="button" className="pool-add" onClick={() => add(s, 1)} aria-label={`Aggiungi un d${s}`}>
              <DieShape sides={s} /><span>d{s}</span>
              {(pool[s] ?? 0) > 0 && <b className="pool-n">{pool[s]}</b>}
            </button>
            {(pool[s] ?? 0) > 0 && <button type="button" className="pool-minus" onClick={() => add(s, -1)} aria-label={`Togli un d${s}`}>−</button>}
          </div>
        ))}
      </div>

      <div className="row-between">
        <span className="field-title">Bonus fisso</span>
        <Stepper value={bonus} onChange={setBonus} min={-20} max={40} />
      </div>

      {kind === 'damage' && (
        <>
          <div className="seg">
            <button type="button" className={type === 'phy' ? 'sel' : ''} onClick={() => setType('phy')}>Fisico</button>
            <button type="button" className={type === 'mag' ? 'sel' : ''} onClick={() => setType('mag')}>Magico</button>
          </div>
          <label className="toggle crit-toggle">
            <input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} />
            Successo critico: aggiungi il massimo dei dadi{count > 0 ? ` (+${maxDice})` : ''}
          </label>
        </>
      )}

      <label className="field">
        <span>Descrizione (facoltativa)</span>
        <input value={label} placeholder={kind === 'damage' ? 'es. Ascia da Battaglia' : 'es. Tabella degli incontri'} onChange={e => setLabel(e.target.value)} />
      </label>

      {mode === 'physical' && count > 0 && (
        <label className="field">
          <span>Somma dei dadi tirati ({formula.replace(/ [+−] \d+$/, '')}, da {count} a {maxDice})</span>
          <input className="big-input" type="number" inputMode="numeric" min={count} max={maxDice} value={sum} onChange={e => setSum(e.target.value)} />
        </label>
      )}
      {mode === 'physical' && manualOk && (
        <p className="phys-preview">Totale <b>{manualSum + bonus + (kind === 'damage' && crit ? maxDice : 0)}</b>{kind === 'damage' ? ` danni ${type === 'mag' ? 'magici' : 'fisici'}` : ''}</p>
      )}

      <button type="button" className={`btn btn-roll dmg-roll ${kind === 'damage' ? `t-${type}` : 't-dice'}`} disabled={count === 0 || (mode === 'physical' && !manualOk)} onClick={go}>
        {count === 0 ? 'Scegli i dadi' : mode === 'physical' ? 'Registra il tiro' : <>Tira {formula}{kind === 'damage' && crit && <span>critico</span>}</>}
      </button>
    </Sheet>
  )
}

/** Sagome semplici dei dadi, riconoscibili a colpo d'occhio. */
export function DieShape({ sides }: { sides: number }) {
  const shapes: Record<number, string> = {
    4: '50,6 94,86 6,86',
    6: '14,14 86,14 86,86 14,86',
    8: '50,4 92,50 50,96 8,50',
    10: '50,4 92,40 50,96 8,40',
    12: '50,4 93,35 77,90 23,90 7,35',
    20: '50,3 91,27 91,73 50,97 9,73 9,27',
  }
  return (
    <svg viewBox="0 0 100 100" className="die-shape" aria-hidden="true">
      <polygon points={shapes[sides] ?? shapes[20]} />
    </svg>
  )
}
