import { useState, useRef } from 'react';
import ExcelImport from '@/pages/ExcelImport';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useSoundFeedback } from '@/hooks/useSoundFeedback';
import type { SoundSettings, SoundTheme, SoundType } from '@/hooks/useSoundFeedback';
import { exportToExcel } from '@/lib/excelExport';
import type { DB } from '@/types';
import { formatDate } from '@/lib/utils-tr';
import { hashPass } from '@/components/LoginScreen';

// Firebase auth config (parola Settings'ten de değiştirilebilir)
const FIREBASE_PROJECT = 'pars-4850c';
const FIREBASE_API_KEY = 'AIzaSyBL2_YIVMPBwojAfK7pzd2Eg5AG1sUyfig';
const FIREBASE_AUTH_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/config/auth?key=${FIREBASE_API_KEY}`;

async function fetchCurrentHash(): Promise<string | null> {
  try {
    const res = await fetch(FIREBASE_AUTH_URL, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.fields?.hash?.stringValue ?? null;
  } catch { return null; }
}

async function updateHashInFirebase(hash: string): Promise<boolean> {
  try {
    const res = await fetch(FIREBASE_AUTH_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { hash: { stringValue: hash }, updatedAt: { stringValue: new Date().toISOString() } } }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch { return false; }
}

interface Props { db: DB; save: (fn: (prev: DB) => DB) => void; exportJSON: () => void; importJSON: (f: File) => Promise<boolean>; }

const TABS_LIST = [
  { id: 'company', icon: '🏢', label: 'Şirket' },
  { id: 'categories', icon: '🏷️', label: 'Kategoriler' },
  { id: 'pellet', icon: '🪵', label: 'Pelet' },
  { id: 'sound', icon: '🔊', label: 'Ses' },
  { id: 'backup', icon: '💾', label: 'Yedek & Geri Yükleme' },
  { id: 'excel_export', icon: '📊', label: 'Excel Çıktı' },
  { id: 'activity', icon: '📋', label: 'Aktivite' },
  { id: 'shortcuts', icon: '⌨️', label: 'Kısayollar' },
  { id: 'repair', icon: '🔧', label: 'Veri Onarım' },
  { id: 'excel', icon: '📥', label: 'Excel İçe Aktar' },
  { id: 'data', icon: '🗄️', label: 'Veri Yönetimi' },
  { id: 'security', icon: '🔐', label: 'Güvenlik' },
] as const;

type Tab = typeof TABS_LIST[number]['id'];

function loadSoundSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem('sobaYonetim');
    if (!raw) return { enabled: true, volume: 0.5, theme: 'standart' };
    const parsed = JSON.parse(raw);
    return { enabled: true, volume: 0.5, theme: 'standart', ...(parsed.soundSettings || {}) };
  } catch {
    return { enabled: true, volume: 0.5, theme: 'standart' };
  }
}

function saveSoundSettingsToStorage(settings: SoundSettings) {
  try {
    const raw = localStorage.getItem('sobaYonetim');
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.soundSettings = settings;
    localStorage.setItem('sobaYonetim', JSON.stringify(parsed));
  } catch {}
}

export default function Settings({ db, save, exportJSON, importJSON }: Props) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const { playSound } = useSoundFeedback();
  const [company, setCompany] = useState({ ...db.company });
  const [pellet, setPellet] = useState({ ...db.pelletSettings });
  const [tab, setTab] = useState<Tab>('company');

  const saveCompany = () => {
    save(prev => ({ ...prev, company: { ...company, id: prev.company.id, createdAt: prev.company.createdAt } }));
    showToast('Şirket bilgileri kaydedildi!', 'success');
  };

  const savePellet = () => {
    save(prev => ({ ...prev, pelletSettings: { ...pellet } }));
    showToast('Pelet ayarları kaydedildi!', 'success');
  };

  const clearData = () => {
    showConfirm('Tüm Verileri Sil', 'TÜM verileriniz kalıcı olarak silinecek! Bu işlem geri alınamaz. Emin misiniz?', () => {
      localStorage.removeItem('sobaYonetim');
      window.location.reload();
    }, true);
  };

  const dataStats = [
    { label: 'Ürünler', count: db.products.length, icon: '📦' },
    { label: 'Satışlar', count: db.sales.length, icon: '🛒' },
    { label: 'Tedarikçiler', count: db.suppliers.length, icon: '🏭' },
    { label: 'Cari Hesaplar', count: db.cari.length, icon: '👤' },
    { label: 'Kasa İşlemleri', count: db.kasa.length, icon: '💰' },
    { label: 'Banka İşlemleri', count: db.bankTransactions.length, icon: '🏦' },
    { label: 'Pelet Tedarikçi', count: db.peletSuppliers.length, icon: '🪵' },
    { label: 'Boru Tedarikçi', count: db.boruSuppliers.length, icon: '🔩' },
  ];

  const totalRecords = dataStats.reduce((s, d) => s + d.count, 0);

  const shortcuts = [
    { key: 'Ctrl + 1', desc: 'Özet (Dashboard)' },
    { key: 'Ctrl + 2', desc: 'Ürünler' },
    { key: 'Ctrl + 3', desc: 'Satış' },
    { key: 'Ctrl + 4', desc: 'Kasa' },
    { key: 'Ctrl + 5', desc: 'Raporlar' },
    { key: '+ Butonu', desc: 'Hızlı Eylem Menüsü (sağ alt)' },
    { key: 'Ctrl + Z', desc: 'Geri Al (tarayıcı düzeyi)' },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 6, width: 'fit-content' }}>
        {TABS_LIST.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: tab === t.id ? 'linear-gradient(135deg, #ff5722, #ff7043)' : 'transparent', color: tab === t.id ? '#fff' : '#64748b', boxShadow: tab === t.id ? '0 4px 12px rgba(255,87,34,0.3)' : 'none', transition: 'all 0.15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <Card title="🏢 Şirket Bilgileri">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FV label="Şirket Adı" value={company.name || ''} onChange={v => setCompany(c => ({ ...c, name: v }))} />
              <FV label="Vergi No" value={company.taxNo || ''} onChange={v => setCompany(c => ({ ...c, taxNo: v }))} />
              <FV label="Telefon" value={company.phone || ''} onChange={v => setCompany(c => ({ ...c, phone: v }))} />
              <FV label="E-posta" type="email" value={company.email || ''} onChange={v => setCompany(c => ({ ...c, email: v }))} />
            </div>
            <div><label style={lbl}>Adres</label><textarea value={company.address || ''} onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} style={{ ...inp, minHeight: 70 }} /></div>
            <button onClick={saveCompany} style={btnPrimary}>💾 Şirket Bilgilerini Kaydet</button>
          </div>
        </Card>
      )}

      {tab === 'pellet' && (
        <Card title="🪵 Pelet Ayarları">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FV label="Gramaj (gr/torba)" type="number" value={String(pellet.gramaj)} onChange={v => setPellet(p => ({ ...p, gramaj: parseFloat(v) || 0 }))} />
            <FV label="Kg Fiyatı (₺)" type="number" value={String(pellet.kgFiyat)} onChange={v => setPellet(p => ({ ...p, kgFiyat: parseFloat(v) || 0 }))} />
            <FV label="Çuval Kg" type="number" value={String(pellet.cuvalKg)} onChange={v => setPellet(p => ({ ...p, cuvalKg: parseFloat(v) || 0 }))} />
            <FV label="Kritik Gün Sayısı" type="number" value={String(pellet.critDays)} onChange={v => setPellet(p => ({ ...p, critDays: parseInt(v) || 0 }))} />
          </div>
          <div style={{ marginTop: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
            💡 Mevcut değerler: {pellet.cuvalKg}kg çuval · ₺{pellet.kgFiyat}/kg · {pellet.gramaj}gr/torba
          </div>
          <button onClick={savePellet} style={{ ...btnPrimary, marginTop: 16 }}>💾 Pelet Ayarlarını Kaydet</button>
        </Card>
      )}

      {tab === 'sound' && (
        <SoundSettings playSound={playSound} />
      )}

      {tab === 'backup' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Card title="📤 Yedek Al">
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.6 }}>Tüm verilerinizi <strong style={{ color: '#f59e0b' }}>JSON formatında</strong> dışa aktarın.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {dataStats.slice(0, 4).map(d => (
                <div key={d.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{d.icon}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>{d.count}</div>
                  <div style={{ color: '#334155', fontSize: '0.72rem' }}>{d.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
              Toplam {totalRecords} kayıt yedeklenecek
            </div>
            <button onClick={exportJSON} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              Yedeği İndir (.json)
            </button>
          </Card>

          <SelectiveRestore showToast={showToast} showConfirm={showConfirm as (t: string, m: string, ok: () => void, d?: boolean) => void} />

          <SmartImportManager db={db} save={save} showToast={showToast} showConfirm={showConfirm as (t: string, m: string, ok: () => void, d?: boolean) => void} />
        </div>
      )}

      {tab === 'excel_export' && (
        <ExcelExportPanel db={db} />
      )}

      {tab === 'activity' && (
        <ActivityPanel db={db} save={save} showToast={showToast} showConfirm={showConfirm as (t: string, m: string, ok: () => void, d?: boolean) => void} />
      )}

      {tab === 'shortcuts' && (
        <Card title="⌨️ Klavye Kısayolları">
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 16 }}>Uygulamayı daha hızlı kullanmak için aşağıdaki kısayolları kullanabilirsiniz.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {shortcuts.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '4px 10px', fontSize: '0.82rem', fontFamily: 'monospace', color: '#f59e0b', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>{s.key}</kbd>
                <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'repair' && (
        <VeriOnarim db={db} save={save} showToast={showToast} showConfirm={showConfirm as (title: string, msg: string, onOk: () => void, danger?: boolean) => void} />
      )}

      {tab === 'excel' && (
        <ExcelImport db={db} save={save} />
      )}

      {tab === 'categories' && (
        <KategoriYonetim db={db} save={save} />
      )}

      {tab === 'data' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Card title="🗄️ Veri İstatistikleri">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {dataStats.map(d => (
                <div key={d.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{d.icon}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: d.count > 0 ? '#f1f5f9' : '#334155' }}>{d.count}</div>
                  <div style={{ color: '#334155', fontSize: '0.72rem', marginTop: 2 }}>{d.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>
              Toplam <strong style={{ color: '#f1f5f9' }}>{totalRecords}</strong> kayıt · localStorage'da saklanıyor
            </div>
          </Card>

          <Card title="🗑️ Tehlikeli Alan">
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.6 }}>Aşağıdaki işlemler <strong style={{ color: '#ef4444' }}>geri alınamaz</strong>. Önce yedek almanızı şiddetle tavsiye ederiz.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <DangerAction label="Satış Geçmişini Temizle" desc={`${db.sales.length} satış kaydı silinecek`} onConfirm={() => { save(prev => ({ ...prev, sales: [] })); showToast('Satış geçmişi temizlendi!'); }} />
              <DangerAction label="Kasa İşlemlerini Temizle" desc={`${db.kasa.length} kasa kaydı silinecek`} onConfirm={() => { save(prev => ({ ...prev, kasa: [] })); showToast('Kasa temizlendi!'); }} />
              <DangerAction label="Aktivite Günlüğünü Temizle" desc={`${db._activityLog.length} kayıt silinecek`} onConfirm={() => { save(prev => ({ ...prev, _activityLog: [] })); showToast('Aktivite günlüğü temizlendi!'); }} />
              <button onClick={clearData} style={{ width: '100%', padding: '14px 0', background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(239,68,68,0.08))', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>
                ☠️ TÜM VERİLERİ SİL ve Sıfırla
              </button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'security' && (
        <SecurityPanel showToast={showToast} />
      )}
    </div>
  );
}

function SecurityPanel({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChange = async () => {
    if (!oldPass) { showToast('Mevcut parolayı girin!', 'error'); return; }
    if (newPass.length < 6) { showToast('Yeni parola en az 6 karakter olmalı!', 'error'); return; }
    if (newPass !== newPass2) { showToast('Yeni parolalar eşleşmiyor!', 'error'); return; }

    setLoading(true);
    const currentFirebaseHash = await fetchCurrentHash();
    if (!currentFirebaseHash) {
      showToast('Firebase bağlantısı kurulamadı!', 'error');
      setLoading(false);
      return;
    }
    const oldHash = await hashPass(oldPass);
    if (oldHash !== currentFirebaseHash) {
      showToast('Mevcut parola yanlış!', 'error');
      setLoading(false);
      setOldPass('');
      return;
    }

    const newHash = await hashPass(newPass);
    const saved = await updateHashInFirebase(newHash);
    if (saved) {
      // Oturum cache'ini güncelle
      try { sessionStorage.setItem('sobaYonetim_hc', newHash); } catch { /* ignore */ }
      setOldPass(''); setNewPass(''); setNewPass2('');
      showToast('Parola başarıyla Firebase\'e kaydedildi!', 'success');
    } else {
      showToast('Firebase kayıt hatası — internet bağlantınızı kontrol edin!', 'error');
    }
    setLoading(false);
  };

  return (
    <Card title="🔐 Parola Değiştir">
      <div style={{ display: 'grid', gap: 14, maxWidth: 380 }}>
        <div>
          <label style={lbl}>Mevcut Parola</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showOld ? 'text' : 'password'}
              value={oldPass}
              onChange={e => setOldPass(e.target.value)}
              placeholder="Mevcut parolanız"
              style={{ ...inp, paddingRight: 44 }}
            />
            <button onClick={() => setShowOld(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.9rem' }}>
              {showOld ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label style={lbl}>Yeni Parola</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="En az 4 karakter"
              style={{ ...inp, paddingRight: 44 }}
            />
            <button onClick={() => setShowNew(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.9rem' }}>
              {showNew ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label style={lbl}>Yeni Parola (Tekrar)</label>
          <input
            type={showNew ? 'text' : 'password'}
            value={newPass2}
            onChange={e => setNewPass2(e.target.value)}
            placeholder="Yeni parolayı tekrar girin"
            style={inp}
            onKeyDown={e => e.key === 'Enter' && handleChange()}
          />
        </div>

        <button onClick={handleChange} disabled={loading} style={btnPrimary}>
          {loading ? '⏳ Değiştiriliyor...' : '🔐 Parolayı Değiştir'}
        </button>

        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '10px 14px', color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.6 }}>
          💡 Parola değiştirildikten sonra mevcut oturumunuz devam eder. Diğer cihazlarda tekrar giriş yapmanız gerekecektir.
        </div>
      </div>
    </Card>
  );
}

function SoundSettings({ playSound }: { playSound: (type: SoundType) => void }) {
  const [settings, setSettings] = useState<SoundSettings>(loadSoundSettings);

  const updateSettings = (patch: Partial<SoundSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSoundSettingsToStorage(next);
  };

  const themes: { id: SoundTheme; label: string; desc: string }[] = [
    { id: 'standart', label: '🎵 Standart', desc: 'Dengeli ve sade sesler' },
    { id: 'minimal', label: '🔇 Minimal', desc: 'Kısa ve hafif sesler' },
    { id: 'yogun', label: '🔊 Yoğun', desc: 'Belirgin ve güçlü sesler' },
  ];

  const soundTypes: { type: SoundType; label: string }[] = [
    { type: 'success', label: '✅ Başarı' },
    { type: 'error', label: '❌ Hata' },
    { type: 'warning', label: '⚠️ Uyarı' },
    { type: 'sale', label: '🛒 Satış' },
    { type: 'notification', label: '🔔 Bildirim' },
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="🔊 Ses Ayarları">
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>Sesli Geri Bildirim</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 2 }}>İşlem seslerini açın veya kapatın</div>
            </div>
            <button
              onClick={() => updateSettings({ enabled: !settings.enabled })}
              style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative', background: settings.enabled ? '#10b981' : '#334155', transition: 'background 0.2s' }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 4, left: settings.enabled ? 28 : 4, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
            </button>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={lbl}>Ses Seviyesi</label>
              <span style={{ color: '#ff7043', fontWeight: 700, fontSize: '0.85rem' }}>{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={settings.volume}
              onChange={e => updateSettings({ volume: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#ff5722' }}
              disabled={!settings.enabled}
            />
          </div>

          <div>
            <label style={lbl}>Ses Teması</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ theme: t.id })}
                  disabled={!settings.enabled}
                  style={{ padding: '12px 10px', border: `2px solid ${settings.theme === t.id ? '#ff5722' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, cursor: 'pointer', background: settings.theme === t.id ? 'rgba(255,87,34,0.1)' : 'rgba(0,0,0,0.2)', color: settings.theme === t.id ? '#ff7043' : '#64748b', textAlign: 'center', transition: 'all 0.15s', opacity: settings.enabled ? 1 : 0.5 }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.label}</div>
                  <div style={{ fontSize: '0.72rem', marginTop: 4, color: settings.theme === t.id ? '#ff7043' : '#475569' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="🗣️ Sesli Konuşma (TTS)">
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>Sesli Bildirim</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 2 }}>Hata ve uyarılarda sesli konuşma</div>
            </div>
            <button
              onClick={() => {
                const key = 'sobaYonetim';
                const raw = localStorage.getItem(key);
                const data = raw ? JSON.parse(raw) : {};
                const current = data.soundSettings?.speechEnabled !== false;
                data.soundSettings = { ...(data.soundSettings || {}), speechEnabled: !current };
                localStorage.setItem(key, JSON.stringify(data));
                setSettings(s => ({ ...s }));
                if (!current && 'speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance('Sesli bildirim aktif edildi');
                  u.lang = 'tr-TR';
                  u.rate = 1.05;
                  window.speechSynthesis.speak(u);
                }
              }}
              style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative', background: (() => { try { const d = JSON.parse(localStorage.getItem('sobaYonetim') || '{}'); return d.soundSettings?.speechEnabled !== false ? '#10b981' : '#334155'; } catch { return '#10b981'; } })(), transition: 'background 0.2s' }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 4, left: (() => { try { const d = JSON.parse(localStorage.getItem('sobaYonetim') || '{}'); return d.soundSettings?.speechEnabled !== false ? 28 : 4; } catch { return 28; } })(), transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
            </button>
          </div>
          <button
            onClick={() => {
              if ('speechSynthesis' in window) {
                const u = new SpeechSynthesisUtterance('Merhaba! Bu bir test konuşmasıdır. Önemli bildirimlerde sesli uyarı alacaksınız.');
                u.lang = 'tr-TR';
                u.rate = 1.05;
                window.speechSynthesis.speak(u);
              }
            }}
            style={{ padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', background: 'rgba(0,0,0,0.3)', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem' }}
          >
            🗣️ Test Konuşma
          </button>
        </div>
      </Card>

      <Card title="🎧 Sesleri Dinle">
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 14 }}>Her ses tipini aşağıdan test edebilirsiniz.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {soundTypes.map(s => (
            <button
              key={s.type}
              onClick={() => playSound(s.type)}
              disabled={!settings.enabled}
              style={{ padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', background: 'rgba(0,0,0,0.3)', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s', opacity: settings.enabled ? 1 : 0.5 }}
              onMouseEnter={e => { if (settings.enabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,87,34,0.1)'; }}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.3)'}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ExcelExportPanel({ db }: { db: DB }) {
  const { showToast } = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sheets, setSheets] = useState({ stok: true, satislar: true, cari: true, kasa: true });

  type SheetKey = keyof typeof sheets;

  const toggleSheet = (key: SheetKey) => setSheets(s => ({ ...s, [key]: !s[key] }));

  const handleExport = () => {
    const selectedSheets = (Object.keys(sheets) as SheetKey[]).filter(k => sheets[k]) as ('stok' | 'satislar' | 'cari' | 'kasa')[];
    if (selectedSheets.length === 0) { showToast('En az bir sekme seçin!', 'warning'); return; }
    try {
      exportToExcel(db, { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, sheets: selectedSheets });
      showToast(`Excel dosyası oluşturuldu! (${selectedSheets.length} sekme)`, 'success');
    } catch (e) {
      showToast('Excel oluşturulamadı!', 'error');
    }
  };

  const sheetDefs: { key: SheetKey; label: string; icon: string; count: number }[] = [
    { key: 'stok', label: 'Stok / Ürünler', icon: '📦', count: db.products.length },
    { key: 'satislar', label: 'Satışlar', icon: '🛒', count: db.sales.length },
    { key: 'cari', label: 'Cari Hesaplar', icon: '👤', count: db.cari.length },
    { key: 'kasa', label: 'Kasa İşlemleri', icon: '💰', count: db.kasa.length },
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="📊 Excel Dışa Aktarma">
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.6 }}>
          Seçtiğiniz veri gruplarını Türkçe başlıklı, tarih ve para birimi formatlarıyla <strong style={{ color: '#10b981' }}>.xlsx</strong> dosyasına aktarın.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Tarih Aralığı (Satış ve Kasa için)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ ...lbl, fontSize: '0.78rem' }}>Başlangıç</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ ...lbl, fontSize: '0.78rem' }}>Bitiş</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Dahil Edilecek Sayfalar</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {sheetDefs.map(s => (
              <div
                key={s.key}
                onClick={() => toggleSheet(s.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: sheets[s.key] ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.2)', border: `2px solid ${sheets[s.key] ? '#10b981' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: sheets[s.key] ? '#f1f5f9' : '#64748b', fontSize: '0.88rem' }}>{s.label}</div>
                  <div style={{ color: '#475569', fontSize: '0.75rem' }}>{s.count} kayıt</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: sheets[s.key] ? '#10b981' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>
                  {sheets[s.key] ? '✓' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleExport} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #059669, #10b981)' }}>
          📊 Excel Dosyasını İndir (.xlsx)
        </button>
      </Card>
    </div>
  );
}

function ActivityPanel({ db, save, showToast, showConfirm }: {
  db: DB;
  save: (fn: (prev: DB) => DB) => void;
  showToast: (m: string, t?: string) => void;
  showConfirm: (t: string, m: string, ok: () => void, d?: boolean) => void;
}) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const activityLog = [...(db._activityLog || [])].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const actionTypes = Array.from(new Set(activityLog.map(a => {
    const parts = a.action.split(':');
    return parts[0].trim();
  }))).slice(0, 15);

  let filtered = activityLog;
  if (typeFilter !== 'all') filtered = filtered.filter(a => a.action.startsWith(typeFilter));
  if (dateFilter) filtered = filtered.filter(a => a.time.startsWith(dateFilter));

  const getIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('satış') || a.includes('satis')) return '🛒';
    if (a.includes('ürün') || a.includes('urun') || a.includes('stok')) return '📦';
    if (a.includes('kasa') || a.includes('gelir') || a.includes('gider')) return '💰';
    if (a.includes('cari') || a.includes('müşteri')) return '👤';
    if (a.includes('fatura')) return '🧾';
    if (a.includes('sipariş')) return '📋';
    if (a.includes('sil') || a.includes('iptal')) return '🗑️';
    return '📝';
  };

  const clearLog = () => {
    showConfirm('Aktivite Günlüğünü Temizle', `${db._activityLog.length} kayıt silinecek. Devam edilsin mi?`, () => {
      save(prev => ({ ...prev, _activityLog: [] }));
      showToast('Aktivite günlüğü temizlendi!');
    }, true);
  };

  return (
    <Card title="📋 Aktivite Günlüğü">
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...inp, width: 160 }} placeholder="Tarih filtrele" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inp, flex: 1 }}>
          <option value="all">Tüm İşlemler</option>
          {actionTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '9px 12px', background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>✕ Tarih</button>}
        <button onClick={clearLog} style={{ padding: '9px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>🗑️ Temizle</button>
      </div>

      <div style={{ color: '#475569', fontSize: '0.8rem', marginBottom: 10 }}>{filtered.length} kayıt (toplam {activityLog.length})</div>

      <div style={{ display: 'grid', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#334155' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
            <p>Aktivite bulunamadı</p>
          </div>
        ) : filtered.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,87,34,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.9rem' }}>
              {getIcon(a.action)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>{a.action}</div>
              {a.detail && <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>{a.detail}</div>}
            </div>
            <div style={{ color: '#334155', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {formatDate(a.time)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const RESTORE_SECTIONS = [
  { key: 'products', label: 'Ürünler', icon: '📦' },
  { key: 'sales', label: 'Satışlar', icon: '🛒' },
  { key: 'suppliers', label: 'Tedarikçiler', icon: '🏭' },
  { key: 'cari', label: 'Cari Hesaplar', icon: '👤' },
  { key: 'kasa', label: 'Kasa İşlemleri', icon: '💰' },
  { key: 'bankTransactions', label: 'Banka İşlemleri', icon: '🏦' },
  { key: 'invoices', label: 'Faturalar', icon: '🧾' },
  { key: 'orders', label: 'Siparişler', icon: '📋' },
  { key: 'stockMovements', label: 'Stok Hareketleri', icon: '📊' },
  { key: 'peletSuppliers', label: 'Pelet Tedarikçi', icon: '🪵' },
  { key: 'peletOrders', label: 'Pelet Sipariş', icon: '🪵' },
  { key: 'boruSuppliers', label: 'Boru Tedarikçi', icon: '🔩' },
  { key: 'boruOrders', label: 'Boru Sipariş', icon: '🔩' },
  { key: 'budgets', label: 'Bütçe', icon: '📊' },
  { key: 'returns', label: 'İadeler', icon: '↩️' },
  { key: 'company', label: 'Şirket Bilgileri', icon: '🏢', isObject: true },
  { key: 'pelletSettings', label: 'Pelet Ayarları', icon: '⚙️', isObject: true },
] as const;

function SelectiveRestore({ showToast, showConfirm }: {
  showToast: (m: string, t?: string) => void;
  showConfirm: (t: string, m: string, ok: () => void, d?: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<Record<string, unknown> | null>(null);
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [available, setAvailable] = useState<{ key: string; label: string; icon: string; count: number; isObject?: boolean }[]>([]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (typeof data !== 'object' || Array.isArray(data)) {
          showToast('Geçersiz JSON formatı!', 'error');
          return;
        }
        setFileData(data);
        const avail: typeof available = [];
        RESTORE_SECTIONS.forEach(s => {
          const val = data[s.key];
          if (s.key === 'company' || s.key === 'pelletSettings') {
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              avail.push({ key: s.key, label: s.label, icon: s.icon, count: 1, isObject: true });
            }
          } else if (Array.isArray(val) && val.length > 0) {
            avail.push({ key: s.key, label: s.label, icon: s.icon, count: val.length });
          }
        });
        setAvailable(avail);
        setSelected(new Set(avail.map(a => a.key)));
      } catch {
        showToast('JSON ayrıştırılamadı!', 'error');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleSection = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(available.map(a => a.key)));
  const selectNone = () => setSelected(new Set());

  const doRestore = () => {
    if (!fileData || selected.size === 0) return;
    const selCount = available.filter(a => selected.has(a.key)).reduce((s, a) => s + a.count, 0);
    showConfirm(
      'Seçimli Geri Yükleme',
      `${selected.size} bölüm (${selCount} kayıt) geri yüklenecek. Seçilen bölümlerdeki mevcut veriler değiştirilecek. Devam edilsin mi?`,
      () => {
        try {
          const raw = localStorage.getItem('sobaYonetim');
          const current = raw ? JSON.parse(raw) : {};
          selected.forEach(key => {
            current[key] = fileData[key];
          });
          localStorage.setItem('sobaYonetim', JSON.stringify(current));
          showToast(`${selected.size} bölüm başarıyla geri yüklendi! Sayfa yenilenecek...`, 'success');
          setTimeout(() => window.location.reload(), 1200);
        } catch {
          showToast('Geri yükleme sırasında hata oluştu!', 'error');
        }
      },
      true
    );
  };

  const reset = () => { setFileData(null); setFileName(''); setSelected(new Set()); setAvailable([]); };

  return (
    <Card title="📂 Seçimli Geri Yükleme">
      <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 14, lineHeight: 1.6 }}>
        Yedek dosyanızdan <strong style={{ color: '#f59e0b' }}>istediğiniz bölümleri seçerek</strong> geri yükleyin. Tüm veriyi değiştirmek zorunda değilsiniz.
      </p>

      {!fileData ? (
        <>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '16px 0', background: 'rgba(59,130,246,0.08)', border: '2px dashed rgba(59,130,246,0.3)', borderRadius: 12, color: '#60a5fa', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.08)'; }}>
            JSON Yedek Dosyası Seç
          </button>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10 }}>
            <span style={{ color: '#10b981', fontSize: '1.1rem' }}>📄</span>
            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>{fileName}</span>
            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{available.length} bölüm bulundu</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem' }}>Geri Yüklenecek Bölümler:</span>
            <button onClick={selectAll} style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, color: '#10b981', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>Tümünü Seç</button>
            <button onClick={selectNone} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>Hiçbirini Seçme</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {available.map(section => {
              const isSelected = selected.has(section.key);
              return (
                <div key={section.key} onClick={() => toggleSection(section.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: isSelected ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${isSelected ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.04)'}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.12)'}`,
                    color: '#fff', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                  }}>
                    {isSelected ? '✓' : ''}
                  </div>
                  <span style={{ fontSize: '0.95rem' }}>{section.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: isSelected ? '#f1f5f9' : '#64748b', fontWeight: 600, fontSize: '0.82rem' }}>{section.label}</div>
                    <div style={{ color: '#334155', fontSize: '0.72rem' }}>
                      {section.isObject ? 'Ayarlar' : `${section.count} kayıt`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '10px 16px', color: '#fde68a', fontSize: '0.83rem' }}>
              Seçilen {selected.size} bölümdeki mevcut veriler yedekteki verilerle değiştirilecek. Diğer bölümler dokunulmayacak.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {selected.size > 0 && (
              <button onClick={doRestore} style={{ flex: 1, padding: '12px 0', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                {selected.size} Bölümü Geri Yükle
              </button>
            )}
            <button onClick={reset} style={{ padding: '12px 18px', background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Sıfırla</button>
          </div>
        </div>
      )}
    </Card>
  );
}

const KNOWN_ARRAYS: Record<string, string> = {
  products: 'Ürünler', sales: 'Satışlar', suppliers: 'Tedarikçiler', cari: 'Cari Müşteriler',
  kasa: 'Kasa Hareketleri', bankTransactions: 'Banka İşlemleri', orders: 'Siparişler',
  invoices: 'Faturalar', stockMovements: 'Stok Hareketleri', peletSuppliers: 'Pelet Tedarikçi',
  peletOrders: 'Pelet Sipariş', boruSuppliers: 'Boru Tedarikçi', boruOrders: 'Boru Sipariş',
  budgets: 'Bütçe', returns: 'İadeler', ortakEmanetler: 'Ortak Emanet', installments: 'Taksitler',
};

const LEGACY_FIELD_MAP: Record<string, string> = {
  urunler: 'products', satislar: 'sales', tedarikci: 'suppliers', musteriler: 'cari',
  kasaHareketleri: 'kasa', bankHareketleri: 'bankTransactions', siparisler: 'orders',
  faturalar: 'invoices', stokHareketleri: 'stockMovements', stoklar: 'products',
  musteri: 'cari', tedarikcilar: 'suppliers', kasaIslemleri: 'kasa',
};

type ConflictResolution = 'overwrite' | 'skip' | 'merge';

interface ConflictInfo {
  entity: string;
  label: string;
  byId: number;
  byName: number;
  total: number;
}

const CSV_COLUMN_MAP: Record<string, { target: string; field: string }> = {
  'müşteri': { target: 'cari', field: 'name' },
  'musteri': { target: 'cari', field: 'name' },
  'müşteri adı': { target: 'cari', field: 'name' },
  'ad': { target: 'cari', field: 'name' },
  'isim': { target: 'cari', field: 'name' },
  'ad soyad': { target: 'cari', field: 'name' },
  'telefon': { target: 'cari', field: 'phone' },
  'tel': { target: 'cari', field: 'phone' },
  'adres': { target: 'cari', field: 'address' },
  'bakiye': { target: 'cari', field: 'balance' },
  'borç': { target: 'cari', field: 'balance' },
  'borc': { target: 'cari', field: 'balance' },
  'tarih': { target: '_date', field: 'createdAt' },
  'date': { target: '_date', field: 'createdAt' },
  'tutar': { target: '_amount', field: 'amount' },
  'toplam': { target: '_amount', field: 'total' },
  'fiyat': { target: '_amount', field: 'price' },
  'ürün': { target: 'products', field: 'name' },
  'urun': { target: 'products', field: 'name' },
  'ürün adı': { target: 'products', field: 'name' },
  'stok': { target: 'products', field: 'stock' },
  'maliyet': { target: 'products', field: 'cost' },
  'satış fiyatı': { target: 'products', field: 'price' },
  'kategori': { target: '_category', field: 'category' },
  'açıklama': { target: '_desc', field: 'description' },
  'aciklama': { target: '_desc', field: 'description' },
  'not': { target: '_desc', field: 'note' },
  'e-posta': { target: 'cari', field: 'email' },
  'email': { target: 'cari', field: 'email' },
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(/[,;\t]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

interface CsvColumnMapping {
  csvColumn: string;
  targetEntity: string;
  targetField: string;
  autoDetected: boolean;
}

function detectCsvColumns(headers: string[]): CsvColumnMapping[] {
  return headers.map(h => {
    const lower = h.toLowerCase().trim();
    const match = CSV_COLUMN_MAP[lower];
    if (match) {
      return { csvColumn: h, targetEntity: match.target, targetField: match.field, autoDetected: true };
    }
    for (const [key, val] of Object.entries(CSV_COLUMN_MAP)) {
      if (lower.includes(key)) {
        return { csvColumn: h, targetEntity: val.target, targetField: val.field, autoDetected: true };
      }
    }
    return { csvColumn: h, targetEntity: '', targetField: '', autoDetected: false };
  });
}

function SmartImportManager({ db, save: _save, showToast, showConfirm }: {
  db: DB;
  save: (fn: (prev: DB) => DB) => void;
  showToast: (m: string, t?: string) => void;
  showConfirm: (t: string, m: string, ok: () => void, d?: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'mapping' | 'csvMapping' | 'preview' | 'done'>('idle');
  const [rawData, setRawData] = useState<Record<string, unknown> | null>(null);
  const [mapped, setMapped] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [unknownFields, setUnknownFields] = useState<string[]>([]);
  const [legacyMapped, setLegacyMapped] = useState<Record<string, string>>({});
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvMappings, setCsvMappings] = useState<CsvColumnMapping[]>([]);
  const [csvTarget, setCsvTarget] = useState<string>('cari');

  const detectFieldMappings = (data: Record<string, unknown>) => {
    const unknown: string[] = [];
    const autoMapped: Record<string, string> = {};
    const knownAll = new Set([...Object.keys(KNOWN_ARRAYS), '_version', 'company', 'settings', 'pelletSettings', 'kasalar', 'matchRules', 'monitorRules', 'monitorLog', '_activityLog', 'soundSettings']);

    Object.keys(data).forEach(key => {
      if (!knownAll.has(key)) {
        if (LEGACY_FIELD_MAP[key]) {
          autoMapped[key] = LEGACY_FIELD_MAP[key];
        } else {
          unknown.push(key);
        }
      }
    });
    return { unknown, autoMapped };
  };

  const applyMappings = (data: Record<string, unknown>, mappings: Record<string, string>): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...data };
    Object.entries(mappings).forEach(([src, dst]) => {
      if (dst && dst !== '' && result[src] !== undefined) {
        if (!result[dst] || !Array.isArray(result[dst])) {
          result[dst] = result[src];
        } else if (Array.isArray(result[dst]) && Array.isArray(result[src])) {
          result[dst] = [...(result[dst] as unknown[]), ...(result[src] as unknown[])];
        }
        delete result[src];
      }
    });
    return result;
  };

  const detectConflicts = (data: Record<string, unknown>): ConflictInfo[] => {
    const checks: Array<{ entity: string; label: string; dbItems: { id?: string; name?: string; code?: string }[]; importKey: string }> = [
      { entity: 'products', label: 'Ürün', dbItems: db.products, importKey: 'products' },
      { entity: 'sales', label: 'Satış', dbItems: db.sales, importKey: 'sales' },
      { entity: 'cari', label: 'Cari Müşteri', dbItems: db.cari, importKey: 'cari' },
      { entity: 'suppliers', label: 'Tedarikçi', dbItems: db.suppliers || [], importKey: 'suppliers' },
    ];

    return checks.map(({ entity, label, dbItems, importKey }) => {
      const incoming = (data[importKey] as { id?: string; name?: string; code?: string }[]) || [];
      const existingIds = new Set(dbItems.map(d => d.id).filter(Boolean));
      const existingNames = new Set(dbItems.map(d => (d.name || '').toLowerCase().trim()).filter(Boolean));
      const byId = incoming.filter(item => item.id && existingIds.has(item.id)).length;
      const byName = incoming.filter(item => !item.id && item.name && existingNames.has(item.name.toLowerCase().trim())).length;
      return { entity, label, byId, byName, total: byId + byName };
    }).filter(c => c.total > 0);
  };

  const analyzeData = (data: Record<string, unknown>) => {
    const errs: string[] = [];
    const warns: string[] = [];
    const st: Record<string, number> = {};

    Object.entries(KNOWN_ARRAYS).forEach(([key]) => {
      const val = data[key];
      if (Array.isArray(val)) {
        if (val.length > 0) st[key] = val.length;
        if (val.length === 0) warns.push(`"${KNOWN_ARRAYS[key]}" alanı boş`);
      } else if (val !== undefined) {
        errs.push(`"${key}" alanı geçersiz format — dizi bekleniyor`);
      }
    });

    if (!data.company || typeof data.company !== 'object') warns.push('Şirket bilgisi bulunamadı — varsayılan oluşturulacak');
    if (!data.pelletSettings) warns.push('Pelet ayarları bulunamadı — varsayılan kullanılacak');
    if (!data._version) warns.push('Versiyon bilgisi yok — eski format olabilir, lütfen kontrol edin');
    else if ((data._version as number) < 1) warns.push(`Eski versiyon (${data._version}) — bazı alanlar eksik olabilir`);

    return { errs, warns, st };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;

      if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setErrors(['CSV dosyası boş veya geçersiz format']);
          setStage('preview');
          return;
        }
        setCsvRows(rows);
        const headers = Object.keys(rows[0]);
        const mappings = detectCsvColumns(headers);
        setCsvMappings(mappings);
        const hasCariCols = mappings.some(m => m.targetEntity === 'cari');
        const hasProductCols = mappings.some(m => m.targetEntity === 'products');
        setCsvTarget(hasCariCols ? 'cari' : hasProductCols ? 'products' : 'cari');
        setStage('csvMapping');
        return;
      }

      try {
        const data = JSON.parse(text);
        if (typeof data !== 'object' || Array.isArray(data)) {
          setErrors(['Geçersiz JSON formatı — nesne bekleniyor']);
          setStage('preview');
          setRawData(null);
          return;
        }
        setRawData(data);
        const { unknown, autoMapped } = detectFieldMappings(data);
        setLegacyMapped(autoMapped);
        setUnknownFields(unknown);
        const initMappings: Record<string, string> = {};
        unknown.forEach(f => { initMappings[f] = ''; });
        setFieldMappings(initMappings);

        if (unknown.length > 0 || Object.keys(autoMapped).length > 0) {
          setStage('mapping');
        } else {
          proceedToPreview(data, {});
        }
      } catch {
        setErrors(['Dosya ayrıştırılamadı — JSON veya CSV formatını kontrol edin']);
        setStage('preview');
        setRawData(null);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyCsvImport = () => {
    if (csvRows.length === 0) return;
    const items: Record<string, unknown>[] = csvRows.map(row => {
      const item: Record<string, unknown> = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      csvMappings.forEach(m => {
        if (!m.targetField || m.targetField === '') return;
        const val = row[m.csvColumn];
        if (!val) return;
        const numFields = ['balance', 'amount', 'total', 'price', 'stock', 'cost', 'quantity'];
        if (numFields.includes(m.targetField)) {
          item[m.targetField] = parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        } else if (m.targetField === 'createdAt') {
          try { item.createdAt = new Date(val).toISOString(); } catch { /* keep default */ }
        } else {
          item[m.targetField] = val;
        }
      });
      if (csvTarget === 'cari') {
        if (!item.type) item.type = 'musteri';
        if (!item.balance) item.balance = 0;
        if (!item.totalPurchases) item.totalPurchases = 0;
      }
      if (csvTarget === 'products') {
        if (!item.stock) item.stock = 0;
        if (!item.cost) item.cost = 0;
        if (!item.price) item.price = 0;
        if (!item.minStock) item.minStock = 5;
        if (!item.category) item.category = '';
      }
      if (csvTarget === 'kasa') {
        if (!item.type) item.type = 'gider';
        if (!item.kasa) item.kasa = 'nakit';
        if (!item.amount) item.amount = 0;
        if (!item.description) item.description = (item.name as string) || 'CSV İçe Aktarma';
        if (!item.category) item.category = 'diger';
      }
      return item;
    });

    const data: Record<string, unknown> = {};
    data[csvTarget] = items;
    setRawData(data);
    proceedToPreview(data, {});
  };

  const proceedToPreview = (data: Record<string, unknown>, userMappings: Record<string, string>) => {
    const allMappings = { ...legacyMapped, ...userMappings };
    const resolved = applyMappings(data, allMappings);
    const { errs, warns, st } = analyzeData(resolved);
    const detectedConflicts = detectConflicts(resolved);
    const initRes: Record<string, ConflictResolution> = {};
    detectedConflicts.forEach(c => { initRes[c.entity] = 'overwrite'; });
    setMapped(resolved);
    setErrors(errs);
    setWarnings(warns);
    setStats(st);
    setConflicts(detectedConflicts);
    setResolutions(initRes);
    setStage('preview');
  };

  const doImport = () => {
    if (!mapped) return;
    showConfirm('Veri Aktarımını Onayla', 'Seçilen çakışma çözümleri uygulanacak ve veriler içe aktarılacak. Mevcut veriler etkilenebilir. Onaylıyor musunuz?', () => {
      try {
        const raw = localStorage.getItem('sobaYonetim');
        const current = raw ? JSON.parse(raw) : {};
        const def = {
          _version: 1, products: [], sales: [], suppliers: [], orders: [], cari: [], kasa: [],
          kasalar: [{ id: 'nakit', name: 'Nakit', icon: '💵' }, { id: 'banka', name: 'Banka', icon: '🏦' }],
          bankTransactions: [], matchRules: [], monitorRules: [], monitorLog: [], stockMovements: [],
          peletSuppliers: [], peletOrders: [], boruSuppliers: [], boruOrders: [],
          invoices: [], budgets: [], returns: [], _activityLog: [],
          company: current.company || {}, settings: {}, pelletSettings: { gramaj: 14, kgFiyat: 6.5, cuvalKg: 15, critDays: 3 },
          ortakEmanetler: [], installments: [],
        };
        let finalData: Record<string, unknown> = { ...def, ...mapped };

        const conflictEntities = ['products', 'cari', 'suppliers', 'sales'] as const;
        conflictEntities.forEach(entity => {
          const resolution = resolutions[entity] || 'overwrite';
          const incoming = (mapped[entity] as { id?: string; name?: string }[]) || [];
          const existing = (current[entity] as { id?: string; name?: string }[]) || [];

          if (resolution === 'skip') {
            const existingIds = new Set(existing.map((x: { id?: string }) => x.id).filter(Boolean));
            const existingNames = new Set(existing.map((x: { name?: string }) => (x.name || '').toLowerCase()).filter(Boolean));
            finalData[entity] = [
              ...existing,
              ...incoming.filter(item => !existingIds.has(item.id) && !existingNames.has((item.name || '').toLowerCase())),
            ];
          } else if (resolution === 'merge') {
            const existingMap = new Map(existing.map((x: { id?: string }) => [x.id, x]));
            incoming.forEach(item => {
              if (item.id && existingMap.has(item.id)) {
                existingMap.set(item.id, { ...existingMap.get(item.id)!, ...item });
              } else {
                existingMap.set(item.id || Math.random().toString(), item);
              }
            });
            finalData[entity] = Array.from(existingMap.values());
          }
        });

        if (!finalData.kasalar || (finalData.kasalar as unknown[]).length === 0) finalData.kasalar = def.kasalar;
        if (!finalData.pelletSettings) finalData.pelletSettings = def.pelletSettings;
        if (!finalData.company || typeof finalData.company !== 'object') finalData.company = def.company;

        localStorage.setItem('sobaYonetim', JSON.stringify(finalData));
        setStage('done');
        showToast('Veriler başarıyla aktarıldı! Sayfa yenilenecek...', 'success');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        showToast('İçe aktarma sırasında hata oluştu!', 'error');
      }
    }, true);
  };

  const reset = () => {
    setStage('idle'); setRawData(null); setMapped(null); setErrors([]); setWarnings([]);
    setStats({}); setConflicts([]); setResolutions({}); setFieldMappings({}); setUnknownFields([]); setLegacyMapped({});
    setCsvRows([]); setCsvMappings([]); setCsvTarget('cari');
  };

  const btnStyle = (active: boolean, color: string) => ({
    padding: '6px 14px', border: `1px solid ${active ? color : '#334155'}`, borderRadius: 8,
    background: active ? `${color}20` : 'transparent', color: active ? color : '#64748b',
    cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
  });

  return (
    <Card title="🧠 Akıllı Veri İçe Aktarma">
      <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 14, lineHeight: 1.6 }}>
        JSON, CSV veya TXT dosyanızı analiz eder; kolonları otomatik eşler (müşteri, tarih, tutar vb.), manuel düzeltme imkanı sunar ve çakışmaları çözerek güvenli aktarım yapar.
      </p>

      {stage === 'idle' && (
        <>
          <input ref={fileRef} type="file" accept=".json,.csv,.tsv,.txt" onChange={handleFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '16px 0', background: 'rgba(139,92,246,0.08)', border: '2px dashed rgba(139,92,246,0.3)', borderRadius: 12, color: '#a78bfa', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
            Dosya Seç & Akıllı Analiz Başlat
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
            {['JSON', 'CSV', 'TSV', 'TXT'].map(f => (
              <span key={f} style={{ padding: '3px 10px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 6, color: '#a78bfa', fontSize: '0.72rem', fontWeight: 600 }}>.{f.toLowerCase()}</span>
            ))}
          </div>
        </>
      )}

      {stage === 'csvMapping' && csvRows.length > 0 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ color: '#10b981', fontWeight: 700, marginBottom: 4 }}>{csvRows.length} satır okundu</div>
            <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Kolon eşleşmelerini kontrol edin ve gerekirse düzeltin</div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem' }}>Hedef Veri Türü:</span>
              {[
                { id: 'cari', label: 'Cari Müşteri', icon: '👤' },
                { id: 'products', label: 'Ürün', icon: '📦' },
                { id: 'kasa', label: 'Kasa', icon: '💰' },
              ].map(t => (
                <button key={t.id} onClick={() => setCsvTarget(t.id)} style={{
                  padding: '6px 14px', border: `1px solid ${csvTarget === t.id ? '#ff5722' : '#334155'}`,
                  borderRadius: 8, background: csvTarget === t.id ? 'rgba(255,87,34,0.15)' : 'transparent',
                  color: csvTarget === t.id ? '#ff7043' : '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                }}>{t.icon} {t.label}</button>
              ))}
            </div>
          </div>

          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem' }}>Kolon Eşleşmeleri</div>
          {csvMappings.map((m, i) => (
            <div key={m.csvColumn} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 140, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, color: m.autoDetected ? '#10b981' : '#f59e0b', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>
                {m.csvColumn}
                {m.autoDetected && <span style={{ fontSize: '0.65rem', marginLeft: 4, color: '#10b981' }}>otomatik</span>}
              </div>
              <span style={{ color: '#475569' }}>→</span>
              <select
                value={m.targetField}
                onChange={e => {
                  const next = [...csvMappings];
                  next[i] = { ...next[i], targetField: e.target.value, autoDetected: false };
                  setCsvMappings(next);
                }}
                style={{ flex: 1, padding: '7px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: '0.82rem' }}
              >
                <option value="">— Yoksay —</option>
                <option value="name">Ad / İsim</option>
                <option value="phone">Telefon</option>
                <option value="email">E-posta</option>
                <option value="address">Adres</option>
                <option value="balance">Bakiye / Borç</option>
                <option value="amount">Tutar</option>
                <option value="total">Toplam</option>
                <option value="price">Fiyat</option>
                <option value="cost">Maliyet</option>
                <option value="stock">Stok</option>
                <option value="category">Kategori</option>
                <option value="description">Açıklama</option>
                <option value="note">Not</option>
                <option value="createdAt">Tarih</option>
              </select>
            </div>
          ))}

          {csvRows.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '12px 16px', overflowX: 'auto' }}>
              <div style={{ color: '#64748b', fontWeight: 700, fontSize: '0.78rem', marginBottom: 8 }}>Önizleme (ilk 3 satır):</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    {Object.keys(csvRows[0]).map(h => (
                      <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 3).map((row, ri) => (
                    <tr key={ri}>
                      {Object.values(row).map((v, ci) => (
                        <td key={ci} style={{ padding: '4px 8px', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={applyCsvImport} style={{ flex: 1, padding: '11px 0', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Devam → Önizleme & Çakışma Çözümü
            </button>
            <button onClick={reset} style={{ padding: '11px 18px', background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', cursor: 'pointer' }}>Sıfırla</button>
          </div>
        </div>
      )}

      {stage === 'mapping' && rawData && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>🗺️ Alan Eşleme (Field Mapping)</div>
          {Object.keys(legacyMapped).length > 0 && (
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ color: '#10b981', fontWeight: 700, marginBottom: 8 }}>✅ Otomatik Algılanan Eski Alanlar</div>
              {Object.entries(legacyMapped).map(([src, dst]) => (
                <div key={src} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.85rem' }}>
                  <span style={{ color: '#f59e0b', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4 }}>{src}</span>
                  <span style={{ color: '#475569' }}>→</span>
                  <span style={{ color: '#10b981', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4 }}>{dst}</span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({KNOWN_ARRAYS[dst] || dst})</span>
                </div>
              ))}
            </div>
          )}
          {unknownFields.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 10 }}>⚠️ Tanınmayan Alanlar — Eşleme Seçin</div>
              {unknownFields.map(field => (
                <div key={field} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ color: '#f59e0b', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '3px 10px', borderRadius: 6, minWidth: 120, textAlign: 'center' }}>{field}</span>
                  <span style={{ color: '#475569', fontSize: '0.9rem' }}>→</span>
                  <select
                    value={fieldMappings[field] || ''}
                    onChange={e => setFieldMappings(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{ flex: 1, padding: '7px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: '0.85rem' }}
                  >
                    <option value="">— Yoksay (aktarma)</option>
                    {Object.entries(KNOWN_ARRAYS).map(([k, label]) => (
                      <option key={k} value={k}>{label} ({k})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => proceedToPreview(rawData, fieldMappings)} style={{ flex: 1, padding: '11px 0', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Devam → Önizleme & Çakışma Çözümü
            </button>
            <button onClick={reset} style={{ padding: '11px 18px', background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', cursor: 'pointer' }}>Sıfırla</button>
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {errors.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 8 }}>❌ Hatalar</div>
              {errors.map((e, i) => <div key={i} style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: 4 }}>• {e}</div>)}
            </div>
          )}
          {warnings.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 8 }}>⚠️ Uyarılar</div>
              {warnings.map((w, i) => <div key={i} style={{ color: '#fde68a', fontSize: '0.85rem', marginBottom: 4 }}>• {w}</div>)}
            </div>
          )}
          {Object.keys(stats).length > 0 && (
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: 8 }}>📊 İçe Aktarılacak Kayıtlar</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {Object.entries(stats).map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{v}</div>
                    <div style={{ color: '#475569', fontSize: '0.72rem' }}>{KNOWN_ARRAYS[k] || k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {conflicts.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 12 }}>⚡ Çakışma Çözümü</div>
              {conflicts.map(c => (
                <div key={c.entity} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: 8 }}>
                    <strong>{c.label}</strong>: {c.byId > 0 && `${c.byId} aynı ID`}{c.byId > 0 && c.byName > 0 && ', '}{c.byName > 0 && `${c.byName} aynı isim`} çakışması
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setResolutions(r => ({ ...r, [c.entity]: 'overwrite' }))} style={btnStyle(resolutions[c.entity] === 'overwrite', '#ef4444')}>
                      🔄 Üzerine Yaz
                    </button>
                    <button onClick={() => setResolutions(r => ({ ...r, [c.entity]: 'skip' }))} style={btnStyle(resolutions[c.entity] === 'skip', '#f59e0b')}>
                      ⏭️ Çakışanları Atla
                    </button>
                    <button onClick={() => setResolutions(r => ({ ...r, [c.entity]: 'merge' }))} style={btnStyle(resolutions[c.entity] === 'merge', '#10b981')}>
                      🔀 Birleştir
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 6 }}>
                    {resolutions[c.entity] === 'overwrite' && 'Mevcut kayıtlar yeni verilerle tamamen değiştirilir.'}
                    {resolutions[c.entity] === 'skip' && 'Çakışan kayıtlar atlanır; mevcut veriler korunur, yeni olanlar eklenir.'}
                    {resolutions[c.entity] === 'merge' && 'Mevcut kayıtlar yeni alanlarla güncellenir; hiç kayıp olmaz.'}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {mapped && errors.length === 0 && (
              <button onClick={doImport} style={{ flex: 1, padding: '11px 0', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                ✅ Aktarımı Onayla & Başlat
              </button>
            )}
            <button onClick={reset} style={{ padding: '11px 18px', background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', cursor: 'pointer' }}>Sıfırla</button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
          <div style={{ color: '#10b981', fontWeight: 700, fontSize: '1.1rem' }}>Veriler başarıyla aktarıldı!</div>
          <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 6 }}>Sayfa yenileniyor...</div>
        </div>
      )}
    </Card>
  );
}

function VeriOnarim({ db, save, showToast, showConfirm }: { db: DB; save: (fn: (prev: DB) => DB) => void; showToast: (m: string, t?: string) => void; showConfirm: (title: string, msg: string, onOk: () => void, danger?: boolean) => void }) {
  const [results, setResults] = useState<string[]>([]);

  const diagnose = () => {
    const issues: string[] = [];
    const saleIds = db.sales.map(s => s.id);
    const dupSales = saleIds.length - new Set(saleIds).size;
    if (dupSales > 0) issues.push(`⚠️ ${dupSales} tekrarlanan satış kaydı`);
    const negStock = db.products.filter(p => p.stock < 0).length;
    if (negStock > 0) issues.push(`⚠️ ${negStock} ürünün stok değeri negatif`);
    const cariIds = new Set(db.cari.map(c => c.id));
    const orphanKasa = db.kasa.filter(k => k.cariId && !cariIds.has(k.cariId)).length;
    if (orphanKasa > 0) issues.push(`⚠️ ${orphanKasa} kasa kaydı silinmiş cariye bağlı`);
    const soldProductIds = new Set(db.sales.flatMap(s => s.items?.map((i: { productId: string }) => i.productId) || [s.productId]).filter(Boolean));
    const stocklessProducts = db.products.filter(p => soldProductIds.has(p.id) && p.stock === 0).length;
    if (stocklessProducts > 0) issues.push(`ℹ️ ${stocklessProducts} ürün satıldı ama stok sıfır`);
    if (!db.company.name) issues.push('ℹ️ Şirket adı girilmemiş');
    const lsSize = new Blob([localStorage.getItem('sobaYonetim') || '']).size;
    const lsKB = Math.round(lsSize / 1024);
    issues.push(`📊 localStorage boyutu: ${lsKB} KB (limit ~5MB)`);
    const orphanInvoices = (db.invoices || []).filter(inv => inv.cariId && !cariIds.has(inv.cariId)).length;
    if (orphanInvoices > 0) issues.push(`⚠️ ${orphanInvoices} fatura silinmiş cariye bağlı`);
    setResults(issues.length === 0 ? ['✅ Veri tutarlılık kontrolü tamam. Sorun bulunamadı!'] : issues);
  };

  const fixNegativeStock = () => {
    showConfirm('Stok Düzelt', 'Negatif stoklar sıfıra çekilecek. Devam edilsin mi?', () => {
      save(prev => ({ ...prev, products: prev.products.map(p => p.stock < 0 ? { ...p, stock: 0 } : p) }));
      showToast('Negatif stoklar düzeltildi!');
      diagnose();
    });
  };

  const fixOrphanKasa = () => {
    showConfirm('Orphan Temizle', 'Silinmiş cariye ait kasa kayıtlarındaki cari bağlantısı kaldırılacak. Devam?', () => {
      const cariIds = new Set(db.cari.map(c => c.id));
      save(prev => ({ ...prev, kasa: prev.kasa.map(k => k.cariId && !cariIds.has(k.cariId) ? { ...k, cariId: undefined } : k) }));
      showToast('Orphan kasa kayıtları düzeltildi!');
      diagnose();
    });
  };

  const recalcCariBalance = () => {
    showConfirm('Bakiye Yeniden Hesapla', 'Tüm cari bakiyeleri kasa işlemlerine göre sıfırdan hesaplanacak. Mevcut bakiyeler SIFIRLANACAK!', () => {
      save(prev => {
        const cari = prev.cari.map(c => {
          const kasaEntries = prev.kasa.filter(k => k.cariId === c.id);
          const newBalance = kasaEntries.reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
          return { ...c, balance: newBalance };
        });
        return { ...prev, cari };
      });
      showToast('Cari bakiyeler yeniden hesaplandı!');
      diagnose();
    }, true);
  };

  const removeDupSales = () => {
    showConfirm('Tekrarları Temizle', 'Aynı ID\'li tekrarlanan satış kayıtları silinecek. Devam edilsin mi?', () => {
      save(prev => {
        const seen = new Set<string>();
        return { ...prev, sales: prev.sales.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; }) };
      });
      showToast('Tekrarlanan satışlar temizlendi!');
      diagnose();
    });
  };

  const mergeduplicateCari = () => {
    const nameCounts: Record<string, string[]> = {};
    db.cari.forEach(c => { const n = c.name.trim().toLowerCase(); if (!nameCounts[n]) nameCounts[n] = []; nameCounts[n].push(c.id); });
    const dups = Object.entries(nameCounts).filter(([, ids]) => ids.length > 1);
    if (dups.length === 0) { showToast('Tekrarlanan cari bulunamadı!'); return; }
    showConfirm('Cari Birleştir', `${dups.length} isimde tekrar var. İlk kayıt korunacak. Devam?`, () => {
      save(prev => {
        const toRemove = new Set<string>();
        dups.forEach(([, ids]) => ids.slice(1).forEach(id => toRemove.add(id)));
        return { ...prev, cari: prev.cari.filter(c => !toRemove.has(c.id)) };
      });
      showToast(`${dups.length} grup birleştirildi!`);
      diagnose();
    }, true);
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="🔧 Veri Tutarlılık Kontrolü">
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>Veritabanınızı analiz ederek tutarsız, eksik veya hatalı kayıtları tespit edin.</p>
        <button onClick={diagnose} style={{ width: '100%', padding: '13px 0', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', marginBottom: 14 }}>
          🔍 Veriyi Analiz Et
        </button>
        {results.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            {results.map((r, i) => (
              <div key={i} style={{ padding: '10px 14px', background: r.startsWith('✅') ? 'rgba(16,185,129,0.08)' : r.startsWith('📊') ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${r.startsWith('✅') ? 'rgba(16,185,129,0.2)' : r.startsWith('📊') ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 9, color: '#e2e8f0', fontSize: '0.85rem' }}>
                {r}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="🛠️ Onarım Araçları">
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { label: '📦 Negatif Stokları Sıfırla', desc: 'Stok değeri 0\'ın altına düşmüş ürünleri sıfıra çeker', action: fixNegativeStock, color: '#f59e0b' },
            { label: '🔗 Orphan Kasa Bağlantılarını Temizle', desc: 'Silinmiş cariye bağlı kasa kayıtlarındaki bağlantıyı kaldırır', action: fixOrphanKasa, color: '#3b82f6' },
            { label: '⚖️ Cari Bakiyeleri Yeniden Hesapla', desc: 'Tüm bakiyeleri kasa işlemlerine göre baştan hesaplar', action: recalcCariBalance, color: '#8b5cf6' },
            { label: '🗑️ Tekrarlayan Satış Kayıtlarını Temizle', desc: 'Aynı ID ile çift kaydedilmiş satışları siler', action: removeDupSales, color: '#10b981' },
            { label: '🤝 Aynı İsimli Cari Hesapları Birleştir', desc: 'Aynı isimde birden fazla cari varsa tek kayıt bırakır', action: mergeduplicateCari, color: '#ef4444' },
          ].map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: `1px solid ${t.color}15` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.88rem' }}>{t.label}</div>
                <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: 2 }}>{t.desc}</div>
              </div>
              <button onClick={t.action} style={{ background: `${t.color}15`, border: `1px solid ${t.color}30`, borderRadius: 8, color: t.color, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                Uygula
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="📋 Sistem Bilgileri">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Toplam Kayıt', value: `${[db.products, db.sales, db.cari, db.kasa, db.invoices || [], db.budgets || []].reduce((s, a) => s + a.length, 0)} kayıt` },
            { label: 'localStorage Boyutu', value: `${Math.round(new Blob([localStorage.getItem('sobaYonetim') || '']).size / 1024)} KB` },
            { label: 'Uygulama Versiyonu', value: `v${db._version || 1}` },
            { label: 'Son Veri Güncellemesi', value: db.kasa.length > 0 ? new Date(Math.max(...db.kasa.map(k => new Date(k.updatedAt || k.createdAt).getTime()))).toLocaleDateString('tr-TR') : '-' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function DangerAction({ label, desc, onConfirm }: { label: string; desc: string; onConfirm: () => void }) {
  const { showConfirm } = useConfirm();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.88rem' }}>{label}</div>
        <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: 2 }}>{desc}</div>
      </div>
      <button onClick={() => showConfirm(label, `${desc}. Bu işlem geri alınamaz!`, onConfirm, true)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
        Temizle
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>{title}</h3>
      </div>
      <div style={{ padding: '20px 22px' }}>{children}</div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 6, color: '#64748b', fontSize: '0.82rem', fontWeight: 600 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { width: '100%', padding: '13px 0', background: 'linear-gradient(135deg, #ff5722, #ff7043)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' };

function FV({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} />
    </div>
  );
}

// ── Kategori Yönetim Component ────────────────────────────────────────────────
function KategoriYonetim({ db, save }: { db: DB; save: (fn: (prev: DB) => DB) => void }) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const cats = db.productCategories || [];
  const [yeniAd, setYeniAd] = useState('');
  const [yeniIcon, setYeniIcon] = useState('📦');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', icon: '' });

  const addKat = () => {
    const ad = yeniAd.trim();
    if (!ad) { showToast('Kategori adı gerekli!', 'error'); return; }
    const id = ad.toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_');
    if (cats.find(c => c.id === id)) { showToast('Bu ID zaten var!', 'error'); return; }
    const nowIso = new Date().toISOString();
    save(prev => ({
      ...prev,
      productCategories: [...(prev.productCategories || []), { id, name: ad, icon: yeniIcon, createdAt: nowIso }],
    }));
    setYeniAd(''); setYeniIcon('📦');
    showToast('Kategori eklendi!', 'success');
  };

  const saveEdit = (id: string) => {
    if (!editForm.name.trim()) { showToast('Ad gerekli!', 'error'); return; }
    save(prev => ({
      ...prev,
      productCategories: (prev.productCategories || []).map(c =>
        c.id === id ? { ...c, name: editForm.name.trim(), icon: editForm.icon || c.icon } : c
      ),
    }));
    setEditId(null);
    showToast('Güncellendi!', 'success');
  };

  const deleteKat = (id: string) => {
    const used = db.products.filter(p => !p.deleted && p.category === id).length;
    if (used > 0) { showToast(`${used} ürün bu kategoriyi kullanıyor, silemezsiniz!`, 'error'); return; }
    showConfirm('Kategori Sil', 'Bu kategoriyi silmek istiyor musunuz?', () => {
      save(prev => ({ ...prev, productCategories: (prev.productCategories || []).filter(c => c.id !== id) }));
      showToast('Kategori silindi!', 'success');
    });
  };

  return (
    <Card title="🏷️ Ürün Kategorileri">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {cats.length === 0 && (
          <div style={{ color: '#475569', textAlign: 'center', padding: 24, fontSize: '0.88rem' }}>Henüz kategori yok</div>
        )}
        {cats.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {editId === c.id ? (
              <>
                <input value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))} style={{ ...inp, width: 48, textAlign: 'center', fontSize: '1.1rem', padding: '6px' }} maxLength={2} />
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={{ ...inp, flex: 1, padding: '7px 10px' }} autoFocus />
                <button onClick={() => saveEdit(c.id)} style={{ background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>✓</button>
                <button onClick={() => setEditId(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#94a3b8', padding: '6px 10px', cursor: 'pointer' }}>✕</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.4rem', minWidth: 28, textAlign: 'center' }}>{c.icon}</span>
                <span style={{ flex: 1, color: '#f1f5f9', fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: '#334155', fontSize: '0.75rem', fontFamily: 'monospace' }}>{c.id}</span>
                <span style={{ color: '#475569', fontSize: '0.78rem' }}>{db.products.filter(p => !p.deleted && p.category === c.id).length} ürün</span>
                <button onClick={() => { setEditId(c.id); setEditForm({ name: c.name, icon: c.icon }); }} style={{ background: 'rgba(59,130,246,0.12)', border: 'none', borderRadius: 8, color: '#60a5fa', padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                <button onClick={() => deleteKat(c.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, color: '#ef4444', padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️</button>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={yeniIcon} onChange={e => setYeniIcon(e.target.value)} style={{ ...inp, width: 52, textAlign: 'center', fontSize: '1.2rem' }} placeholder="📦" maxLength={2} />
        <input value={yeniAd} onChange={e => setYeniAd(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKat()} style={{ ...inp, flex: 1 }} placeholder="Yeni kategori adı..." />
        <button onClick={addKat} style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #ff5722, #ff7043)', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>+ Ekle</button>
      </div>
      <p style={{ color: '#334155', fontSize: '0.75rem', marginTop: 10 }}>Ürünleri kullanan kategoriler silinemez.</p>
    </Card>
  );
}
