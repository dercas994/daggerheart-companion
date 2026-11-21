import { useRef, useState, type CSSProperties } from 'react'
import { prepareImage } from '../lib/image'
import { ErrorLine } from './ui'

export const ACCENTS = ['#E9B949', '#D9774B', '#C8553D', '#C9579A', '#9A6BE0', '#5B7BD6', '#4FA3A5', '#5E9A57', '#B9AE96']

/** Variabili CSS dei colori del PG: --accent e --accent2 (uguale al primo se manca). */
export function accentVars(d: { accent?: string; accent2?: string }) {
  const a = d.accent || 'var(--hope)'
  return { ['--accent' as any]: a, ['--accent2' as any]: d.accent2 || a } as CSSProperties
}

/** Scelta dei due colori del personaggio; il secondo è facoltativo. */
export function AccentPicker({ accent, accent2, onChange }: { accent: string; accent2?: string; onChange: (accent: string, accent2: string | undefined) => void }) {
  return (
    <div className="accent-pick">
      <div className="accent-preview" style={accentVars({ accent, accent2 })} aria-hidden />
      <span className="accent-k">Primo colore</span>
      <div className="accent-row">
        {ACCENTS.map(a => <button key={a} type="button" className={`swatch ${accent === a ? 'sel' : ''}`} style={{ background: a }} aria-pressed={accent === a}
          onClick={() => onChange(a, accent2 === a ? undefined : accent2)} aria-label={`Primo colore ${a}`} />)}
      </div>
      <span className="accent-k">Secondo colore <small>(facoltativo)</small></span>
      <div className="accent-row">
        <button type="button" className={`swatch swatch-none ${!accent2 ? 'sel' : ''}`} aria-pressed={!accent2} onClick={() => onChange(accent, undefined)} aria-label="Nessun secondo colore" title="Nessuno" />
        {ACCENTS.filter(a => a !== accent).map(a => <button key={a} type="button" className={`swatch ${accent2 === a ? 'sel' : ''}`} style={{ background: a }} aria-pressed={accent2 === a}
          onClick={() => onChange(accent, a)} aria-label={`Secondo colore ${a}`} />)}
      </div>
    </div>
  )
}

/** Avatar rotondo: ritratto se c'è, altrimenti l'iniziale sul colore del PG. */
export function Avatar({ url, name, accent, accent2, size = 44 }: { url?: string; name: string; accent?: string; accent2?: string; size?: number }) {
  return url
    ? <img className="avatar" src={url} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} />
    : <span className="avatar avatar-empty" style={{ width: size, height: size, ...accentVars({ accent, accent2 }), fontSize: size * 0.45 }}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
}

/**
 * Scelta del ritratto: prepara l'immagine (ridotta e compressa) e la passa a onPick.
 * `current` è l'URL già salvato o un'anteprima locale.
 */
export function PortraitPicker({ current, name, accent, accent2, onPick, onRemove, busy }: {
  current?: string; name: string; accent?: string; accent2?: string; busy?: boolean
  onPick: (blob: Blob, previewUrl: string) => void; onRemove?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  async function choose(f?: File | null) {
    if (!f) return
    setErr(null)
    try {
      const blob = await prepareImage(f)
      onPick(blob, URL.createObjectURL(blob))
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    if (input.current) input.current.value = ''
  }
  return (
    <div className="portrait-picker">
      <Avatar url={current} name={name || '?'} accent={accent} accent2={accent2} size={84} />
      <div className="portrait-actions">
        <input ref={input} type="file" accept="image/*" hidden onChange={e => choose(e.target.files?.[0])} />
        <button type="button" className="btn btn-ghost small" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Caricamento…' : current ? 'Cambia immagine' : 'Aggiungi immagine'}
        </button>
        {current && onRemove && <button type="button" className="btn btn-ghost small" disabled={busy} onClick={onRemove}>Rimuovi</button>}
        <p className="hint">Una foto o un disegno del personaggio. Viene ridotto in automatico.</p>
      </div>
      <ErrorLine error={err} />
    </div>
  )
}
