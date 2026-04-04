/**
 * Giriş Ekranı — Firebase Tabanlı Kimlik Doğrulama
 *
 * Parola Güvenliği:
 *  - Parola hash'i localStorage'da SAKLANMAZ
 *  - Hash, Firebase Firestore > config/auth dokümanında tutulur
 *  - İlk çalıştırmada varsayılan parola Firebase'e yazılır
 *  - Yeni tarayıcıdan giriş için parolanın bilinmesi zorunludur
 *  - "Parolayı sıfırla" seçeneği kaldırıldı (Firebase Console üzerinden yapılır)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';

// ── Firebase Auth Config ────────────────────────────────────────────────────
const FIREBASE_PROJECT = 'pars-4850c';
const FIREBASE_API_KEY = 'AIzaSyBL2_YIVMPBwojAfK7pzd2Eg5AG1sUyfig';
const FIREBASE_AUTH_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/config/auth?key=${FIREBASE_API_KEY}`;

/** Varsayılan parola (ilk çalıştırma) — sonradan değiştirin */
const DEFAULT_PASSWORD = 'solhan2026';

const SESSION_KEY = 'sobaYonetim_session';
const REMEMBER_KEY = 'sobaYonetim_remember';
/** Oturum süresince hash'i önbelleğe al (tarayıcı kapatınca silinir) */
const HASH_CACHE_KEY = 'sobaYonetim_hc';

// ── Şifreleme yardımcıları ───────────────────────────────────────────────────
const SALT = 'solhan_soba_2026';

