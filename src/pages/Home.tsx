import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from '../App'
import type { CampaignWithRole } from '../lib/types'
import { go } from '../lib/router'
import { ErrorLine, Sheet, Spinner, useAsync } from '../components/ui'
import { TopBar } from '../components/TopBar'

export function HomePage() {
  const { be, user } = useApp()
  const [list, setList] = useState<CampaignWithRole[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [code, setCode] = useState('')
  const create = useAsync()
  const join = useAsync()
  const load = useAsync()

  useEffect(() => { load.run(() => be.listMyCampaigns()).then(x => x && setList(x)) }, [be])

  async function doCreate(e: FormEvent) {
    e.preventDefault()
    const c = await create.run(() => be.createCampaign(name.trim(), desc.trim()))
    if (c) go(`/c/${c.id}`)
  }
  async function doJoin(e: FormEvent) {
    e.preventDefault()
    const c = await join.run(() => be.joinCampaign(code))
    if (c) go(`/c/${c.id}`)
  }

  const asGm = list?.filter(c => c.role === 'gm') ?? []
  const asPlayer = list?.filter(c => c.role === 'player') ?? []

  return (
    <>
      <TopBar title={`Ciao, ${user.display_name}`} />
      <main className="page">
        <section className="join panel">
          <form onSubmit={doJoin} className="join-form">
            <label className="field grow"><span>Hai un codice invito?</span>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="K7Q-2XM" maxLength={7}
                autoCapitalize="characters" spellCheck={false} className="code-input" />
            </label>
            <button className="btn btn-primary" disabled={join.busy || code.replace('-', '').length < 6}>Entra</button>
          </form>
          <ErrorLine error={join.error} />
        </section>

        {load.busy && !list && <Spinner />}
        <ErrorLine error={load.error} />

        {list && (
          <>
            <section>
              <div className="section-head">
                <h2>Le tue campagne da master</h2>
                <button className="btn btn-ghost" onClick={() => setCreating(true)}>Nuova campagna</button>
              </div>
              {asGm.length === 0 && <p className="empty">Crea una campagna e condividi il codice invito con i giocatori.</p>}
              <ul className="camp-list">{asGm.map(c => <CampaignItem key={c.id} c={c} />)}</ul>
            </section>
            <section>
              <h2>Campagne in cui giochi</h2>
              {asPlayer.length === 0 && <p className="empty">Chiedi al master il codice invito e inseriscilo qui sopra.</p>}
              <ul className="camp-list">{asPlayer.map(c => <CampaignItem key={c.id} c={c} />)}</ul>
            </section>
          </>
        )}
      </main>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nuova campagna">
        <form onSubmit={doCreate}>
          <label className="field"><span>Nome</span>
            <input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Le Ceneri di Haven" autoFocus />
          </label>
          <label className="field"><span>Premessa (facoltativa)</span>
            <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Due righe sul tono e sull’ambientazione" />
          </label>
          <ErrorLine error={create.error} />
          <button className="btn btn-primary" disabled={create.busy || !name.trim()}>Crea campagna</button>
        </form>
      </Sheet>
    </>
  )
}

function CampaignItem({ c }: { c: CampaignWithRole }) {
  return (
    <li>
      <a className="camp-item" href={`#/c/${c.id}`}>
        <span className="camp-name">{c.name}</span>
        {c.description && <span className="camp-desc">{c.description}</span>}
        <span className="camp-fear" title="Paura del master">
          <span className="fear-dot" />{c.fear}
        </span>
      </a>
    </li>
  )
}
