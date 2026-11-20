import type { Media } from './types'

/** Estrae gli ID dei file da link di Google Drive (uno o più, separati da spazi o a capo). */
export function parseDriveLinks(text: string): { ids: string[]; folders: number } {
  const ids: string[] = []
  let folders = 0
  for (const raw of text.split(/[\s,]+/).filter(Boolean)) {
    if (/\/folders\//.test(raw)) { folders++; continue }
    const m = raw.match(/\/d\/([\w-]{20,})/) ?? raw.match(/[?&]id=([\w-]{20,})/) ?? raw.match(/^([\w-]{25,})$/)
    if (m && !ids.includes(m[1])) ids.push(m[1])
  }
  return { ids, folders }
}

/** Immagine: file caricato o anteprima di Drive alla larghezza richiesta. */
export function imageSrc(m: Media, width = 1600) {
  if (m.url) return m.url
  return `https://lh3.googleusercontent.com/d/${m.drive_id}=w${width}`
}
/** Ripiego se lh3 non risponde. */
export function imageFallback(m: Media, width = 1600) {
  return m.drive_id ? `https://drive.google.com/thumbnail?id=${m.drive_id}&sz=w${width}` : null
}

export function audioSrc(m: Media) {
  if (m.url) return m.url
  return `https://drive.usercontent.google.com/download?id=${m.drive_id}&export=download`
}
export function drivePage(m: Media) {
  return m.drive_id ? `https://drive.google.com/file/d/${m.drive_id}/view` : m.url ?? '#'
}
export function drivePreview(m: Media) {
  return `https://drive.google.com/file/d/${m.drive_id}/preview`
}

/** Titolo leggibile dal nome di un file ("02 - Taverna.mp3" → "Taverna"). */
export function titleFromFile(name: string) {
  return name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/^\d+\s*[-_.]\s*/, '').replace(/[_]+/g, ' ').trim() || name
}
