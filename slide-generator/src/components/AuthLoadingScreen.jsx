import { useState, useEffect } from 'react';

export default function AuthLoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  const messages = ['Verifying credentials...', 'Loading your workspace...', 'Almost ready...'];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        const remaining = 100 - p;
        return p + Math.max(0.5, remaining * 0.08);
      });
    }, 60);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress > 35 && stage === 0) setStage(1);
    if (progress > 70 && stage === 1) setStage(2);
  }, [progress, stage]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #fff 0%, #fdf6f6 50%, #f9eded 100%)',
      animation: 'al-enter 0.6s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      <style>{`
        @keyframes al-enter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes al-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes al-shimmer {
          from { background-position: -200% 0; }
          to   { background-position: 200% 0; }
        }
        @keyframes al-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .al-msg-enter {
          animation: al-msg 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes al-msg {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Logo */}
      <div style={{ animation: 'al-float 3s ease-in-out infinite', marginBottom: 48 }}>
        <img
          src={`${import.meta.env.BASE_URL}SLogoLong.png`}
          alt="Strategy& Logo"
          style={{ height: 52, display: 'block' }}
        />
      </div>

      {/* Progress bar */}
      <div style={{
        width: 240, height: 3, borderRadius: 3,
        background: '#e8dada', overflow: 'hidden', marginBottom: 28,
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: 'linear-gradient(90deg, #8E1E1E, #c44040, #8E1E1E)',
          backgroundSize: '200% 100%',
          animation: 'al-shimmer 1.5s linear infinite',
          width: `${progress}%`,
          transition: 'width 0.3s ease-out',
        }} />
      </div>

      {/* Status message */}
      <p key={stage} className="al-msg-enter" style={{
        color: '#8E1E1E', fontSize: 13, fontWeight: 500,
        margin: 0, letterSpacing: '0.02em',
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        {messages[stage]}
        <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 3, height: 3, borderRadius: '50%',
              background: '#8E1E1E', display: 'inline-block',
              animation: `al-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
        </span>
      </p>
    </div>
  );
}
