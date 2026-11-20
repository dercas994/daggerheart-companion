import { createContext, useContext, useEffect, useState } from 'react'
import type { Backend, User } from './lib/types'
import { backend } from './lib/backend'
import { useRoute } from './lib/router'
import { Spinner, ToastHost } from './components/ui'
import { AuthPage } from './pages/Auth'
import { HomePage } from './pages/Home'
import { CampaignPage } from './pages/Campaign'
import { WizardPage } from './pages/Wizard'
import { CharacterPage } from './pages/Character'
import { UpdateBanner } from './components/UpdateBanner'

interface Ctx { be: Backend; user: User; setUser: (u: User | null) => void }
const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => useContext(AppCtx)!

export default function App() {
  if (!backend) return <NotConfigured />
  return <ToastHost><UpdateBanner /><Authed be={backend} /></ToastHost>
}

function Authed({ be }: { be: Backend }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const route = useRoute()

  useEffect(() => {
    be.getUser().then(setUser).catch(() => setUser(null))
    return be.onAuthChange(u => setUser(u))
  }, [be])

  if (user === undefined) return <div className="center-screen"><Spinner /></div>
  if (!user) return <AuthPage be={be} />

  return (
    <AppCtx.Provider value={{ be, user, setUser }}>
      {route.name === 'home' && <HomePage />}
      {route.name === 'campaign' && <CampaignPage id={route.id} key={route.id} />}
      {route.name === 'wizard' && <WizardPage campaignId={route.campaignId} />}
      {route.name === 'character' && <CharacterPage id={route.id} key={route.id} />}
    </AppCtx.Provider>
  )
}

function NotConfigured() {
  return (
    <main className="center-screen narrow">
      <h1 className="brand">Daggerheart Companion</h1>
      <p>Manca la configurazione di Supabase.</p>
      <p className="hint">Crea il file <code>.env.local</code> nella cartella del progetto con <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (li trovi in Supabase, Project Settings, API), poi riavvia <code>npm run dev</code>.</p>
    </main>
  )
}
