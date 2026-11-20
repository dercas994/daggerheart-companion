import { useEffect, useState } from 'react'
import { APK_URL } from './AppDownload'

// L'APK carica il sito online, quindi le novità dell'app arrivano da sole.
// Va riscaricato solo quando cambia la parte Android (icona, plugin): in quel caso
// la GitHub Action pubblica una release "App Android (build N)" con N più alto
// del versionCode installato e qui mostriamo l'avviso.
const RELEASE_API = 'https://api.github.com/repos/dercas994/daggerheart-companion/releases/tags/apk-latest'
const DISMISS_KEY = 'dh.updateDismissed'

function capacitor(): any {
  const cap = (window as any).Capacitor
  return cap?.isNativePlatform?.() ? cap : null
}
function plugin(name: string): any {
  const cap = capacitor()
  return cap?.Plugins?.[name] ?? cap?.registerPlugin?.(name)
}

export function UpdateBanner() {
  const [latest, setLatest] = useState<number | null>(null)

  useEffect(() => {
    if (!capacitor()) return
    let alive = true
    ;(async () => {
      try {
        const info = await plugin('App')?.getInfo()
        const installed = parseInt(info?.build ?? '0', 10)
        const res = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
        if (!res.ok) return
        const rel = await res.json()
        const m = String(rel.name ?? '').match(/build (\d+)/i)
        const newest = m ? parseInt(m[1], 10) : 0
        let dismissed = 0
        try { dismissed = parseInt(sessionStorage.getItem(DISMISS_KEY) ?? '0', 10) } catch { /* niente */ }
        if (alive && newest > installed && newest !== dismissed) setLatest(newest)
      } catch { /* offline o API non raggiungibile: riproveremo al prossimo avvio */ }
    })()
    return () => { alive = false }
  }, [])

  if (!latest) return null

  async function update() {
    const browser = plugin('Browser')
    if (browser?.open) await browser.open({ url: APK_URL })
    else window.open(APK_URL, '_system')
  }
  function later() {
    try { sessionStorage.setItem(DISMISS_KEY, String(latest)) } catch { /* niente */ }
    setLatest(null)
  }

  return (
    <div className="update-banner" role="status">
      <p><b>È disponibile una nuova versione dell’app.</b> Scaricala e aprila per installarla sopra quella attuale: schede e accesso restano.</p>
      <div className="update-actions">
        <button className="btn btn-ghost small" onClick={later}>Più tardi</button>
        <button className="btn btn-primary small" onClick={update}>Aggiorna</button>
      </div>
    </div>
  )
}
