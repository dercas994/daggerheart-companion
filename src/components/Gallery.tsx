import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react'
import { useApp } from '../App'
import { imageFallback, imageSrc, parseDriveLinks, titleFromFile } from '../lib/drive'
import { prepareImage } from '../lib/image'
import type { Media, MediaKind } from '../lib/types'
import { ErrorLine, Sheet, useAsync, useToast } from './ui'

export function albumsOf(items: Media[]) {
  const seen: string[] = []
  for (const m of items) if (!seen.includes(m.album)) seen.push(m.album)
  return seen
}

export function MediaImg({ m, width, ...rest }: { m: Media; width: number } & ImgHTMLAttributes<HTMLImageElement>) {
  const [src, setSrc] = useState(() => imageSrc(m, width))
  useEffect(() => setSrc(imageSrc(m, width)), [m, width])
  return <img {...rest} src={src} alt={rest.alt ?? m.title} referrerPolicy="no-referrer"
    onError={() => { const f = imageFallback(m, width); if (f && src !== f) setSrc(f) }} />
}

export function Gallery({ campaignId, media, reload, isGm }: { campaignId: string; media: Media[]; reload: () => void; isGm: boolean }) {
  const images = useMemo(() => media.filter(m => m.kind === 'image'), [media])
  const albums = useMemo(() => albumsOf(images), [images])
  const [album, setAlbum] = useState<string | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const shown = album === null ? images : images.filter(m => m.album === album)
  useEffect(() => { if (album !== null && !albums.includes(album)) setAlbum(null) }, [albums, album])

  return (
    <section className="gallery">
      <div className="section-head">
        <h2>Galleria</h2>
        <button className="btn btn-primary small" onClick={() => setAdding(true)}>Aggiungi immagini</button>
      </div>
      {images.length === 0 && <p className="empty">Nessuna immagine ancora. Carica i momenti della storia, i ritratti dei PNG o le mappe dei luoghi.</p>}
      {albums.length > 1 && (
        <div className="album-bar" role="tablist" aria-label="Album">
          <button role="tab" aria-selected={album === null} className={`chip ${album === null ? 'sel' : ''}`} onClick={() => setAlbum(null)}>Tutte <small>{images.length}</small></button>
          {albums.map(a => (
            <button key={a} role="tab" aria-selected={album === a} className={`chip ${album === a ? 'sel' : ''}`} onClick={() => setAlbum(a)}>
              {a || 'Senza album'} <small>{images.filter(m => m.album === a).length}</small>
            </button>
          ))}
        </div>
      )}
      <div className="masonry">
        {shown.map((m, i) => (
          <button key={m.id} className="tile" onClick={() => setViewing(i)}>
            <MediaImg m={m} width={600} loading="lazy" decoding="async" />
            {m.title && <span className="tile-cap">{m.title}</span>}
          </button>
        ))}
      </div>
      {viewing !== null && shown[viewing] && (
        <Lightbox items={shown} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} isGm={isGm} albums={albums} reload={reload} />
      )}
      {adding && <AddMedia kind="image" campaignId={campaignId} albums={albums} defaultAlbum={album ?? ''} onClose={() => setAdding(false)} onAdded={reload} />}
    </section>
  )
}