export async function hashPass(pass: string): Promise<string> {
  const enc = new TextEncoder().encode(pass + SALT);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Firebase parola yönetimi ────────────────────────────────────────────────

async function fetchHashFromFirebase(): Promise<string | null> {
  try {
    const res = await fetch(FIREBASE_AUTH_URL, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.fields?.hash?.stringValue ?? null;
  } catch (e) {
    logger.warn('auth', 'Firebase hash okunamadı', { error: String(e) });
    return null;
  }
}

async function saveHashToFirebase(hash: string): Promise<boolean> {
  try {
    const payload = {
      fields: {
        hash: { stringValue: hash },
        updatedAt: { stringValue: new Date().toISOString() },
      },
    };
    const res = await fetch(FIREBASE_AUTH_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (e) {
    logger.error('auth', 'Firebase hash yazılamadı', { error: String(e) });
    return false;
  }
}

/** Oturum cache'inden hash al (sessionStorage — sekme kapanınca silinir) */
function getCachedHash(): string | null {
  try { return sessionStorage.getItem(HASH_CACHE_KEY); } catch { return null; }
}

function setCachedHash(hash: string) {
  try { sessionStorage.setItem(HASH_CACHE_KEY, hash); } catch { /* ignore */ }
}

// ── Oturum yönetimi ────────────────────────────────────────────────────────
function isSessionValid(): boolean {
  try {
    const remRaw = localStorage.getItem(REMEMBER_KEY);
    if (remRaw) {
      const { ts } = JSON.parse(remRaw);
      if (Date.now() - ts < 30 * 24 * 60 * 60 * 1000) return true;
      localStorage.removeItem(REMEMBER_KEY);
    }
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
  const [authed, setAuthed] = useState(() => isSessionValid());

  const login = (remember = false) => {
    setSession(remember);
    setAuthed(true);
    logger.info('auth', 'Giriş başarılı', { remember });
  };
  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(HASH_CACHE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    setAuthed(false);
    logger.info('auth', 'Oturum kapatıldı');
  };

  return { authed, login, logout };
}

// Parçacık sayısını sabit tut (re-render'da rastgele değer üretilmemesi için)
const PARTICLES = Array.from({ length: 55 }, (_, i) => ({
  size: 2 + ((i * 7) % 5),
  left: (i * 19.3) % 100,
  delay: (i * 1.37) % 22,
  duration: 14 + ((i * 3.1) % 24),
  color: i % 4 === 0 ? '#ff5722' : i % 4 === 1 ? '#ff9800' : i % 4 === 2 ? '#ffb74d' : 'rgba(255,255,255,0.6)',
  glow: i % 4 === 0,
}));

function Particle({ p }: { p: typeof PARTICLES[number] }) {
  return (
    <div style={{
      position: 'absolute',
      width: p.size, height: p.size,
      borderRadius: '50%',
      background: p.color,
      left: `${p.left}%`,
      bottom: '-5%',
      opacity: 0,
      animation: `floatUp ${p.duration}s ${p.delay}s infinite`,
      pointerEvents: 'none',
      filter: p.size > 4 ? 'blur(0.5px)' : 'none',
      boxShadow: p.glow ? `0 0 8px 2px rgba(255,87,34,0.5)` : 'none',
    }} />
  );
}

// ── Giriş Durumu tipi ──────────────────────────────────────────────────────
type LoginMode = 'login' | 'change-password';
type FirebaseStatus = 'connecting' | 'connected' | 'offline' | 'error';

export default function LoginScreen({ onLogin }: { onLogin: (remember: boolean) => void }) {
  const [mode, setMode] = useState<LoginMode>('login');
  const [pass, setPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fbStatus, setFbStatus] = useState<FirebaseStatus>('connecting');
  const [statusMsg, setStatusMsg] = useState('Firebase bağlantısı kuruluyor…');
  const inputRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState(new Date());
  const storedHashRef = useRef<string | null>(null);

  // Canlı saat
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Firebase'den hash yükle (veya varsayılanı oluştur)
  const loadHash = useCallback(async () => {
    setFbStatus('connecting');
    setStatusMsg('Firebase\'e bağlanılıyor…');
    logger.info('auth', 'Firebase parola hash\'i yükleniyor');

    // Önce oturum cache'e bak
    const cached = getCachedHash();
    if (cached) {
      storedHashRef.current = cached;
      setFbStatus('connected');
      setStatusMsg('Bağlandı — giriş yapabilirsiniz');
      setTimeout(() => inputRef.current?.focus(), 300);
      return;
    }

    const firebaseHash = await fetchHashFromFirebase();

    if (firebaseHash) {
      storedHashRef.current = firebaseHash;
      setCachedHash(firebaseHash);
      setFbStatus('connected');
      setStatusMsg('Bağlandı — giriş yapabilirsiniz');
      logger.info('auth', 'Parola hash\'i Firebase\'den yüklendi');
    } else {
      // İlk çalıştırma: varsayılan parolayı Firebase'e yaz
      logger.warn('auth', 'Firebase hash bulunamadı — varsayılan parola oluşturuluyor');
      setStatusMsg('İlk kurulum — varsayılan parola oluşturuluyor…');
      const defaultHash = await hashPass(DEFAULT_PASSWORD);
      const saved = await saveHashToFirebase(defaultHash);
      if (saved) {
        storedHashRef.current = defaultHash;
        setCachedHash(defaultHash);
        setFbStatus('connected');
        setStatusMsg('Kurulum tamamlandı — giriş yapabilirsiniz');
        logger.info('auth', 'Varsayılan parola Firebase\'e kaydedildi');
      } else {
        setFbStatus('error');
        setStatusMsg('Firebase bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.');
        logger.error('auth', 'Firebase\'e bağlanılamadı — giriş engellendi');
      }
    }
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => { loadHash(); }, [loadHash]);

  const doShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleLogin = async () => {
    if (!pass.trim()) { setError('Parola gerekli'); doShake(); return; }
    if (!storedHashRef.current) { setError('Firebase bağlantısı bekleniyor…'); doShake(); return; }
    setLoading(true);
    setError('');
    const t = logger.time('auth', 'Parola doğrulama');
    const hashed = await hashPass(pass);
    t.end();
    if (hashed === storedHashRef.current) {
      setSuccess(true);
      logger.info('auth', 'Doğrulama başarılı');
      setTimeout(() => onLogin(remember), 900);
    } else {
      setError('Yanlış parola! Lütfen tekrar deneyin.');
      doShake();
      setPass('');
      logger.warn('auth', 'Başarısız giriş denemesi');
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (!pass.trim()) { setError('Mevcut parola gerekli'); doShake(); return; }
    if (newPass.length < 6) { setError('Yeni parola en az 6 karakter olmalı'); doShake(); return; }
    if (newPass !== newPass2) { setError('Yeni parolalar eşleşmiyor'); doShake(); return; }
    if (!storedHashRef.current) { setError('Firebase bağlantısı bekleniyor…'); doShake(); return; }

    setLoading(true);
    setError('');
    const currentHashed = await hashPass(pass);
    if (currentHashed !== storedHashRef.current) {
      setError('Mevcut parola yanlış!');
      doShake();
      setLoading(false);
      return;
    }
    const newHashed = await hashPass(newPass);
    const saved = await saveHashToFirebase(newHashed);
    if (saved) {
      storedHashRef.current = newHashed;
      setCachedHash(newHashed);
      setMode('login');
      setPass(''); setNewPass(''); setNewPass2('');
      setError('');
      logger.info('auth', 'Parola başarıyla değiştirildi');
    } else {
      setError('Firebase kayıt hatası — internet bağlantınızı kontrol edin.');
    }
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      mode === 'login' ? handleLogin() : handleChangePassword();
    }
  };

  const fbColors: Record<FirebaseStatus, string> = {
    connecting: '#f59e0b',
    connected: '#10b981',
    offline: '#64748b',
    error: '#ef4444',
  };
  const fbDots: Record<FirebaseStatus, string> = {
    connecting: '◌',
    connected: '●',
    offline: '○',
    error: '✕',
  };

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
          0%   { transform: translateY(0) scale(0); opacity: 0; }
          10%  { opacity: 0.35; transform: translateY(-10vh) scale(1); }
          85%  { opacity: 0.25; }
          100% { transform: translateY(-115vh) scale(0.4); opacity: 0; }
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes loginSlideUp {
          from { opacity: 0; transform: translateY(48px) scale(0.94); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    filter: blur(0); }
        }
        @keyframes loginShakeX {
          0%,100% { transform: translateX(0); }
          20%  { transform: translateX(-14px); }
          40%  { transform: translateX(14px); }
          60%  { transform: translateX(-8px); }
          80%  { transform: translateX(8px); }
        }
        @keyframes loginFadeOut {
          to { opacity: 0; transform: scale(1.08); filter: blur(12px); }
        }
        @keyframes loginGlowPulse {
          0%,100% { box-shadow: 0 0 40px rgba(255,87,34,0.12), 0 40px 120px rgba(0,0,0,0.6); }
          50%     { box-shadow: 0 0 70px rgba(255,87,34,0.22), 0 40px 120px rgba(0,0,0,0.6); }
        }
        @keyframes loginOrbFloat {
          0%   { transform: translate(0,0) scale(1); }
          33%  { transform: translate(40px,-50px) scale(1.08); }
          66%  { transform: translate(-25px,30px) scale(0.95); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes loginTextGlow {
          0%,100% { text-shadow: 0 0 30px rgba(255,87,34,0.25); }
          50%     { text-shadow: 0 0 60px rgba(255,87,34,0.55), 0 0 100px rgba(255,152,0,0.2); }
        }
        @keyframes loginPulse {
          0%,100% { transform: scale(1);    opacity: 0.8; }
          50%     { transform: scale(1.07); opacity: 1; }
        }
        @keyframes loginFbDot {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }
        @keyframes loginSuccessRing {
          0%   { transform: scale(0.8); opacity: 0; }
          50%  { transform: scale(1.15); opacity: 0.8; }
          100% { transform: scale(1.5);  opacity: 0; }
        }
        .login-input:focus { border-color: rgba(255,87,34,0.5) !important; box-shadow: 0 0 0 3px rgba(255,87,34,0.12) !important; }
        .login-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 12px 40px rgba(255,87,34,0.45) !important; }
        .login-btn:not(:disabled):active { transform: translateY(1px) scale(0.98); }
      `}</style>

      {/* Arka plan gradyanı */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(-45deg, #060c1a, #0d1829, #111826, #08122a, #0d081e, #060c1a)',
        backgroundSize: '400% 400%',
        animation: 'gradientShift 22s ease infinite',
      }} />

      {/* Orb'lar */}
      <div style={{ position: 'absolute', top: '12%', left: '18%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,87,34,0.07) 0%, transparent 65%)', animation: 'loginOrbFloat 32s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '8%', right: '12%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)', animation: 'loginOrbFloat 26s ease-in-out infinite reverse', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '45%', left: '62%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 65%)', animation: 'loginPulse 9s ease-in-out infinite', pointerEvents: 'none' }} />

      {/* Parçacıklar */}
      {PARTICLES.map((p, i) => <Particle key={i} p={p} />)}

      {/* Üst başlık */}
      <div style={{ position: 'absolute', top: 28, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
        Solhan Ticaret Yönetim Sistemi
      </div>

      {/* Saat */}
      <div style={{ position: 'absolute', top: 24, right: 36, color: 'rgba(255,255,255,0.18)', fontSize: '0.9rem', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
        {time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      {/* Firebase durum çubuğu */}
      <div style={{ position: 'absolute', top: 24, left: 36, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          color: fbColors[fbStatus], fontSize: '0.75rem',
          animation: fbStatus === 'connecting' ? 'loginFbDot 1.2s ease-in-out infinite' : 'none',
        }}>{fbDots[fbStatus]}</span>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', fontWeight: 500 }}>Firebase</span>
      </div>

      {/* Kart */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 440, padding: '0 20px',
        animation: success
          ? 'loginFadeOut 0.9s ease forwards'
          : shake
            ? 'loginShakeX 0.5s ease'
            : 'loginSlideUp 0.7s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* Başarı halkası */}
        {success && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20,
          }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', border: '3px solid #10b981', animation: 'loginSuccessRing 0.8s ease forwards' }} />
          </div>
        )}

        <div style={{
          background: 'rgba(255,255,255,0.028)',
          backdropFilter: 'blur(50px)',
          WebkitBackdropFilter: 'blur(50px)',
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,0.07)',
          padding: mode === 'change-password' ? '40px 34px 34px' : '48px 36px 40px',
          animation: 'loginGlowPulse 5s ease-in-out infinite',
        }}>
          {/* Logo + başlık */}
          <div style={{ textAlign: 'center', marginBottom: mode === 'change-password' ? 28 : 36 }}>
            <div style={{
              width: 80, height: 80, margin: '0 auto 18px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff5722 0%, #ff8c42 60%, #ff9800 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem',
              boxShadow: '0 8px 40px rgba(255,87,34,0.45), 0 0 0 8px rgba(255,87,34,0.06)',
              animation: 'loginPulse 3.5s ease-in-out infinite',
            }}>
              {success ? '✅' : mode === 'change-password' ? '🔐' : '🔥'}
            </div>
            <h1 style={{
              fontSize: '1.65rem', fontWeight: 900,
              background: 'linear-gradient(135deg, #ff5722 0%, #ff8c42 50%, #ffb74d 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 6,
              animation: 'loginTextGlow 3.5s ease-in-out infinite',
              letterSpacing: '-0.02em',
            }}>
              {mode === 'change-password' ? 'Parola Değiştir' : 'Solhan'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', fontWeight: 400 }}>
              {mode === 'change-password'
                ? 'Mevcut ve yeni parolayı girin'
                : fbStatus === 'connecting'
                  ? 'Bağlanılıyor…'
                  : fbStatus === 'error'
                    ? statusMsg
                    : 'Güvenli giriş yapın'}
            </p>
          </div>

          {/* Firebase bağlantı durumu animasyonu */}
          {fbStatus === 'connecting' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#f59e0b',
                    animation: `loginFbDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {fbStatus === 'error' && (
            <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, fontSize: '1rem' }}>⚠️</span>
              <div>
                <div style={{ color: '#f87171', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Bağlantı Hatası</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', lineHeight: 1.5 }}>Firebase\'e erişilemiyor. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</div>
              </div>
            </div>
          )}

          {/* Form alanları */}
          {(fbStatus === 'connected') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Mevcut / ana parola */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)', fontSize: '1rem', pointerEvents: 'none' }}>🔒</span>
                <input
                  ref={inputRef}
                  className="login-input"
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => { setPass(e.target.value); setError(''); }}
                  onKeyDown={handleKey}
                  placeholder={mode === 'change-password' ? 'Mevcut parola' : 'Parola'}
                  autoComplete="current-password"
                  style={{
                    width: '100%', padding: '15px 48px 15px 46px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${error ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 14, color: '#f1f5f9', fontSize: '1rem',
                    boxSizing: 'border-box', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                />
                <button onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '1rem', padding: '4px', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Parola değiştirme alanları */}
              {mode === 'change-password' && (
                <>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)', fontSize: '1rem', pointerEvents: 'none' }}>🔑</span>
                    <input
                      className="login-input"
                      type={showPass ? 'text' : 'password'}
                      value={newPass}
                      onChange={e => { setNewPass(e.target.value); setError(''); }}
                      onKeyDown={handleKey}
                      placeholder="Yeni parola (min 6 karakter)"
                      autoComplete="new-password"
                      style={{ width: '100%', padding: '15px 16px 15px 46px', background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${error ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, color: '#f1f5f9', fontSize: '1rem', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)', fontSize: '1rem', pointerEvents: 'none' }}>🔐</span>
                    <input
                      className="login-input"
                      type={showPass ? 'text' : 'password'}
                      value={newPass2}
                      onChange={e => { setNewPass2(e.target.value); setError(''); }}
                      onKeyDown={handleKey}
                      placeholder="Yeni parolayı tekrar girin"
                      autoComplete="new-password"
                      style={{ width: '100%', padding: '15px 16px 15px 46px', background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${error ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, color: '#f1f5f9', fontSize: '1rem', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
                    />
                  </div>
                </>
              )}

              {/* Hata mesajı */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: '0.82rem', fontWeight: 500, padding: '9px 13px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              {/* Beni hatırla (sadece login modunda) */}
              {mode === 'login' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ff5722', cursor: 'pointer' }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.84rem' }}>
                    Beni hatırla <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.74rem' }}>(30 gün)</span>
                  </span>
                </label>
              )}

              {/* Ana buton */}
              <button
                className="login-btn"
                onClick={mode === 'login' ? handleLogin : handleChangePassword}
                disabled={loading || fbStatus !== 'connected'}
                style={{
                  width: '100%', padding: '16px 0',
                  background: loading
                    ? 'rgba(255,87,34,0.35)'
                    : 'linear-gradient(135deg, #ff5722 0%, #ff6d3a 45%, #ff9800 100%)',
                  border: 'none', borderRadius: 14,
                  color: '#fff', fontSize: '1rem', fontWeight: 800,
                  cursor: loading ? 'wait' : 'pointer',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 6px 28px rgba(255,87,34,0.3)',
                  transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Doğrulanıyor…
                    </span>
                  : mode === 'login'
                    ? '🚀 Giriş Yap'
                    : '🔐 Parolayı Güncelle'
                }
              </button>

              {/* Alt linkler */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 4 }}>
                {mode === 'login' ? (
                  <button
                    onClick={() => { setMode('change-password'); setPass(''); setError(''); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                  >
                    Parolayı değiştir
                  </button>
                ) : (
                  <button
                    onClick={() => { setMode('login'); setPass(''); setNewPass(''); setNewPass2(''); setError(''); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                  >
                    ← Geri dön
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Firebase bağlantı hatası — yeniden dene butonu */}
          {fbStatus === 'error' && (
            <button
              onClick={loadHash}
              style={{ width: '100%', padding: '14px 0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#94a3b8', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              🔄 Yeniden Bağlan
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, color: 'rgba(255,255,255,0.08)', fontSize: '0.7rem', fontWeight: 400 }}>
          Solhan Ticaret &copy; {new Date().getFullYear()} &middot; Tüm veriler şifrelenmiş Firebase'de saklanır
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
