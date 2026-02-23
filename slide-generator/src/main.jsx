import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import PasswordGate from './components/PasswordGate'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PasswordGate>
      <AuthProvider>
        <App />
      </AuthProvider>
    </PasswordGate>
  </StrictMode>,
)
