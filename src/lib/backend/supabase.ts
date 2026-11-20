import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, Campaign, CampaignWithRole, Character, Media, Member, Recap, Roll, User } from '../types'

function fail(error: { message: string } | null) {
  if (error) throw new Error(translate(error.message))
}

function translate(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return 'Email o password non corrette.'
  if (/User already registered/i.test(msg)) return 'Esiste già un account con questa email.'
  if (/Email not confirmed/i.test(msg)) return 'Conferma prima l’email: controlla la posta.'
  if (/Password should be/i.test(msg)) return 'La password deve avere almeno 6 caratteri.'
  return msg
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 20 } },
  })

  async function toUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined): Promise<User | null> {
    if (!u) return null
    const { data } = await sb.from('profiles').select('display_name').eq('id', u.id).maybeSingle()
    return { id: u.id, email: u.email ?? '', display_name: data?.display_name ?? String(u.user_metadata?.display_name ?? u.email ?? '') }
  }

  return {
    mode: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession()
      return toUser(data.session?.user)
    },
    onAuthChange(cb) {
      // niente chiamate a Supabase dentro la callback (rischio deadlock): rimando al giro successivo
      const { data } = sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => { toUser(session?.user).then(cb) }, 0) })
      return () => data.subscription.unsubscribe()
    },
    async signUp(email, password, displayName) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
      fail(error)
      return { needsConfirm: !data.session }
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      fail(error)
    },
    async signOut() { await sb.auth.signOut() },

    async listMyCampaigns() {
      const { data: s } = await sb.auth.getSession()
      const uid = s.session?.user.id
      const { data, error } = await sb.from('campaign_members').select('role, campaigns(*)').eq('user_id', uid!)
      fail(error)
      return (data ?? []).filter((r: any) => r.campaigns).map((r: any) => ({ ...(r.campaigns as Campaign), role: r.role })) as CampaignWithRole[]
    },
    async createCampaign(name, description) {
      const { data, error } = await sb.rpc('create_campaign', { p_name: name, p_description: description })
      fail(error)
      return data as Campaign
    },
    async joinCampaign(code) {
      const { data, error } = await sb.rpc('join_campaign', { p_code: code })
      fail(error)
      return data as Campaign
    },
    async getCampaign(id) {
      const { data, error } = await sb.from('campaigns').select('*').eq('id', id).single()
      fail(error)
      return data as Campaign
    },
    async updateCampaign(id, patch) {
      const { error } = await sb.from('campaigns').update(patch).eq('id', id)
      fail(error)
    },
    async deleteCampaign(id) {
      const { error } = await sb.from('campaigns').delete().eq('id', id)
      fail(error)
    },
    async listMembers(campaignId) {
      const { data, error } = await sb.from('campaign_members').select('campaign_id, user_id, role, profiles(display_name)').eq('campaign_id', campaignId)
      fail(error)
      return (data ?? []).map((m: any) => ({ campaign_id: m.campaign_id, user_id: m.user_id, role: m.role, display_name: m.profiles?.display_name ?? '' })) as Member[]
    },

    async listCharacters(campaignId) {
      const { data, error } = await sb.from('characters').select('*').eq('campaign_id', campaignId).order('created_at')
      fail(error)
      return (data ?? []) as Character[]
    },
    async getCharacter(id) {
      const { data, error } = await sb.from('characters').select('*').eq('id', id).single()
      fail(error)
      return data as Character
    },
    async createCharacter(c) {
      const { data: s } = await sb.auth.getSession()
      const { data, error } = await sb.from('characters').insert({ ...c, owner_id: s.session?.user.id }).select().single()
      fail(error)
      return data as Character
    },
    async updateCharacter(id, patch) {
      const { data, error } = await sb.from('characters').update(patch).eq('id', id).select().single()
      fail(error)
      return data as Character
    },
    async deleteCharacter(id) {
      const { error } = await sb.from('characters').delete().eq('id', id)
      fail(error)
    },

    async uploadPortrait(campaignId, characterId, image) {
      const ext = image.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${campaignId}/${characterId}/${Date.now()}.${ext}`
      const { error } = await sb.storage.from('portraits').upload(path, image, { contentType: image.type, upsert: false, cacheControl: '31536000' })
      fail(error)
      return sb.storage.from('portraits').getPublicUrl(path).data.publicUrl
    },
    async deletePortrait(url) {
      const i = url.indexOf('/portraits/')
      if (i < 0) return
      await sb.storage.from('portraits').remove([decodeURIComponent(url.slice(i + '/portraits/'.length))])
    },

    async roll(campaignId, characterId, req) {
      const { data, error } = await sb.rpc('roll_duality', {
        p_campaign: campaignId, p_character: characterId, p_modifier: req.modifier, p_label: req.label, p_advantage: req.advantage,
        ...(req.manual ? { p_hope: req.manual.hope, p_fear: req.manual.fear, p_adv: req.manual.adv ?? null } : {}),
      })
      fail(error)
      return data as Roll
    },
    async undoRoll(rollId, revert) {
      const { error } = await sb.rpc('undo_roll', { p_roll: rollId, p_revert: revert })
      fail(error)
    },
    async listRolls(campaignId, limit = 30) {
      const { data, error } = await sb.from('rolls').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(limit)
      fail(error)
      return (data ?? []) as Roll[]
    },

    async listRecaps(campaignId) {
      const { data, error } = await sb.from('session_recaps').select('*').eq('campaign_id', campaignId)
        .order('number', { ascending: true, nullsFirst: false }).order('created_at')
      fail(error)
      return (data ?? []) as Recap[]
    },
    async saveRecap(campaignId, r) {
      const row = { number: r.number ?? null, title: r.title ?? '', played_on: r.played_on || null, body: r.body ?? '' }
      const q = r.id
        ? sb.from('session_recaps').update({ ...row, updated_at: new Date().toISOString() }).eq('id', r.id)
        : sb.from('session_recaps').insert({ ...row, campaign_id: campaignId })
      const { data, error } = await q.select().single()
      fail(error)
      return data as Recap
    },
    async deleteRecap(id) {
      const { error } = await sb.from('session_recaps').delete().eq('id', id)
      fail(error)
    },

    async listMedia(campaignId) {
      const { data, error } = await sb.from('campaign_media').select('*').eq('campaign_id', campaignId).order('sort').order('created_at')
      fail(error)
      return (data ?? []) as Media[]
    },
    async addMedia(campaignId, items) {
      const { data, error } = await sb.from('campaign_media').insert(items.map(i => ({ ...i, campaign_id: campaignId }))).select()
      fail(error)
      return (data ?? []) as Media[]
    },
    async updateMedia(id, patch) {
      const { error } = await sb.from('campaign_media').update(patch).eq('id', id)
      fail(error)
    },
    async deleteMedia(m) {
      const { error } = await sb.from('campaign_media').delete().eq('id', m.id)
      fail(error)
      const marker = '/campaign-media/'
      const i = m.url?.indexOf(marker) ?? -1
      if (m.url && i >= 0) await sb.storage.from('campaign-media').remove([decodeURIComponent(m.url.slice(i + marker.length))])
    },
    async uploadMedia(campaignId, file, name) {
      const safe = name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80) || 'file'
      const path = `${campaignId}/${Date.now()}-${safe}`
      const { error } = await sb.storage.from('campaign-media').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' })
      if (error && /exceeded|too large|maximum/i.test(error.message)) throw new Error('File troppo grande (massimo 50 MB).')
      if (error && /mime|type/i.test(error.message)) throw new Error('Formato non supportato.')
      fail(error)
      return sb.storage.from('campaign-media').getPublicUrl(path).data.publicUrl
    },

    subscribe(campaignId, h) {
      const ch = sb.channel(`campaign:${campaignId}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${campaignId}` }, (p: any) => {
          if (p.eventType === 'DELETE') h.onCharacterDelete?.(p.old.id)
          else h.onCharacter?.(p.new as Character)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, (p: any) => h.onCampaign?.(p.new as Campaign))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rolls', filter: `campaign_id=eq.${campaignId}` }, (p: any) => h.onRoll?.(p.new as Roll))
        // le DELETE non si possono filtrare: arriva solo l'id, lo cerco nella lista locale
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rolls' }, (p: any) => p.old?.id && h.onRollDelete?.(p.old.id))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` }, () => h.onMembers?.())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_recaps', filter: `campaign_id=eq.${campaignId}` }, () => h.onRecaps?.())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_media', filter: `campaign_id=eq.${campaignId}` }, () => h.onMedia?.())
        .subscribe()
      return () => { sb.removeChannel(ch) }
    },
  }
}
