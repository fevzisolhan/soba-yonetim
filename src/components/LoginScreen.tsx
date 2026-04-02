import { useState, useEffect, useRef } from 'react';

const PASS_KEY = 'sobaYonetim_appPass';
const SESSION_KEY = 'sobaYonetim_session';
const REMEMBER_KEY = 'sobaYonetim_remember';

export function getStoredHash(): string | null {
  return localStorage.getItem(PASS_KEY);
}

export async function hashPass(pass: string): Promise<string> {
  const enc = new TextEncoder().encode(pass + 'solhan_soba_2026');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isSessionValid(): boolean {
  try {
    // Kalıcı oturum (beni hatırla)
    const remRaw = localStorage.getItem(REMEMBER_KEY);
    if (remRaw) {
      const { ts } = JSON.parse(remRaw);
      if (Date.now() - ts < 30 * 24 * 60 * 60 * 1000) return true;
      localStorage.removeItem(REMEMBER_KEY);
    }
    // Geçici oturum
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return Date.now() - ts < 8 * 60 * 60 * 1000;
  } catch { return false; }
}

function setSession(remember: boolean) {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ ts: Date.now() }));
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }));
  }
}

export function useAuth() {
  const [authed, setAuthed] = useState(() => {
    const hasPass = !!getStoredHash();
    if (!hasPass) return false;
    return isSessionValid();
  });

  const login = (remember = false) => { setSession(remember); setAuthed(true); };
  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    setAuthed(false);
  };
  const hasPassword = !!getStoredHash();

  return { authed, login, logout, hasPassword };
}

function Particle({ index }: { index: number }) {
  const size = 2 + Math.random() * 4;
  const left = Math.random() * 100;
  const delay = Math.random() * 20;
  const duration = 15 + Math.random() * 25;
  const opacity = 0.1 + Math.random() * 0.4;

  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: index % 3 === 0 ? '#ff5722' : index % 3 === 1 ? '#ff9800' : '#ffffff',
        left: `${left}%`,
        bottom: '-5%',
        opacity: 0,
        animation: `floatUp ${duration}s ${delay}s infinite`,
        pointerEvents: 'none',
        filter: `blur(${size > 4 ? 1 : 0}px)`,
        boxShadow: index % 3 === 0 ? '0 0 6px rgba(255,87,34,0.6)' : 'none',
      }}
    />
  );
}

