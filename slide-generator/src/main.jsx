import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { createMsalConfig, createLoginRequest, AuthProvider } from 'frontend-comps'
import { setMsalInstance } from './services/authFetch'
import { loadCatalog as loadIconCatalog } from './services/icons/iconCatalog.js'
import App from './App.jsx'

const root = ReactDOM.createRoot(document.getElementById('root'));

async function boot() {
  const env = window.__ENV || {};

  const clientId = env.VITE_AZURE_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID;
  const tenantId = env.VITE_AZURE_TENANT_ID || import.meta.env.VITE_AZURE_TENANT_ID;
  const appUrl = env.VITE_APP_URL || import.meta.env.VITE_APP_URL || window.location.origin;

  if (!clientId || !tenantId) {
    throw new Error(`MSAL config missing: clientId=${clientId}, tenantId=${tenantId}`);
  }

  const msalConfig = createMsalConfig({ clientId, tenantId, redirectUri: appUrl });
  const msalInstance = new PublicClientApplication(msalConfig);
  const loginRequest = createLoginRequest(['openid', 'profile', 'email']);

  await msalInstance.initialize();
  const response = await msalInstance.handleRedirectPromise();

  const account =
    response?.account ||
    msalInstance.getActiveAccount() ||
    msalInstance.getAllAccounts()[0] ||
    null;

  if (account) {
    msalInstance.setActiveAccount(account);
  }

  // Register the MSAL instance with the auth-aware fetch helper so every
  // subsequent /api/* call can attach a fresh ID token transparently.
  setMsalInstance(msalInstance, loginRequest);

  // Warm the Strategy& icon catalog in the background. Safe to ignore failures
  // -- the freestyle prompt builder gracefully omits the catalog section if
  // it's not loaded, and the runtime resolver will retry per-slug.
  loadIconCatalog().catch(() => {});

  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
      msalInstance.setActiveAccount(event.payload.account);
    }
  });

  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthProvider loginRequest={loginRequest} postLogoutRedirectUri={appUrl}>
          <App />
        </AuthProvider>
      </MsalProvider>
    </React.StrictMode>
  );
}

boot().catch((err) => {
  console.error('[MSAL boot error]', err);
  root.render(
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', fontFamily: 'system-ui, sans-serif', padding: 40,
    }}>
      <div style={{ maxWidth: 500, textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 12px', color: '#8E1E1E' }}>Authentication Error</h2>
        <p style={{ color: '#555', lineHeight: 1.6 }}>
          Could not initialize authentication. Please try refreshing the page.
        </p>
        <pre style={{
          marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 6,
          fontSize: 12, textAlign: 'left', overflow: 'auto', color: '#333',
        }}>
          {err?.message || String(err)}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16, padding: '10px 24px', background: '#8E1E1E', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
});
