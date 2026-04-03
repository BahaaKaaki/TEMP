import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { createMsalConfig, createLoginRequest, AuthProvider } from 'frontend-comps'
import App from './App.jsx'

const env = window.__ENV || {};

const appUrl = env.VITE_APP_URL || import.meta.env.VITE_APP_URL || window.location.origin;

const msalConfig = createMsalConfig({
  clientId: env.VITE_AZURE_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID,
  tenantId: env.VITE_AZURE_TENANT_ID || import.meta.env.VITE_AZURE_TENANT_ID,
  redirectUri: appUrl,
});

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

msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <AuthProvider loginRequest={loginRequest} postLogoutRedirectUri={appUrl}>
        <App />
      </AuthProvider>
    </MsalProvider>
  </React.StrictMode>
);
