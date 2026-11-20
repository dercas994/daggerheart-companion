import { useCallback, useEffect, useState } from 'react'
import type { Backend, RealtimeHandlers } from './types'

/** Lista di una campagna (recap, media) ricaricata quando qualcuno la modifica. */
export function useLiveList<T>(be: Backend, campaignId: string, load: (id: string) => Promise<T[]>, event: keyof Pick<RealtimeHandlers, 'onRecaps' | 'onMedia'>) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => load(campaignId).then(x => { setItems(x); setError(null) }).catch(e => setError(e.message)).finally(() => setLoading(false)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [be, campaignId])
  useEffect(() => {
    reload()
    let t: ReturnType<typeof setTimeout> | undefined
    const unsub = be.subscribe(campaignId, { [event]: () => { clearTimeout(t); t = setTimeout(reload, 250) } })
    const onVis = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVis)
    return () => { unsub(); clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, [be, campaignId, event, reload])
  return { items, setItems, loading, error, reload }
}
