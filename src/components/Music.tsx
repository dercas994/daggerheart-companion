import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App'
import { audioSrc, drivePage, drivePreview } from '../lib/drive'
import type { Media } from '../lib/types'
import { AddMedia, albumsOf, EditMedia } from './Gallery'

const fmt = (s: number) => !isFinite(s) ? '–:––' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export type Player = ReturnType<typeof usePlayer>

/** Lettore della campagna: resta attivo cambiando scheda (Tavolo, Storia, Galleria). */
export function usePlayer(media: Media[]) {
  const tracks = useMemo(() => media.filter(m => m.kind === 'audio'), [media])
  const audio = useRef<HTMLAudioElement | null>(null)
  if (!audio.current && typeof Audio !== 'undefined') { audio.current = new Audio(); audio.current.preload = 'metadata' }
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(NaN)
  const [failed, setFailed] = useState<string | null>(null)
  const [repeatOne, setRepeatOne] = useState(false)
  const [volume, setVolume] = useState(() => { try { return parseFloat(localStorage.getItem('dh.vol') ?? '0.8') } catch { return 0.8 } })
  const current = tracks.find(t => t.id === currentId) ?? null
  const st = useRef({ tracks, currentId, repeatOne })
  st.current = { tracks, currentId, repeatOne }

  function load(t: Media, autoplay = true) {
    const a = audio.current!
    setFailed(null); setTime(0); setDuration(NaN)
    setCurrentId(t.id)
    a.src = audioSrc(t)
    if (autoplay) a.play().catch(() => {})
  }
  function step(d: number) {
    const { tracks, currentId } = st.current
    if (!tracks.length) return
    const i = tracks.findIndex(t => t.id === currentId)
    load(tracks[(i + d + tracks.length) % tracks.length])
  }

  useEffect(() => {
    const a = audio.current!
    const on = (ev: string, f: () => void) => { a.addEventListener(ev, f); return () => a.removeEventListener(ev, f) }
    const offs = [
      on('play', () => setPlaying(true)),
      on('pause', () => setPlaying(false)),
      on('timeupdate', () => setTime(a.currentTime)),
      on('durationchange', () => setDuration(a.duration)),
      on('ended', () => { if (st.current.repeatOne) { a.currentTime = 0; a.play().catch(() => {}) } else step(1) }),
      on('error', () => { if (a.src) { setPlaying(false); setFailed(st.current.currentId) } }),
    ]
    return () => { offs.forEach(f => f()); a.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { audio.current!.volume = volume; try { localStorage.setItem('dh.vol', String(volume)) } catch { /* niente */ } }, [volume])
  // brano eliminato mentre suonava
  useEffect(() => { if (currentId && !current) { audio.current!.pause(); audio.current!.removeAttribute('src'); setCurrentId(null) } }, [currentId, current])

  return {
    tracks, current, playing, time, duration, failed: failed === currentId && !!failed, repeatOne, volume,
    play: (t: Media) => { if (t.id === currentId) { audio.current!.paused ? audio.current!.play().catch(() => {}) : audio.current!.pause() } else load(t) },
    toggle: () => { const a = audio.current!; if (!current) { if (tracks[0]) load(tracks[0]) } else a.paused ? a.play().catch(() => {}) : a.pause() },
    next: () => step(1), prev: () => { const a = audio.current!; if (a.currentTime > 4) a.currentTime = 0; else step(-1) },
    seek: (s: number) => { audio.current!.currentTime = s },
    setRepeatOne, setVolume,
    stop: () => { const a = audio.current!; a.pause(); a.removeAttribute('src'); setCurrentId(null) },
  }
}

export function MiniPlayer({ p, onOpen }: { p: Player; onOpen: () => void }) {
  if (!p.current) return null
  return (
    <div className="mini-player" role="region" aria-label="Musica">
      <button className="mp-btn" onClick={p.toggle} aria-label={p.playing ? 'Pausa' : 'Riproduci'}>{p.playing ? <PauseIcon /> : <PlayIcon />}</button>
      <button className="mp-info" onClick={onOpen}>
        <span className="mp-title">{p.current.title || 'Senza titolo'}</span>
        <span className="mp-bar"><span style={{ width: `${isFinite(p.duration) ? (p.time / p.duration) * 100 : 0}%` }} /></span>
      </button>
      <button className="mp-btn" onClick={p.next} aria-label="Brano successivo"><NextIcon /></button>
    </div>
  )
}

export function Music({ campaignId, media, reload, isGm, p }: { campaignId: string; media: Media[]; reload: () => void; isGm: boolean; p: Player }) {
  const { user } = useApp()
  const albums = useMemo(() => albumsOf(p.tracks), [p.tracks])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Media | null>(null)
  const allAlbums = useMemo(() => albumsOf(media.filter(m => m.kind === 'audio')), [media])

  return (
    <section className="music">
      <div className="section-head">
        <h2>Musica</h2>
        <button className="btn btn-primary small" onClick={() => setAdding(true)}>Aggiungi brani</button>
      </div>

      {p.current && (
        <div className="now-playing panel">
          <p className="np-label">In riproduzione</p>
          <p className="np-title">{p.current.title || 'Senza titolo'}</p>
          {p.current.album && <p className="np-album">{p.current.album}</p>}
          {p.failed ? (
            <div className="np-fallback">
              <p className="hint">Questo file di Drive non si può riprodurre direttamente (succede con i file grandi o non condivisi pubblicamente). Usa il lettore di Drive qui sotto.</p>
              {p.current.drive_id && <iframe title={p.current.title} src={drivePreview(p.current)} allow="autoplay" />}
              <a href={drivePage(p.current)} target="_blank" rel="noreferrer">Apri su Google Drive</a>
            </div>
          ) : (
            <>
              <input className="np-seek" type="range" min={0} max={isFinite(p.duration) ? p.duration : 0} step={0.5} value={p.time}
                onChange={e => p.seek(parseFloat(e.target.value))} aria-label="Posizione nel brano" />
              <div className="np-times"><span>{fmt(p.time)}</span><span>{fmt(p.duration)}</span></div>
            </>
          )}
          <div className="np-controls">
            <button className={`np-small ${p.repeatOne ? 'on' : ''}`} onClick={() => p.setRepeatOne(!p.repeatOne)} aria-pressed={p.repeatOne} title="Ripeti questo brano">Ripeti</button>
            <button className="mp-btn" onClick={p.prev} aria-label="Brano precedente"><NextIcon flip /></button>
            <button className="mp-btn big" onClick={p.toggle} aria-label={p.playing ? 'Pausa' : 'Riproduci'}>{p.playing ? <PauseIcon /> : <PlayIcon />}</button>
            <button className="mp-btn" onClick={p.next} aria-label="Brano successivo"><NextIcon /></button>
            <input className="np-vol" type="range" min={0} max={1} step={0.05} value={p.volume} onChange={e => p.setVolume(parseFloat(e.target.value))} aria-label="Volume" />
          </div>
        </div>
      )}

      {p.tracks.length === 0 && <p className="empty">Nessun brano ancora. Aggiungi le musiche d'atmosfera per le sessioni: taverne, battaglie, momenti tristi.</p>}
      {albums.map(a => (
        <div key={a} className="track-group">
          {(albums.length > 1 || a) && <h3>{a || 'Senza album'}</h3>}
          <ul className="tracks">
            {p.tracks.filter(t => t.album === a).map(t => {
              const cur = p.current?.id === t.id
              return (
                <li key={t.id} className={cur ? 'cur' : ''}>
                  <button className="track" onClick={() => p.play(t)} aria-label={`${cur && p.playing ? 'Pausa' : 'Riproduci'} ${t.title}`}>
                    <span className="track-icon">{cur && p.playing ? <Bars /> : <PlayIcon />}</span>
                    <span className="track-title">{t.title || 'Senza titolo'}</span>
                    {t.drive_id && <span className="track-src">Drive</span>}
                  </button>
                  {(t.created_by === user.id || isGm) && <button className="link-btn" onClick={() => setEditing(t)}>Modifica</button>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {adding && <AddMedia kind="audio" campaignId={campaignId} albums={allAlbums} defaultAlbum="" onClose={() => setAdding(false)} onAdded={reload} />}
      {editing && <EditMedia m={editing} albums={allAlbums} onClose={() => setEditing(null)} onChanged={reload} onDeleted={reload} />}
    </section>
  )
}

const PlayIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
const PauseIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" /></svg>
const NextIcon = ({ flip }: { flip?: boolean }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}><path d="M5 5v14l10-7zM16.5 5h2.5v14h-2.5z" fill="currentColor" /></svg>
const Bars = () => <span className="eq" aria-hidden><i /><i /><i /></span>
