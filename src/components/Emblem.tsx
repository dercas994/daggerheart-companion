/** Emblema originale: una lama divisa tra oro (Speranza) e viola (Paura). */
export function Emblem({ size = 72 }: { size?: number }) {
  return (
    <svg className="emblem" width={size} height={size} viewBox="-100 -100 200 200" aria-hidden="true">
      <circle r="92" className="emblem-ring" />
      <path d="M0-78 L18-18 L0 78 L-18-18Z" fill="var(--hope)" />
      <path d="M0-78 L18-18 L0 78Z" fill="var(--fear)" />
      <circle r="11" fill="var(--night)" stroke="var(--parchment)" strokeWidth="4" />
    </svg>
  )
}
