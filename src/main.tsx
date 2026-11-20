import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// PWA: il service worker serve solo sul web, non dentro l'APK
if ('serviceWorker' in navigator && location.protocol === 'https:' && !(window as any).Capacitor) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
