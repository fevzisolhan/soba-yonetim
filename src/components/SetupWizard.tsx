import { useState } from 'react';
import { hashPass } from './LoginScreen';
import { genId } from '@/lib/utils-tr';

const SETUP_DONE_KEY = 'sobaYonetim_setupDone';
const PASS_KEY = 'sobaYonetim_appPass';

export function isSetupDone(): boolean {
  return !!localStorage.getItem(SETUP_DONE_KEY);
}

export function getSetupData(): { companyName: string; kasalar: { id: string; name: string; icon: string }[] } | null {
  try {
    const raw = localStorage.getItem('sobaYonetim_setupData');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

interface SetupData {
  companyName: string;
  city: string;
  pass: string;
  pass2: string;
  kasalar: { name: string; icon: string; enabled: boolean }[];
}

const DEFAULT_KASALAR = [
  { name: 'Nakit', icon: '💵', enabled: true },
  { name: 'Banka', icon: '🏦', enabled: true },
  { name: 'Pos/Kart', icon: '💳', enabled: false },
];

interface Props {
  onComplete: (data: { companyName: string; kasalar: { id: string; name: string; icon: string }[] }) => void;
}

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SetupData>({
    companyName: '',
    city: '',
    pass: '',
    pass2: '',
    kasalar: DEFAULT_KASALAR.map(k => ({ ...k })),
  });

  const steps = [
    { title: 'Hoş Geldiniz', icon: '🔥' },
    { title: 'İşletme Bilgileri', icon: '🏪' },
    { title: 'Kasa Tanımları', icon: '💰' },
    { title: 'Güvenlik', icon: '🔒' },
  ];

  const next = () => { setError(''); setStep(s => s + 1); };
  const prev = () => { setError(''); setStep(s => s - 1); };

  const validateStep = () => {
    if (step === 1) {
      if (!data.companyName.trim()) { setError('İşletme adı gerekli!'); return false; }
    }
    if (step === 2) {
      if (!data.kasalar.some(k => k.enabled)) { setError('En az bir kasa seçin!'); return false; }
    }
    if (step === 3) {
      if (data.pass.length < 4) { setError('Parola en az 4 karakter olmalı!'); return false; }
      if (data.pass !== data.pass2) { setError('Parolalar eşleşmiyor!'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < steps.length - 1) { next(); return; }
    handleFinish();
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const hashed = await hashPass(data.pass);
      localStorage.setItem(PASS_KEY, hashed);
      const kasalar = data.kasalar
        .filter(k => k.enabled)
        .map(k => ({ id: genId(), name: k.name, icon: k.icon }));
      const setupData = { companyName: data.companyName.trim(), kasalar };
      localStorage.setItem('sobaYonetim_setupData', JSON.stringify(setupData));
      localStorage.setItem(SETUP_DONE_KEY, '1');
      onComplete(setupData);
    } catch {
      setError('Bir hata oluştu, tekrar deneyin.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #040810 0%, #0a1628 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: 16,
    }}>
      {/* Progress */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <div style={{ height: 3, background: '#1e293b' }}>
          <div style={{
            height: '100%',
            width: `${((step) / (steps.length - 1)) * 100}%`,
            background: 'linear-gradient(90deg, #ff5722, #ff9800)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 460,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(40px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '40px 32px 36px',
        boxShadow: '0 30px 100px rgba(0,0,0,0.6)',
      }}>
        {/* Adım göstergesi */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              width: i === step ? 28 : 8, height: 8,
              borderRadius: 4,
              background: i <= step ? '#ff5722' : 'rgba(255,255,255,0.1)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff5722, #ff9800)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem',
            boxShadow: '0 8px 24px rgba(255,87,34,0.35)',
          }}>
            {steps[step].icon}
          </div>
          <h2 style={{
            fontSize: '1.4rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #ff5722, #ff9800)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 4,
          }}>
            {steps[step].title}
          </h2>
        </div>

        {/* İçerik */}
        <div style={{ minHeight: 200 }}>
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepCompany data={data} setData={setData} />}
          {step === 2 && <StepKasa data={data} setData={setData} />}
          {step === 3 && <StepPassword data={data} setData={setData} />}
        </div>

        {/* Hata */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            color: '#ef4444', fontSize: '0.85rem', fontWeight: 600,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Butonlar */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {step > 0 && (
            <button onClick={prev} style={{
              padding: '12px 20px', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, background: 'transparent', color: '#64748b',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
            }}>
              ← Geri
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            style={{
              flex: 1, padding: '13px 0',
              background: loading ? '#334155' : 'linear-gradient(135deg, #ff5722, #ff9800)',
              border: 'none', borderRadius: 12, color: '#fff',
              fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(255,87,34,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Kaydediliyor...' : step === steps.length - 1 ? '✅ Kurulumu Tamamla' : 'Devam Et →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepWelcome() {
  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: 24 }}>
        <strong style={{ color: '#ff7043' }}>SOLHAN</strong> işletme yönetim sistemine hoş geldiniz.
        Bu kısa kurulum sihirbazıyla sistemi işletmenize göre yapılandıracağız.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {[
          ['🏪', 'İşletme bilgilerinizi girin'],
          ['💰', 'Kasa hesaplarını tanımlayın'],
          ['🔒', 'Giriş parolası belirleyin'],
        ].map(([icon, text]) => (
          <div key={text} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.03)', borderRadius: 10,
            padding: '12px 16px', border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontSize: '1.3rem' }}>{icon}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem' }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepCompany({ data, setData }: { data: SetupData; setData: React.Dispatch<React.SetStateAction<SetupData>> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={lbl}>İşletme / Firma Adı *</label>
        <input
          value={data.companyName}
          onChange={e => setData(d => ({ ...d, companyName: e.target.value }))}
          placeholder="örn: Solhan Isıtma Sistemleri"
          style={inp}
          autoFocus
        />
      </div>
      <div>
        <label style={lbl}>Şehir / İlçe <span style={{ color: '#475569' }}>(isteğe bağlı)</span></label>
        <input
          value={data.city}
          onChange={e => setData(d => ({ ...d, city: e.target.value }))}
          placeholder="örn: Şanlıurfa / Siverek"
          style={inp}
        />
      </div>
    </div>
  );
}

function StepKasa({ data, setData }: { data: SetupData; setData: React.Dispatch<React.SetStateAction<SetupData>> }) {
  const toggle = (i: number) => {
    setData(d => {
      const kasalar = [...d.kasalar];
      kasalar[i] = { ...kasalar[i], enabled: !kasalar[i].enabled };
      return { ...d, kasalar };
    });
  };
  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.83rem', marginBottom: 16 }}>
        Kullanacağınız kasa/hesap türlerini seçin. Sonradan değiştirebilirsiniz.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.kasalar.map((k, i) => (
          <div
            key={k.name}
            onClick={() => toggle(i)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${k.enabled ? 'rgba(255,87,34,0.4)' : 'rgba(255,255,255,0.07)'}`,
              background: k.enabled ? 'rgba(255,87,34,0.08)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.4rem' }}>{k.icon}</span>
              <span style={{ color: k.enabled ? '#f1f5f9' : '#64748b', fontWeight: 600 }}>{k.name}</span>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: k.enabled ? '#ff5722' : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', transition: 'all 0.2s',
            }}>
              {k.enabled ? '✓' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPassword({ data, setData }: { data: SetupData; setData: React.Dispatch<React.SetStateAction<SetupData>> }) {
  const [showPass, setShowPass] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.83rem', margin: 0 }}>
        Uygulamaya giriş için bir parola belirleyin. En az 4 karakter olmalı.
      </p>
      <div style={{ position: 'relative' }}>
        <label style={lbl}>Parola *</label>
        <input
          type={showPass ? 'text' : 'password'}
          value={data.pass}
          onChange={e => setData(d => ({ ...d, pass: e.target.value }))}
          placeholder="Min. 4 karakter"
          style={inp}
          autoFocus
        />
      </div>
      <div>
        <label style={lbl}>Parola Tekrar *</label>
        <input
          type={showPass ? 'text' : 'password'}
          value={data.pass2}
          onChange={e => setData(d => ({ ...d, pass2: e.target.value }))}
          placeholder="Aynı parolayı tekrar girin"
          style={inp}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#64748b', fontSize: '0.82rem' }}>
        <input type="checkbox" checked={showPass} onChange={e => setShowPass(e.target.checked)} />
        Parolayı göster
      </label>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 6, color: '#64748b', fontSize: '0.82rem', fontWeight: 600 };
const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, color: '#f1f5f9', fontSize: '0.92rem',
  boxSizing: 'border-box', outline: 'none',
};
