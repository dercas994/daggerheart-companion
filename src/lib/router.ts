import { useEffect, useState } from 'react'

// Routing su hash: funziona sia su hosting statico sia dentro l'APK Capacitor.
export type Route =
  | { name: 'home' }
  | { name: 'campaign'; id: string; tab: CampaignTab }
  | { name: 'wizard'; campaignId: string }
  | { name: 'character'; id: string }

export type CampaignTab = 'tavolo' | 'scontro' | 'storia' | 'galleria' | 'musica'
const TABS: CampaignTab[] = ['tavolo', 'scontro', 'storia', 'galleria', 'musica']

export function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (p[0] === 'c' && p[1] && p[2] === 'nuovo') return { name: 'wizard', campaignId: p[1] }
  if (p[0] === 'c' && p[1]) return { name: 'campaign', id: p[1], tab: TABS.includes(p[2] as CampaignTab) ? p[2] as CampaignTab : 'tavolo' }
  if (p[0] === 'pg' && p[1]) return { name: 'character', id: p[1] }
  return { name: 'home' }
}

export const go = (path: string) => { location.hash = path }

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  useEffect(() => {
    const f = () => {
      const next = parse(location.hash)
      setRoute(prev => {
        // cambiare scheda della campagna non riporta in cima la pagina
        if (!(prev.name === 'campaign' && next.name === 'campaign' && prev.id === next.id)) window.scrollTo(0, 0)
        return next
      })
    }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return route
}