export default function LoginScreen({ onLogin }: { onLogin: (remember: boolean) => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>(getStoredHash() ? 'login' : 'setup');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 500);
  }, [mode]);

  const doShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleLogin = async () => {
    if (!pass) { setError('Parola gerekli'); doShake(); return; }
    setLoading(true);
    const hashed = await hashPass(pass);
    const stored = getStoredHash();
    if (hashed === stored) {
      setSuccess(true);
      setTimeout(() => onLogin(remember), 800);
    } else {
      setError('Yanlış parola!');
      doShake();
      setPass('');
    }
    setLoading(false);
  };

  const handleSetup = async () => {
    if (pass.length < 4) { setError('En az 4 karakter gerekli'); doShake(); return; }
    if (pass !== pass2) { setError('Parolalar eşleşmiyor!'); doShake(); return; }
    setLoading(true);
    const hashed = await hashPass(pass);
    localStorage.setItem(PASS_KEY, hashed);
    setSuccess(true);
    setTimeout(() => onLogin(remember), 800);
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      mode === 'login' ? handleLogin() : handleSetup();
    }
  };

  const particles = Array.from({ length: 50 }, (_, i) => <Particle key={i} index={i} />);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#040810',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          10% { opacity: var(--particle-opacity, 0.3); transform: translateY(-10vh) scale(1); }
          90% { opacity: var(--particle-opacity, 0.3); }
          100% { transform: translateY(-110vh) scale(0.5); opacity: 0; }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(12px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
        @keyframes fadeOut {
          to { opacity: 0; transform: scale(1.1); filter: blur(10px); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255,87,34,0.2), 0 0 60px rgba(255,87,34,0.1); }
          50% { box-shadow: 0 0 40px rgba(255,87,34,0.4), 0 0 80px rgba(255,87,34,0.2); }
        }
        @keyframes orbFloat {
          0% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -40px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
        @keyframes textGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(255,87,34,0.3); }
          50% { text-shadow: 0 0 40px rgba(255,87,34,0.6), 0 0 80px rgba(255,87,34,0.3); }
        }
      `}</style>

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(-45deg, #070e1c, #0d1b2e, #131a2e, #0a1628, #0f0a1e, #070e1c)',
        backgroundSize: '400% 400%',
        animation: 'gradientShift 20s ease infinite',
      }} />

      <div style={{
        position: 'absolute', top: '15%', left: '20%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,87,34,0.08) 0%, transparent 70%)',
        animation: 'orbFloat 30s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '15%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        animation: 'orbFloat 25s ease-in-out infinite reverse',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '60%',
        width: 250, height: 250, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)',
        animation: 'pulse 8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {particles}

      <div style={{
        position: 'absolute', top: 30, left: 0, right: 0,
        textAlign: 'center', color: 'rgba(255,255,255,0.15)',
        fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.3em',
        textTransform: 'uppercase',
      }}>
        Solhan Ticaret Yönetim Sistemi
      </div>

      <div style={{
        position: 'absolute', top: 50, right: 40,
        color: 'rgba(255,255,255,0.2)',
        fontSize: '0.85rem', fontWeight: 300,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
      </div>

      <div style={{
        position: 'relative', zIndex: 10,
        animation: success ? 'fadeOut 0.8s ease forwards' : `slideUp 0.8s ease ${shake ? ', shakeX 0.5s ease' : ''}`,
        width: '100%', maxWidth: 420, padding: '0 20px',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '48px 36px 40px',
          boxShadow: '0 30px 100px rgba(0,0,0,0.5)',
          animation: 'glowPulse 4s ease-in-out infinite',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 80, height: 80, margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff5722 0%, #ff9800 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.2rem',
              boxShadow: '0 8px 32px rgba(255,87,34,0.4)',
              animation: 'pulse 3s ease-in-out infinite',
            }}>
              🔥
            </div>
            <h1 style={{
              fontSize: '1.6rem', fontWeight: 900,
              background: 'linear-gradient(135deg, #ff5722, #ff9800, #ffb74d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 6,
              animation: 'textGlow 3s ease-in-out infinite',
              letterSpacing: '-0.02em',
            }}>
              Solhan
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', fontWeight: 400 }}>
              {mode === 'login' ? 'Hesabınıza giriş yapın' : 'Giriş parolası oluşturun'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.25)', fontSize: '1.1rem', pointerEvents: 'none',
              }}>🔒</div>
              <input
                ref={inputRef}
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => { setPass(e.target.value); setError(''); }}
                onKeyDown={handleKey}
                placeholder={mode === 'login' ? 'Parola' : 'Yeni parola (min 4 karakter)'}
                autoComplete="off"
                style={{
                  width: '100%', padding: '16px 50px 16px 48px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16, color: '#f1f5f9', fontSize: '1rem',
                  boxSizing: 'border-box', outline: 'none',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,87,34,0.4)'}
                onBlur={e => e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}
              />
              <button
                onClick={() => setShowPass(p => !p)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', fontSize: '1rem', padding: '4px',
                }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>

            {mode === 'setup' && (
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.25)', fontSize: '1.1rem', pointerEvents: 'none',
                }}>🔐</div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={pass2}
                  onChange={e => { setPass2(e.target.value); setError(''); }}
                  onKeyDown={handleKey}
                  placeholder="Parolayı tekrar girin"
                  autoComplete="off"
                  style={{
                    width: '100%', padding: '16px 16px 16px 48px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 16, color: '#f1f5f9', fontSize: '1rem',
                    boxSizing: 'border-box', outline: 'none',
                    transition: 'border-color 0.3s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,87,34,0.4)'}
                  onBlur={e => e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}
                />
              </div>
            )}

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: '#f87171', fontSize: '0.82rem', fontWeight: 500,
                padding: '8px 12px', background: 'rgba(239,68,68,0.08)',
                borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#ff5722', cursor: 'pointer' }}
              />
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
                Beni hatırla <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>(30 gün)</span>
              </span>
            </label>

            <button
              onClick={mode === 'login' ? handleLogin : handleSetup}
              disabled={loading}
              style={{
                width: '100%', padding: '16px 0',
                background: loading
                  ? 'rgba(255,87,34,0.4)'
                  : 'linear-gradient(135deg, #ff5722 0%, #ff7043 50%, #ff9800 100%)',
                border: 'none', borderRadius: 16,
                color: '#fff', fontSize: '1.05rem', fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: '0 8px 30px rgba(255,87,34,0.3)',
                transition: 'all 0.3s',
                transform: loading ? 'scale(0.98)' : 'scale(1)',
              }}
            >
              {loading ? '⏳ Kontrol ediliyor...' : mode === 'login' ? '🚀 Giriş Yap' : '✅ Parolayı Kaydet'}
            </button>
          </div>

          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={() => {
                  const answer = prompt('Parolayı sıfırlamak için mevcut localStorage veriniz silinecek.\n"SIFIRLA" yazın:');
                  if (answer === 'SIFIRLA') {
                    localStorage.removeItem(PASS_KEY);
                    sessionStorage.removeItem(SESSION_KEY);
                    setMode('setup');
                    setPass('');
                    setError('');
                  }
                }}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem',
                  cursor: 'pointer', textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                Parolayı unuttum
              </button>
            </div>
          )}
        </div>

        <div style={{
          textAlign: 'center', marginTop: 24,
          color: 'rgba(255,255,255,0.1)', fontSize: '0.72rem',
          fontWeight: 400,
        }}>
          Solhan Ticaret &copy; {new Date().getFullYear()} &middot; Kolay Ön Muhasebe
        </div>
      </div>
    </div>
  );
}
