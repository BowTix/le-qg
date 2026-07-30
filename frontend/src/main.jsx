import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './trade-notifications.css'
import './typography.css'
import App from './App.jsx'
import { registerServiceWorker } from './pwa/registerServiceWorker'
import { startOfflineSync } from './utils/offlineGames'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)


registerServiceWorker()
startOfflineSync()
