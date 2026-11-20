// Edge Function "drive-audio": fa da ponte verso Google Drive per riprodurre le canzoni.
// Drive non lascia più suonare i suoi file dentro altri siti; questa funzione li scarica
// lato server (file condivisi con "chiunque abbia il link") e li passa al lettore,
// con il supporto ai salti nel brano (richieste Range). Nessun limite di dimensione.
// Serve solo file registrati come brani in una campagna (tabella campaign_media).
// Da pubblicare con "Verify JWT" disattivato: il tag <audio> non può mandare intestazioni.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'range, authorization, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-range, content-length, accept-ranges',
}

const URL_ = Deno.env.get('SUPABASE_URL')!
// chiave pubblica (la stessa del sito): basta per chiamare la funzione SQL is_drive_audio
const KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_VcA308ZsaBMMubcP15pCpQ_vDtPN76c'

const known = new Map<string, number>()
async function isRegistered(id: string) {
  const t = known.get(id)
  if (t && Date.now() - t < 10 * 60_000) return true
  const headers: Record<string, string> = { apikey: KEY, 'content-type': 'application/json' }
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`
  const r = await fetch(`${URL_}/rest/v1/rpc/is_drive_audio`, { method: 'POST', headers, body: JSON.stringify({ p_id: id }) })
  if (!r.ok) { console.error('is_drive_audio', r.status, await r.text()); return false }
  const ok = (await r.json()) === true
  if (ok) known.set(id, Date.now())
  return ok
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!/^[\w-]{20,80}$/.test(id)) return new Response('id non valido', { status: 400, headers: CORS })
  if (!(await isRegistered(id))) return new Response('brano non trovato', { status: 404, headers: CORS })

  const headers: Record<string, string> = {}
  const range = req.headers.get('range')
  if (range) headers.range = range
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { headers, redirect: 'follow' })
  const ct = res.headers.get('content-type') ?? ''
  if (!res.ok && res.status !== 206) return new Response(`Drive ha risposto ${res.status}`, { status: 502, headers: CORS })
  if (ct.startsWith('text/html')) {
    await res.body?.cancel()
    return new Response('Drive non consente il download: il file è condiviso con "Chiunque abbia il link"?', { status: 502, headers: CORS })
  }
  const out = new Headers(CORS)
  for (const h of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = res.headers.get(h)
    if (v) out.set(h, v)
  }
  if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes')
  out.set('content-type', ct.startsWith('audio/') ? ct : 'audio/mpeg')
  out.set('cache-control', 'public, max-age=86400')
  return new Response(res.body, { status: res.status, headers: out })
})
