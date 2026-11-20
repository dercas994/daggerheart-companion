import { useCallback, useEffect, useRef, useState } from 'react'
import type { Backend, Campaign, Character, Member, Roll } from './types'

/** Stato di una campagna sincronizzato in tempo reale (PG, Paura, tiri, membri). */
export function useCampaignLive(be: Backend, campaignId: string | undefined, userId: string | undefined, onForeignRoll?: (r: Roll) => void) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [rolls, setRolls] = useState<Roll[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const uid = useRef(userId)
  uid.current = userId
  const foreign = useRef(onForeignRoll)
  foreign.current = onForeignRoll

  const reloadMembers = useCallback(() => {
    if (campaignId) be.listMembers(campaignId).then(setMembers).catch(() => {})
  }, [be, campaignId])

  useEffect(() => {
    if (!campaignId) return
    let alive = true
    setLoading(true)
    Promise.all([be.getCampaign(campaignId), be.listCharacters(campaignId), be.listMembers(campaignId), be.listRolls(campaignId)])
      .then(([c, ch, m, r]) => { if (!alive) return; setCampaign(c); setCharacters(ch); setMembers(m); setRolls(r) })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false))

    const unsub = be.subscribe(campaignId, {
      onCampaign: c => setCampaign(prev => ({ ...(prev ?? c), ...c })),
      onCharacter: c => setCharacters(xs => {
        const i = xs.findIndex(x => x.id === c.id)
        if (i < 0) return [...xs, c]
        const copy = xs.slice(); copy[i] = { ...xs[i], ...c }; return copy
      }),
      onCharacterDelete: id => setCharacters(xs => xs.filter(x => x.id !== id)),
      onRoll: r => {
        setRolls(xs => (xs.some(x => x.id === r.id) ? xs : [r, ...xs].slice(0, 50)))
        if (r.user_id !== uid.current) foreign.current?.(r)
      },
      onRollDelete: id => setRolls(xs => xs.filter(x => x.id !== id)),
      onMembers: reloadMembers,
    })
    // al ritorno in primo piano (telefono in tasca) ricarico tutto
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      be.getCampaign(campaignId).then(setCampaign).catch(() => {})
      be.listCharacters(campaignId).then(setCharacters).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; unsub(); document.removeEventListener('visibilitychange', onVis) }
  }, [be, campaignId, reloadMembers])

  /** Aggiornamento ottimistico: la UI cambia subito, il server conferma. */
  const patchCharacter = useCallback(async (id: string, patch: Partial<Character>) => {
    let before: Character | undefined
    setCharacters(xs => xs.map(x => { if (x.id !== id) return x; before = x; return { ...x, ...patch } }))
    try {
      const saved = await be.updateCharacter(id, patch)
      setCharacters(xs => xs.map(x => (x.id === id ? { ...x, ...saved } : x)))
    } catch (e) {
      if (before) setCharacters(xs => xs.map(x => (x.id === id ? before! : x)))
      throw e
    }
  }, [be])

  const patchCampaign = useCallback(async (patch: Partial<Campaign>) => {
    if (!campaignId) return
    let before: Campaign | null = null
    setCampaign(c => { before = c; return c ? { ...c, ...patch } : c })
    try { await be.updateCampaign(campaignId, patch) } catch (e) { setCampaign(before); throw e }
  }, [be, campaignId])

  const removeRoll = (id: string) => setRolls(xs => xs.filter(x => x.id !== id))
  const addRoll = (r: Roll) => setRolls(xs => (xs.some(x => x.id === r.id) ? xs : [r, ...xs].slice(0, 50)))

  return { campaign, characters, members, rolls, error, loading, patchCharacter, patchCampaign, addRoll, removeRoll, setCharacters, setCampaign }
}
