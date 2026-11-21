import { useMemo, useState } from 'react'
import type { Character } from '../lib/types'
import { CARDS, cardName, cardText, domainName, getCard, getClass, type DomainCard } from '../data'
import { MAX_LOADOUT } from '../lib/rules'
import { DomainCardView } from './CardView'
import { Sheet, useToast } from './ui'
import { StressButtons } from './StressUse'
import { CardActionButtons } from './CardPlay'
import type { CardAction } from '../lib/cardEffects'
import type { StressUse } from '../lib/costs'

export function CardsTab({ c, canEdit, patch, onStress, onPlayCard, onCardTokens }: { c: Character; canEdit: boolean; patch: (p: Partial<Character>) => void; onStress?: (u: StressUse, src: string) => void; onPlayCard?: (card: { id: string; name: string }, a: CardAction) => void; onCardTokens?: (cardId: string, n: number) => void }) {
  const toast = useToast()
  const d = c.data
  const [resting, setResting] = useState(false)
  const [adding, setAdding] = useState(false)
  const loadout = d.loadout.map(getCard).filter(Boolean) as DomainCard[]
  const vault = d.vault.map(getCard).filter(Boolean) as DomainCard[]

  function toVault(id: string) {
    patch({ data: { ...d, loadout: d.loadout.filter(x => x !== id), vault: [...d.vault, id] } })
  }
  function toLoadout(card: DomainCard) {
    if (d.loadout.length >= MAX_LOADOUT) { toast({ text: 'Il loadout è pieno: sposta prima una carta nel vault.', tone: 'error' }); return }
    const cost = resting ? 0 : card.recall
    if (c.stress_marked + cost > c.stress_max) { toast({ text: `Servono ${cost} Stress liberi per richiamare questa carta.`, tone: 'error' }); return }
    patch({
      stress_marked: c.stress_marked + cost,
      data: { ...d, vault: d.vault.filter(x => x !== card.id), loadout: [...d.loadout, card.id] },
    })
    if (cost) toast({ text: `${card.name} richiamata: +${cost} Stress` })
  }

  return (
    <div className="cards-tab">
      <div className="section-head">
        <h2>Dotazione <small>({loadout.length}/{MAX_LOADOUT})</small></h2>
        {canEdit && <button className="btn btn-ghost small" onClick={() => setAdding(true)}>Aggiungi carta</button>}
      </div>
      {loadout.length === 0 && <p className="empty">Nessuna carta attiva.</p>}
      <div className="card-grid">
        {loadout.map(card => (
          <DomainCardView key={card.id} card={card}
            action={canEdit && <>
              <CardActionButtons cardId={card.id} cardName={cardName(card)} c={c} canEdit={canEdit} onPlay={onPlayCard} onTokens={onCardTokens} />
              <StressButtons text={cardText(card)} src={cardName(card)} c={c} canEdit={canEdit} onUse={onStress} />
              <button className="btn btn-ghost small" onClick={() => toVault(card.id)}>Metti nel Rifugio</button>
            </>} />
        ))}
      </div>

      <div className="section-head">
        <h2>Rifugio <small>({vault.length})</small></h2>
        {canEdit && vault.length > 0 && (
          <label className="toggle"><input type="checkbox" checked={resting} onChange={e => setResting(e.target.checked)} /> Siamo a riposo (scambio gratuito)</label>
        )}
      </div>
      {vault.length === 0 && <p className="empty">Le carte oltre le cinque della dotazione finiscono qui.</p>}
      <div className="card-grid">
        {vault.map(card => (
          <DomainCardView key={card.id} card={card} dim
            action={canEdit && <button className="btn btn-ghost small" onClick={() => toLoadout(card)}>Richiama{resting || !card.recall ? '' : `, ${card.recall} Stress`}</button>} />
        ))}
      </div>

      <AddCardSheet open={adding} onClose={() => setAdding(false)} c={c} onAdd={card => {
        const full = d.loadout.length >= MAX_LOADOUT
        patch({ data: { ...d, loadout: full ? d.loadout : [...d.loadout, card.id], vault: full ? [...d.vault, card.id] : d.vault } })
        toast({ text: `${card.name} aggiunta ${full ? 'al Rifugio' : 'alla dotazione'}` })
        setAdding(false)
      }} />
    </div>
  )
}

function AddCardSheet({ open, onClose, c, onAdd }: { open: boolean; onClose: () => void; c: Character; onAdd: (card: DomainCard) => void }) {
  const cls = getClass(c.data.class_id)
  const multi = c.data.multiclass
  const domains = [...(cls?.domains ?? []), ...(multi?.domain ? [multi.domain] : [])]
  const [dom, setDom] = useState(domains[0])
  const owned = new Set([...c.data.loadout, ...c.data.vault])
  const list = useMemo(() => CARDS.filter(x => {
    if (x.domain !== dom || owned.has(x.id)) return false
    const max = multi?.domain === dom && !cls?.domains.includes(dom) ? Math.ceil(c.level / 2) : c.level
    return x.level <= max
  }).sort((a, b) => b.level - a.level), [dom, c])
  return (
    <Sheet open={open} onClose={onClose} title="Aggiungi carta dominio" wide>
      <div className="seg">
        {domains.map(x => <button key={x} type="button" className={dom === x ? 'sel' : ''} onClick={() => setDom(x)}>{domainName(x)}</button>)}
      </div>
      <p className="hint">Carte fino al livello {c.level}. Le carte del multiclasse arrivano fino a metà del tuo livello.</p>
      <div className="card-grid">
        {list.map(card => <DomainCardView key={card.id} card={card} onClick={() => onAdd(card)} />)}
      </div>
    </Sheet>
  )
}
