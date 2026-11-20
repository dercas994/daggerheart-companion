// Controlla se sul server c'è una versione del sito più nuova di quella caricata.
// Serve soprattutto nell'APK: la WebView di Android tiene in cache la pagina e
// senza questo controllo si continuerebbe a vedere la versione vecchia.

const scriptOf = (html: string) => html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1] ?? null
const currentScript = () => {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
  return el ? el.getAttribute('src') : null
}

export async function newerVersionAvailable(): Promise<string | null> {
  const mine = currentScript()
  if (!mine) return null
  try {
    const res = await fetch(`./index.html?check=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const theirs = scriptOf(await res.text())
    return theirs && theirs !== mine ? theirs : null
  } catch { return null }
}

/** Ricarica saltando la cache HTTP (query nuova), mantenendo la pagina in cui si era. */
export function reloadFresh() {
  location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`)
}

/** Rimuove il ?v= dall'indirizzo dopo un ricaricamento forzato. */
export function cleanUrl() {
  if (/[?&]v=\d+/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash)
}
