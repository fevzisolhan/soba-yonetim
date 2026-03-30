import { useState, useEffect, useRef, useMemo } from 'react';

export type LoginTheme = 'ates' | 'cam' | 'buz' | 'minimal';
export const LOGIN_THEME_KEY = 'loginTheme';
export function getLoginTheme(): LoginTheme {
  return (localStorage.getItem(LOGIN_THEME_KEY) as LoginTheme) || 'ates';
}

const PASS_KEY = 'sobaYonetim_appPass';
const SESSION_KEY = 'sobaYonetim_session';

function getStoredHash(): string | null {
  return localStorage.getItem(PASS_KEY);
}

async function hashPass(pass: string): Promise<string> {
  const enc = new TextEncoder().encode(pass + 'solhan_soba_2026');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isSessionValid(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return Date.now() - ts < 8 * 60 * 60 * 1000;
  } catch { return false; }
}

function setSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }));
}

export function useAuth() {
  const [authed, setAuthed] = useState(() => {
    const hasPass = !!getStoredHash();
    if (!hasPass) return false;
    return isSessionValid();
  });

  const login = () => { setSession(); setAuthed(true); };
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); };
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

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>(getStoredHash() ? 'login' : 'setup');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState(new Date());
  const [theme, setTheme] = useState<LoginTheme>(getLoginTheme);

  // Tema değişince kaydet
  const cycleTheme = () => {
    const themes: LoginTheme[] = ['ates', 'cam', 'buz', 'minimal'];
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
    localStorage.setItem(LOGIN_THEME_KEY, next);
  };

  const themeConfig = useMemo(() => THEMES[theme], [theme]);

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
      setTimeout(() => onLogin(), 800);
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
    setTimeout(() => onLogin(), 800);
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      mode === 'login' ? handleLogin() : handleSetup();
    }
  };

  const particles = Array.from({ length: 50 }, (_, i) => <Particle key={i} index={i} />);
  const tc = themeConfig;

  // Ortak form elemanları — tüm temalar bu JSX'i paylaşır, sadece stil değişir
  const formJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Parola */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: tc.iconColor, fontSize: '1rem', pointerEvents: 'none' }}>🔒</span>
        <input ref={inputRef} type={showPass ? 'text' : 'password'} value={pass}
          onChange={e => { setPass(e.target.value); setError(''); }} onKeyDown={handleKey}
          placeholder={mode === 'login' ? 'Parola' : 'Yeni parola (min 4 karakter)'} autoComplete="off"
          style={{ width: '100%', padding: '14px 46px 14px 44px', background: tc.inputBg, border: `1.5px solid ${error ? 'rgba(239,68,68,0.6)' : tc.inputBorder}`, borderRadius: tc.radius, color: tc.textColor, fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={e => e.currentTarget.style.borderColor = tc.accent}
          onBlur={e => e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.6)' : tc.inputBorder} />
        <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: tc.iconColor, cursor: 'pointer', fontSize: '0.9rem', padding: 4 }}>
          {showPass ? '🙈' : '👁️'}
        </button>
      </div>
      {/* Parola tekrar (setup) */}
      {mode === 'setup' && (
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: tc.iconColor, fontSize: '1rem', pointerEvents: 'none' }}>🔐</span>
          <input type={showPass ? 'text' : 'password'} value={pass2}
            onChange={e => { setPass2(e.target.value); setError(''); }} onKeyDown={handleKey}
            placeholder="Parolayı tekrar girin" autoComplete="off"
            style={{ width: '100%', padding: '14px 14px 14px 44px', background: tc.inputBg, border: `1.5px solid ${error ? 'rgba(239,68,68,0.6)' : tc.inputBorder}`, borderRadius: tc.radius, color: tc.textColor, fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={e => e.currentTarget.style.borderColor = tc.accent}
            onBlur={e => e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.6)' : tc.inputBorder} />
        </div>
      )}
      {/* Hata */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: '0.8rem', fontWeight: 500, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)' }}>
          <span>⚠️</span> {error}
        </div>
      )}
      {/* Giriş butonu */}
      <button onClick={mode === 'login' ? handleLogin : handleSetup} disabled={loading}
        style={{ width: '100%', padding: '14px 0', background: loading ? tc.btnDisabled : tc.btnBg, border: tc.btnBorder || 'none', borderRadius: tc.radius, color: tc.btnText, fontSize: '1rem', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', boxShadow: tc.btnShadow, transition: 'all 0.2s', letterSpacing: '0.01em' }}>
        {loading ? '⏳ Kontrol ediliyor...' : mode === 'login' ? tc.btnLabel : '✅ Parolayı Kaydet'}
      </button>
      {/* Şifremi unuttum */}
      {mode === 'login' && (
        <div style={{ textAlign: 'center' }}>
          <button onClick={() => { const a = prompt('"SIFIRLA" yazın:'); if (a === 'SIFIRLA') { localStorage.removeItem(PASS_KEY); sessionStorage.removeItem(SESSION_KEY); setMode('setup'); setPass(''); setError(''); } }}
            style={{ background: 'none', border: 'none', color: tc.forgotColor, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            Parolayı unuttum
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: "'Inter',-apple-system,sans-serif", background: tc.pageBg }}>
      <style>{BASE_KEYFRAMES + tc.extraKeyframes}</style>

      {/* Arka plan katmanı */}
      {tc.bgLayer}

      {/* Partiküller (sadece ates temasında) */}
      {theme === 'ates' && particles}

      {/* Saat */}
      <div style={{ position: 'absolute', top: 20, right: 28, color: tc.clockColor, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', zIndex: 2 }}>
        {time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
      </div>

      {/* Tema değiştirici */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 10 }}>
        {(['ates', 'cam', 'buz', 'minimal'] as LoginTheme[]).map(t => (
          <button key={t} onClick={() => { setTheme(t); localStorage.setItem(LOGIN_THEME_KEY, t); }}
            title={THEMES[t].name}
            style={{ width: 28, height: 28, borderRadius: '50%', border: theme === t ? `2px solid ${THEMES[t].accent}` : '2px solid rgba(255,255,255,0.15)', background: THEMES[t].dotColor, cursor: 'pointer', transition: 'all 0.2s', transform: theme === t ? 'scale(1.25)' : 'scale(1)' }} />
        ))}
        <span style={{ color: tc.clockColor, fontSize: '0.7rem', alignSelf: 'center', marginLeft: 4 }}>{tc.name}</span>
      </div>

      {/* Kart */}
      <div style={{ position: 'relative', zIndex: 10, animation: success ? 'fadeOut 0.8s ease forwards' : shake ? 'shakeX 0.5s ease, slideUp 0.8s ease' : 'slideUp 0.8s ease', width: '100%', maxWidth: tc.cardWidth, padding: '0 20px' }}>
        <div style={{ background: tc.cardBg, backdropFilter: tc.blur, WebkitBackdropFilter: tc.blur, borderRadius: tc.cardRadius, border: tc.cardBorder, padding: '44px 36px 36px', boxShadow: tc.cardShadow }}>

          {/* Logo & başlık */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 72, height: 72, margin: '0 auto 16px', borderRadius: tc.logoRadius, background: tc.logoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', boxShadow: tc.logoShadow }}>
              {tc.logoIcon}
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 6px', color: tc.titleColor, letterSpacing: '-0.02em', ...(tc.titleGradient ? { background: tc.titleGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}) }}>
              Solhan
            </h1>
            <p style={{ color: tc.subtitleColor, fontSize: '0.8rem', margin: 0 }}>
              {mode === 'login' ? 'Hesabınıza giriş yapın' : 'Giriş parolası oluşturun'}
            </p>
          </div>

          {formJSX}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, color: tc.footerColor, fontSize: '0.7rem' }}>
          Solhan Ticaret © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

// ─── Animasyonlar ─────────────────────────────────────────────────────────────
const BASE_KEYFRAMES = `
  @keyframes floatUp { 0%{transform:translateY(0) scale(0);opacity:0} 10%{opacity:0.3;transform:translateY(-10vh) scale(1)} 90%{opacity:0.3} 100%{transform:translateY(-110vh) scale(0.5);opacity:0} }
  @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes pulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.05)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(40px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes shakeX { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-12px)} 40%{transform:translateX(12px)} 60%{transform:translateX(-8px)} 80%{transform:translateX(8px)} }
  @keyframes fadeOut { to{opacity:0;transform:scale(1.1);filter:blur(10px)} }
  @keyframes orbFloat { 0%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(30px,-40px) rotate(120deg)} 66%{transform:translate(-20px,20px) rotate(240deg)} 100%{transform:translate(0,0) rotate(360deg)} }
  @keyframes scanLine { 0%{top:-5%} 100%{top:105%} }
  @keyframes iceShimmer { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
  @keyframes gridPulse { 0%,100%{opacity:0.03} 50%{opacity:0.07} }
`;

// ─── Tema Tanımları ───────────────────────────────────────────────────────────
interface ThemeConfig {
  name: string; dotColor: string; accent: string; pageBg: string;
  bgLayer: React.ReactNode; extraKeyframes: string;
  cardBg: string; blur: string; cardRadius: string | number; cardBorder: string;
  cardShadow: string; cardWidth: number;
  logoRadius: string | number; logoBg: string; logoShadow: string; logoIcon: string;
  titleColor: string; titleGradient?: string; subtitleColor: string;
  inputBg: string; inputBorder: string; textColor: string; iconColor: string;
  radius: string | number;
  btnBg: string; btnDisabled: string; btnBorder?: string; btnText: string; btnShadow: string; btnLabel: string;
  forgotColor: string; clockColor: string; footerColor: string;
}

const THEMES: Record<LoginTheme, ThemeConfig> = {
  // ── 1. ATEŞ (Mevcut, turuncu-ateş) ─────────────────────────────────────────
  ates: {
    name: '🔥 Ateş', dotColor: '#ff5722', accent: 'rgba(255,87,34,0.6)',
    pageBg: '#040810',
    bgLayer: (
      <>
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(-45deg,#070e1c,#0d1b2e,#131a2e,#0a1628,#0f0a1e,#070e1c)',backgroundSize:'400% 400%',animation:'gradientShift 20s ease infinite' }} />
        <div style={{ position:'absolute',top:'15%',left:'20%',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(255,87,34,0.08),transparent 70%)',animation:'orbFloat 30s ease-in-out infinite',pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:'10%',right:'15%',width:300,height:300,borderRadius:'50%',background:'radial-gradient(circle,rgba(59,130,246,0.06),transparent 70%)',animation:'orbFloat 25s ease-in-out infinite reverse',pointerEvents:'none' }} />
      </>
    ),
    extraKeyframes: '',
    cardBg:'rgba(255,255,255,0.03)', blur:'blur(40px)', cardRadius:28, cardBorder:'1px solid rgba(255,255,255,0.06)', cardShadow:'0 30px 100px rgba(0,0,0,0.5)', cardWidth:420,
    logoRadius:'50%', logoBg:'linear-gradient(135deg,#ff5722,#ff9800)', logoShadow:'0 8px 32px rgba(255,87,34,0.4)', logoIcon:'🔥',
    titleColor:'', titleGradient:'linear-gradient(135deg,#ff5722,#ff9800,#ffb74d)', subtitleColor:'rgba(255,255,255,0.35)',
    inputBg:'rgba(255,255,255,0.04)', inputBorder:'rgba(255,255,255,0.08)', textColor:'#f1f5f9', iconColor:'rgba(255,255,255,0.25)', radius:16,
    btnBg:'linear-gradient(135deg,#ff5722,#ff7043,#ff9800)', btnDisabled:'rgba(255,87,34,0.4)', btnText:'#fff', btnShadow:'0 8px 30px rgba(255,87,34,0.3)', btnLabel:'🚀 Giriş Yap',
    forgotColor:'rgba(255,255,255,0.2)', clockColor:'rgba(255,255,255,0.2)', footerColor:'rgba(255,255,255,0.1)',
  },

  // ── 2. CAM (Devoryn-style glassmorphism, cyan) ──────────────────────────────
  cam: {
    name: '💠 Cam', dotColor: '#00bcd4', accent: 'rgba(0,188,212,0.8)',
    pageBg: '#0a1628',
    bgLayer: (
      <>
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(135deg,#050f1e 0%,#0a1a30 40%,#061525 100%)' }} />
        {/* Çerçeve */}
        <div style={{ position:'absolute',inset:'3%',borderRadius:28,border:'1px solid rgba(0,188,212,0.12)',boxShadow:'0 0 60px rgba(0,188,212,0.04)',pointerEvents:'none' }} />
        {/* Izgara */}
        <div style={{ position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,188,212,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,188,212,0.04) 1px,transparent 1px)',backgroundSize:'44px 44px',animation:'gridPulse 6s ease-in-out infinite',pointerEvents:'none' }} />
        {/* Tara çizgisi */}
        <div style={{ position:'absolute',left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,rgba(0,188,212,0.15),transparent)',animation:'scanLine 8s linear infinite',pointerEvents:'none' }} />
        <div style={{ position:'absolute',top:'20%',right:'10%',width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle,rgba(0,188,212,0.06),transparent 70%)',animation:'pulse 7s ease-in-out infinite',pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:'15%',left:'8%',width:140,height:140,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,102,241,0.06),transparent 70%)',animation:'pulse 9s ease-in-out infinite reverse',pointerEvents:'none' }} />
      </>
    ),
    extraKeyframes:'@keyframes scanLine{0%{top:-2%}100%{top:102%}} @keyframes gridPulse{0%,100%{opacity:0.4}50%{opacity:1}}',
    cardBg:'rgba(0,20,40,0.65)', blur:'blur(32px)', cardRadius:20, cardBorder:'1.5px solid rgba(0,188,212,0.35)', cardShadow:'0 0 40px rgba(0,188,212,0.12),0 24px 80px rgba(0,0,0,0.6)', cardWidth:440,
    logoRadius:16, logoBg:'linear-gradient(135deg,rgba(0,188,212,0.2),rgba(99,102,241,0.2))', logoShadow:'0 0 24px rgba(0,188,212,0.3)', logoIcon:'🏔️',
    titleColor:'#e0f7fa', subtitleColor:'rgba(178,235,242,0.5)',
    inputBg:'rgba(0,188,212,0.06)', inputBorder:'rgba(0,188,212,0.3)', textColor:'#e0f7fa', iconColor:'rgba(0,188,212,0.5)', radius:12,
    btnBg:'linear-gradient(90deg,rgba(0,150,170,0.9),rgba(0,188,212,0.9))', btnDisabled:'rgba(0,188,212,0.25)', btnBorder:'1px solid rgba(0,188,212,0.5)', btnText:'#e0f7fa', btnShadow:'0 0 20px rgba(0,188,212,0.3)', btnLabel:'Giriş Yap',
    forgotColor:'rgba(0,188,212,0.35)', clockColor:'rgba(0,188,212,0.4)', footerColor:'rgba(0,188,212,0.2)',
  },

  // ── 3. BUZ (Beyaz/gümüş glassmorphism) ──────────────────────────────────────
  buz: {
    name: '❄️ Buz', dotColor: '#90caf9', accent: 'rgba(144,202,249,0.7)',
    pageBg: '#f0f4f8',
    bgLayer: (
      <>
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(135deg,#e8f4f8 0%,#dde8f0 40%,#e4ecf5 100%)' }} />
        <div style={{ position:'absolute',top:'10%',left:'5%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(144,202,249,0.25),transparent 70%)',animation:'orbFloat 25s ease-in-out infinite',pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:'5%',right:'5%',width:350,height:350,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,179,237,0.18),transparent 70%)',animation:'orbFloat 30s ease-in-out infinite reverse',pointerEvents:'none' }} />
        <div style={{ position:'absolute',top:'40%',right:'25%',width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle,rgba(186,230,253,0.3),transparent 70%)',animation:'iceShimmer 5s ease-in-out infinite',pointerEvents:'none' }} />
      </>
    ),
    extraKeyframes:'@keyframes iceShimmer{0%,100%{opacity:0.5}50%{opacity:1}}',
    cardBg:'rgba(255,255,255,0.72)', blur:'blur(28px)', cardRadius:24, cardBorder:'1px solid rgba(144,202,249,0.5)', cardShadow:'0 20px 60px rgba(100,160,220,0.18),0 4px 24px rgba(100,160,220,0.12)', cardWidth:420,
    logoRadius:'50%', logoBg:'linear-gradient(135deg,#90caf9,#42a5f5)', logoShadow:'0 8px 24px rgba(66,165,245,0.3)', logoIcon:'❄️',
    titleColor:'#1565c0', subtitleColor:'rgba(21,101,192,0.5)',
    inputBg:'rgba(227,242,253,0.6)', inputBorder:'rgba(144,202,249,0.6)', textColor:'#1a3a5c', iconColor:'rgba(66,165,245,0.5)', radius:14,
    btnBg:'linear-gradient(135deg,#42a5f5,#1976d2)', btnDisabled:'rgba(66,165,245,0.35)', btnText:'#fff', btnShadow:'0 8px 24px rgba(25,118,210,0.3)', btnLabel:'Giriş Yap',
    forgotColor:'rgba(25,118,210,0.4)', clockColor:'rgba(21,101,192,0.4)', footerColor:'rgba(21,101,192,0.25)',
  },

  // ── 4. MİNİMAL (Siyah-beyaz, sade) ──────────────────────────────────────────
  minimal: {
    name: '⬛ Minimal', dotColor: '#94a3b8', accent: 'rgba(148,163,184,0.7)',
    pageBg: '#0c0c0c',
    bgLayer: (
      <div style={{ position:'absolute',inset:0,background:'#0c0c0c' }}>
        <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(255,255,255,0.02),transparent 70%)',pointerEvents:'none' }} />
      </div>
    ),
    extraKeyframes:'',
    cardBg:'rgba(20,20,20,0.96)', blur:'blur(0px)', cardRadius:12, cardBorder:'1px solid rgba(255,255,255,0.08)', cardShadow:'0 24px 64px rgba(0,0,0,0.8)', cardWidth:400,
    logoRadius:12, logoBg:'#1a1a1a', logoShadow:'none', logoIcon:'⬛',
    titleColor:'#f8fafc', subtitleColor:'rgba(255,255,255,0.3)',
    inputBg:'rgba(255,255,255,0.04)', inputBorder:'rgba(255,255,255,0.1)', textColor:'#f1f5f9', iconColor:'rgba(255,255,255,0.2)', radius:8,
    btnBg:'#f8fafc', btnDisabled:'rgba(248,250,252,0.3)', btnText:'#0c0c0c', btnShadow:'none', btnLabel:'Giriş Yap',
    forgotColor:'rgba(255,255,255,0.2)', clockColor:'rgba(255,255,255,0.15)', footerColor:'rgba(255,255,255,0.08)',
  },
};
