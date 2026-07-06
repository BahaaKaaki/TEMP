import { useMsal } from '@azure/msal-react';

/**
 * Shown when the /api/whoami bootstrap check reports the signed-in user is
 * not on the Strategy& active staff allowlist. Visually matches the LoginPage
 * palette so the experience feels coherent, but makes the blocked state
 * unmistakable and offers a single path out (sign out + try another account).
 */
export default function AccessDenied({ email, onSignOut }) {
  const { instance } = useMsal();

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin + '/login',
      });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #fff 0%, #fdf6f6 50%, #f9eded 100%)',
      overflow: 'hidden',
    }}>
      <div style={{
        maxWidth: 520, width: '100%', padding: '0 2rem', textAlign: 'center',
      }}>
        <img
          src={`${import.meta.env.BASE_URL}SLogoLong.png`}
          alt="Strategy& Logo"
          style={{ height: 56, margin: '0 auto 2.5rem' }}
        />

        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1.5rem',
          background: '#8E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(142, 30, 30, 0.25)',
        }}>
          <svg width="28" height="28" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <h1 style={{
          fontSize: '1.6rem', fontWeight: 400, color: '#1a1a1a',
          margin: '0 0 0.75rem', letterSpacing: '-0.01em',
        }}>
          Access not available
        </h1>

        <p style={{ color: '#555', fontSize: '0.95rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          Your account is not on the approved Strategy& staff list for Edwin AI.
          If you believe this is a mistake, please contact the Strategy&amp; admin team.
        </p>

        {email && (
          <div style={{
            fontSize: '0.82rem', color: '#888', marginBottom: '2rem',
            padding: '0.6rem 0.9rem', background: '#f5eeee', borderRadius: 8,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            display: 'inline-block',
          }}>
            Signed in as {email}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              padding: '0.8rem 1.6rem', background: '#8E1E1E', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.95rem',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(142, 30, 30, 0.2)',
            }}
          >
            Sign out and try another account
          </button>
        </div>

        <p style={{
          fontSize: '0.78rem', color: '#b0a0a0',
          marginTop: '2.5rem', letterSpacing: '0.04em',
        }}>
          Part of the PwC network
        </p>
      </div>
    </div>
  );
}
