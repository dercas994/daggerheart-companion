import { useEffect, useState } from 'react'

// Routing su hash: funziona sia su hosting statico sia dentro l'APK Capacitor.
export type Route =
  | { name: 'home' }
  | { name: 'campaign'; id: string }
  | { name: 'wizard'; campaignId: string }
  | { name: 'character'; id: string }

export function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (p[0] === 'c' && p[1] && p[2] === 'nuovo') return { name: 'wizard', campaignId: p[1] }
  if (p[0] === 'c' && p[1]) return { name: 'campaign', id: p[1] }
  if (p[0] === 'pg' && p[1]) return { name: 'character', id: p[1] }
  return { name: 'home' }
}

export const go = (path: string) => { location.hash = path }

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  useEffect(() => {
    const f = () => { setRoute(parse(location.hash)); window.scrollTo(0, 0) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return route
}