function Lightbox({ items, index, onIndex, onClose, isGm, albums, reload }: {
  items: Media[]; index: number; onIndex: (i: number) => void; onClose: () => void; isGm: boolean; albums: string[]; reload: () => void
}) {
  const { user } = useApp()
  const m = items[index]
  const [edit, setEdit] = useState(false)
  const touch = useRef<number | null>(null)
  const go = (d: number) => onIndex((index + d + items.length) % items.length)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (edit) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    addEventListener('keydown', k)
    document.body.classList.add('noscroll')
    return () => { removeEventListener('keydown', k); document.body.classList.remove('noscroll') }
  })
  // precarico la successiva
  useEffect(() => { if (items.length > 1) { const n = new Image(); n.referrerPolicy = 'no-referrer'; n.src = imageSrc(items[(index + 1) % items.length], 2000) } }, [index, items])

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={m.title || 'Immagine'}
      onTouchStart={e => { touch.current = e.touches[0].clientX }}
      onTouchEnd={e => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1) }}>
      <div className="lb-top">
        <span className="lb-count">{index + 1} di {items.length}</span>
        <div className="row-gap">
          {(m.created_by === user.id || isGm) && <button className="btn btn-ghost small" onClick={() => setEdit(true)}>Modifica</button>}
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>
      </div>
      <div className="lb-stage" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <MediaImg key={m.id} m={m} width={2000} className="lb-img" />
      </div>
      <div className="lb-bottom">
        {items.length > 1 && <button className="lb-nav" onClick={() => go(-1)} aria-label="Precedente">‹</button>}
        <div className="lb-cap">
          <p className="lb-title">{m.title || 'Senza titolo'}</p>
          {m.album && <p className="lb-album">{m.album}</p>}
        </div>
        {items.length > 1 && <button className="lb-nav" onClick={() => go(1)} aria-label="Successiva">›</button>}
      </div>
      {edit && <EditMedia m={m} albums={albums} onClose={() => setEdit(false)} onChanged={() => { reload() }} onDeleted={() => { reload(); onClose() }} />}
    </div>
  )
}

export function EditMedia({ m, albums, onClose, onChanged, onDeleted }: { m: Media; albums: string[]; onClose: () => void; onChanged: () => void; onDeleted: () => void }) {
  const { be } = useApp()
  const [title, setTitle] = useState(m.title)
  const [album, setAlbum] = useState(m.album)
  const [confirm, setConfirm] = useState(false)
  const save = useAsync()
  const listId = `albums-${m.id}`
  return (
    <Sheet open onClose={onClose} title={m.kind === 'image' ? 'Modifica immagine' : 'Modifica brano'}>
      <label className="field"><span>Titolo</span><input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label>
      <label className="field"><span>Album</span><input value={album} maxLength={80} list={listId} onChange={e => setAlbum(e.target.value)} /></label>
      <datalist id={listId}>{albums.filter(Boolean).map(a => <option key={a} value={a} />)}</datalist>
      <ErrorLine error={save.error} />
      <div className="row-gap end">
        {!confirm
          ? <button className="btn btn-ghost danger-text" onClick={() => setConfirm(true)}>Elimina</button>
          : <button className="btn btn-danger" disabled={save.busy} onClick={async () => { if (await save.run(() => be.deleteMedia(m).then(() => true))) { onClose(); onDeleted() } }}>Conferma eliminazione</button>}
        <button className="btn btn-primary" disabled={save.busy} onClick={async () => {
          if (await save.run(() => be.updateMedia(m.id, { title: title.trim(), album: album.trim() }).then(() => true))) { onClose(); onChanged() }
        }}>Salva</button>
      </div>
    </Sheet>
  )
}

