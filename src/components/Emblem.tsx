/** Logo dell'app: dado d12 diviso tra Speranza (oro) e Paura (viola), attraversato da un pugnale. */
export function Emblem({ size = 72 }: { size?: number }) {
  return <img className="emblem" src="./icon.svg" width={size} height={size} alt="" aria-hidden="true" style={{ borderRadius: size * 0.22 }} />
}
