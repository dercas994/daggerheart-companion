import type { ReactNode } from 'react'
import type { DomainCard } from '../data'
import { cardName, cardText, DOMAIN_COLOR, domainName, IT } from '../data'

export function DomainCardView({ card, selected, onClick, action, dim }: {
  card: DomainCard; selected?: boolean; onClick?: () => void; action?: ReactNode; dim?: boolean
}) {
  const Tag = onClick ? 'button' : 'article'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`dcard ${selected ? 'sel' : ''} ${dim ? 'dim' : ''}`} style={{ ['--dom' as any]: DOMAIN_COLOR[card.domain] }}
      aria-pressed={onClick ? !!selected : undefined}>
      <header className="dcard-head">
        <span className="dcard-level" title="Livello">{card.level}</span>
        <span className="dcard-meta">{domainName(card.domain)}, {IT.cardType[card.type]}</span>
        <span className="dcard-recall" title="Costo di richiamo (Stress)">⚡{card.recall}</span>
      </header>
      <h4 className="dcard-name">{cardName(card)}</h4>
      <div className="dcard-text">{cardText(card).split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>
      {action && <div className="dcard-action">{action}</div>}
    </Tag>
  )
}

export function FeatureList({ items }: { items: { name: string; text: string }[] }) {
  return (
    <dl className="features">
      {items.map((f, i) => (
        <div key={i}>
          {f.name && <dt>{f.name}</dt>}
          <dd>{f.text.split('\n').map((p, j) => <p key={j}>{p}</p>)}</dd>
        </div>
      ))}
    </dl>
  )
}