const AUDIO_TYPES = /^audio\//
export function AddMedia({ kind, campaignId, albums, defaultAlbum, onClose, onAdded }: {
  kind: MediaKind; campaignId: string; albums: string[]; defaultAlbum: string; onClose: () => void; onAdded: () => void
}) {
  const { be } = useApp()
  const toast = useToast()
  const [mode, setMode] = useState<'file' | 'drive'>('file')
  const [album, setAlbum] = useState(defaultAlbum)
  const [links, setLinks] = useState('')
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const save = useAsync()
  const parsed = parseDriveLinks(links)
  const noun = kind === 'image' ? 'immagini aggiunte' : 'brani aggiunti'
  const listId = `albums-new-${kind}`

  async function upload(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    await save.run(async () => {
      const rows = []
      for (let i = 0; i < list.length; i++) {
        const f = list[i]
        setProgress(`Carico ${i + 1} di ${list.length}…`)
        let blob: Blob = f
        if (kind === 'image') blob = await prepareImage(f, 2000, 0.86)
        else {
          if (!AUDIO_TYPES.test(f.type)) throw new Error(`${f.name}: non è un file audio.`)
          if (f.size > 50 * 1024 * 1024) throw new Error(`${f.name}: troppo grande (massimo 50 MB).`)
        }
        const url = await be.uploadMedia(campaignId, blob, kind === 'image' ? f.name.replace(/\.\w+$/, '.webp') : f.name)
        rows.push({ kind, title: titleFromFile(f.name), album: album.trim(), url, sort: Date.now() % 1e9 + i })
      }
      await be.addMedia(campaignId, rows)
      toast({ text: rows.length === 1 ? 'Aggiunto' : `${rows.length} ${noun}` })
      onAdded(); onClose()
    })
    setProgress(null)
  }

  async function fromDrive() {
    await save.run(async () => {
      const base = Date.now() % 1e9
      const rows = parsed.ids.map((id, i) => ({ kind, drive_id: id, album: album.trim(), sort: base + i,
        title: parsed.ids.length === 1 ? title.trim() : (title.trim() ? `${title.trim()} ${i + 1}` : '') }))
      await be.addMedia(campaignId, rows)
      toast({ text: rows.length === 1 ? 'Aggiunto' : `${rows.length} ${noun}` })
      onAdded(); onClose()
    })
  }

  return (
    <Sheet open onClose={onClose} title={kind === 'image' ? 'Aggiungi immagini' : 'Aggiungi brani'}>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'sel' : ''} onClick={() => setMode('file')}>Dal dispositivo</button>
        <button role="tab" aria-selected={mode === 'drive'} className={mode === 'drive' ? 'sel' : ''} onClick={() => setMode('drive')}>Da Google Drive</button>
      </div>
      <label className="field"><span>Album</span>
        <input value={album} maxLength={80} list={listId} onChange={e => setAlbum(e.target.value)} placeholder={kind === 'image' ? 'Momenti della Storia' : 'Taverne'} />
      </label>
      <datalist id={listId}>{albums.filter(Boolean).map(a => <option key={a} value={a} />)}</datalist>
      {mode === 'file' ? (
        <>
          <p className="hint">{kind === 'image' ? 'Puoi sceglierne più di una: vengono ridotte e compresse prima del caricamento.' : 'MP3, OGG, M4A o WAV, fino a 50 MB ciascuno. Per file più pesanti usa Google Drive: lì non c’è limite.'}</p>
          <label className={`btn btn-primary file-btn ${save.busy ? 'disabled' : ''}`}>
            {progress ?? (kind === 'image' ? 'Scegli le immagini' : 'Scegli i file audio')}
            <input type="file" multiple accept={kind === 'image' ? 'image/*' : 'audio/*'} disabled={save.busy} onChange={e => upload(e.target.files)} hidden />
          </label>
        </>
      ) : (
        <>
          <label className="field"><span>Link dei file</span>
            <textarea rows={4} value={links} onChange={e => setLinks(e.target.value)} placeholder="https://drive.google.com/file/d/…/view — uno per riga" />
          </label>
          {parsed.folders > 0 && <p className="hint warn">I link a cartelle non funzionano: apri la cartella, e da ogni file usa Condividi → Copia link.</p>}
          <label className="field"><span>Titolo {parsed.ids.length > 1 && <small>(numerato per ogni file)</small>}</span>
            <input value={title} maxLength={180} onChange={e => setTitle(e.target.value)} />
          </label>
          <p className="hint">I file devono essere condivisi con «Chiunque abbia il link».</p>
          <button className="btn btn-primary" disabled={save.busy || parsed.ids.length === 0} onClick={fromDrive}>
            {parsed.ids.length > 1 ? `Aggiungi ${parsed.ids.length} file` : 'Aggiungi'}
          </button>
        </>
      )}
      <ErrorLine error={save.error} />
    </Sheet>
  )
}
