import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(error => console.error('DayPlan service worker registration failed:', error))
createRoot(document.getElementById('root')!).render(<App />)
