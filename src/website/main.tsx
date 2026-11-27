import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Page } from './Page'
import './site.css'
import { startMeasuring } from './analytics'

startMeasuring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
