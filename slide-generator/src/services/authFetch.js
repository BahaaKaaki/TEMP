/**
 * Auth-aware fetch wrapper (Route B of allowlist-experiment-2026-04-23).
 *
 * Attaches an Entra ID token (Authorization: Bearer <idToken>) to calls that
 * hit OUR OWN backend (paths starting with "/api/"). Calls to third-party
 * providers (OpenAI, Anthropic, Gemini) are passed through untouched so we
 * never leak the tenant ID token to non-PwC domains.
 *
 * The MSAL instance is injected once at boot via `setMsalInstance()` from
 * `main.jsx`. If no instance is registered yet, or no account is signed in,
 * the fetch proceeds WITHOUT an Authorization header -- the backend will
 * either accept it (ALLOWLIST_MODE=off, the default) or return 401
 * (ALLOWLIST_MODE=log|enforce), whichever matches the current flip state.
 *
 * Why this design and not a global fetch monkey-patch:
 *   - Explicit call-sites stay greppable and auditable.
 *   - Third-party provider URLs are never at risk of receiving our token.
 *   - Dev / localhost works unchanged when MSAL isn't wired up (no token
 *     attached, backend runs in off mode).
 */

let _msalInstance = null;
let _loginRequest = null;

/**
 * Register the MSAL PublicClientApplication after it has been initialised in
 * main.jsx. Idempotent; calling twice just overrides the reference.
 */
export function setMsalInstance(instance, loginRequest) {
  _msalInstance = instance;
  _loginRequest = loginRequest || { scopes: ['openid', 'profile', 'email'] };
}

function isOurBackend(url) {
  if (typeof url !== 'string') return false;
  // Relative URL starting with /api/ always means same-origin backend.
  // Absolute URLs are out of scope -- if someone ever calls a full URL to
  // our backend, they must opt-in by switching to a relative path first.
  return url.startsWith('/api/');
}

async function getIdToken({ forceRefresh = false } = {}) {
  if (!_msalInstance) return null;
  const account =
    _msalInstance.getActiveAccount() ||
    _msalInstance.getAllAccounts()[0] ||
    null;
  if (!account) return null;
  try {
    const result = await _msalInstance.acquireTokenSilent({
      ..._loginRequest,
      account,
      forceRefresh,
    });
    return result?.idToken || null;
  } catch (err) {
    // InteractionRequiredAuthError: token can't be refreshed silently (e.g.,
    // user revoked consent, session expired). Fall through and return null.
    // The backend will return 401; the App-level bootstrap will then prompt
    // the user to sign in again via loginRedirect.
    console.warn('[authFetch] silent token acquisition failed:', err?.errorCode || err?.message);
    return null;
  }
}

/**
 * Drop-in replacement for the global `fetch` that conditionally attaches an
 * MSAL ID token on same-origin /api/ calls.
 */
export async function authFetch(url, options = {}) {
  if (!isOurBackend(url)) {
    return fetch(url, options);
  }
  const idToken = await getIdToken();
  const headers = new Headers(options.headers || {});
  if (idToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status !== 401) {
    return response;
  }

  const refreshedToken = await getIdToken({ forceRefresh: true });
  if (!refreshedToken || refreshedToken === idToken) {
    return response;
  }

  const retryHeaders = new Headers(options.headers || {});
  retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
  return fetch(url, { ...options, headers: retryHeaders });
}
