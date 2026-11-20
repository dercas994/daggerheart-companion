// Link all'APK pubblicato dalla GitHub Action "APK Android" (release apk-latest).
export const APK_URL = 'https://github.com/dercas994/daggerheart-companion/releases/download/apk-latest/daggerheart-companion.apk'

const insideApp = () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()

export function AppDownload({ compact }: { compact?: boolean }) {
  if (insideApp()) return null
  return (
    <a className={`app-download ${compact ? 'compact' : ''}`} href={APK_URL} rel="noopener">
      <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
        <path fill="currentColor" d="M17.5 9.5H6.5a1 1 0 0 0-1 1V17a1.5 1.5 0 0 0 1.5 1.5h.5V21a1 1 0 0 0 2 0v-2.5h1V21a1 1 0 0 0 2 0v-2.5h1V21a1 1 0 0 0 2 0v-2.5h.5A1.5 1.5 0 0 0 18.5 17v-6.5a1 1 0 0 0-1-1Zm-14 0a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1Zm17 0a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1ZM15.3 4.1l.9-1.5a.3.3 0 0 0-.5-.3l-.9 1.5a6 6 0 0 0-5.6 0l-.9-1.5a.3.3 0 0 0-.5.3l.9 1.5A5.2 5.2 0 0 0 6.5 8.5h11a5.2 5.2 0 0 0-2.2-4.4ZM9.5 7a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Zm5 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Z" />
      </svg>
      <span>
        <b>Scarica l’app Android</b>
        {!compact && <small>APK, circa 4 MB. Al primo avvio Android chiede di consentire l’installazione.</small>}
      </span>
    </a>
  )
}
