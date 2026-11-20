import type { ReactNode } from 'react'
import { useApp } from '../App'
import { Emblem } from './Emblem'

export function TopBar({ title, back, right }: { title: ReactNode; back?: string; right?: ReactNode }) {
  const { be } = useApp()
  return (
    <header className="topbar">
      {back ? <a className="icon-btn" href={back} aria-label="Indietro">‹</a> : <a href="#/" aria-label="Home"><Emblem size={30} /></a>}
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        {right}
        {!back && <button className="btn btn-ghost small" onClick={() => be.signOut()}>Esci</button>}
      </div>
    </header>
  )
}
