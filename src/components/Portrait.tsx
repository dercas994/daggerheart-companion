import { useRef, useState } from 'react'
import { prepareImage } from '../lib/image'
import { ErrorLine } from './ui'

/** Avatar rotondo: ritratto se c'è, altrimenti l'iniziale sul colore del PG. */
export function Avatar({ url, name, accent, size = 44 }: { url?: string; name: string; accent?: string; size?: number }) {
  return url
    ? <img className="avatar" src={url} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} />
    : <span className="avatar avatar-empty" style={{ width: size, height: size, ['--accent' as any]: accent || 'var(--hope)', fontSize: size * 0.45 }}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
}

/**
 * Scelta del ritratto: prepara l'immagine (ridotta e compressa) e la passa a onPick.
 * `current` è l'URL già salvato o un'anteprima locale.
 */
export function PortraitPicker({ current, name, accent, onPick, onRemove, busy }: {
  current?: string; name: string; accent?: string; busy?: boolean
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
      <Avatar url={current} name={name || '?'} accent={accent} size={84} />
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
