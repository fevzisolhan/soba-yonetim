import { useState, useMemo, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { useDB, onSyncStatus, type SyncStatus } from '@/hooks/useDB';
import { useToast } from '@/components/Toast';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { Toaster } from 'sonner';
import LoginScreen, { useAuth } from '@/components/LoginScreen';
import SetupWizard, { isSetupDone, getSetupData } from '@/components/SetupWizard';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Sales from '@/pages/Sales';
import Suppliers from '@/pages/Suppliers';
import Cari from '@/pages/Cari';
import Kasa from '@/pages/Kasa';
import Bank from '@/pages/Bank';
import Reports from '@/pages/Reports';
import Stock from '@/pages/Stock';
import Monitor from '@/pages/Monitor';
import Partners from '@/pages/Partners';
import Settings from '@/pages/Settings';
import AIAsistan from '@/pages/AIAsistan';
import Fatura from '@/pages/Fatura';
import Entegrasyonlar from '@/pages/Entegrasyonlar';
import Butce from '@/pages/Butce';
import KontrolHalkasi from '@/pages/KontrolHalkasi';
import Pelet from '@/pages/Pelet';
import BoruTed from '@/pages/BoruTed';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { formatMoney, genId } from '@/lib/utils-tr';
import { Modal } from '@/components/Modal';
import NotificationCenter from '@/components/NotificationCenter';

function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
    },
    () => navigator.onLine,
    () => true,
  );
}

const TABS = [
  { id: 'dashboard', label: 'Özet', icon: '📊', group: 'Ana' },
  { id: 'products', label: 'Ürünler', icon: '📦', group: 'Ana' },
  { id: 'sales', label: 'Satış', icon: '🛒', group: 'Ana' },
  { id: 'fatura', label: 'Fatura', icon: '🧾', group: 'Ana' },
  { id: 'suppliers', label: 'Tedarikçi', icon: '🏭', group: 'Tedarik' },
  { id: 'pelet', label: 'Pelet', icon: '🪵', group: 'Tedarik' },
  { id: 'boruTed', label: 'Boru Tedarik', icon: '🔩', group: 'Tedarik' },
  { id: 'cari', label: 'Cari', icon: '👤', group: 'Finans' },
  { id: 'kasa', label: 'Kasa', icon: '💰', group: 'Finans' },
  { id: 'butce', label: 'Bütçe', icon: '📊', group: 'Finans' },
  { id: 'bank', label: 'Banka', icon: '🏦', group: 'Finans' },
  { id: 'reports', label: 'Raporlar', icon: '📈', group: 'Analiz' },
  { id: 'stock', label: 'Stok', icon: '🔢', group: 'Analiz' },
  { id: 'monitor', label: 'İzleme', icon: '🔔', group: 'Analiz' },
  { id: 'kontrol', label: 'Kontrol', icon: '⚡', group: 'Analiz' },
  { id: 'entegrasyon', label: 'Entegrasyon', icon: '🔗', group: 'Sistem' },
  { id: 'partners', label: 'Ortaklar', icon: '🤝', group: 'Sistem' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️', group: 'Sistem' },
] as const;

type TabId = typeof TABS[number]['id'];

// Quick action modal for FAB
function QuickSaleModal({ db, save, onClose }: { db: ReturnType<typeof useDB>['db']; save: ReturnType<typeof useDB>['save']; onClose: () => void }) {
  const { showToast } = useToast();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<'nakit' | 'kart' | 'havale' | 'cari'>('nakit');
  const [discount, setDiscount] = useState(0);

  const product = db.products.find(p => p.id === productId);
  const subtotal = product ? product.price * qty : 0;
  const total = Math.max(0, subtotal - discount);
  const profit = product ? (product.price - product.cost) * qty - discount : 0;

  const handleSave = () => {
    if (!product) { showToast('Ürün seçin!', 'error'); return; }
    if (product.stock < qty) { showToast(`Stok yetersiz! Mevcut: ${product.stock}`, 'error'); return; }
    const nowIso = new Date().toISOString();
    const sale = {
      id: genId(), productId: product.id, productName: product.name, productCategory: product.category,
      quantity: qty, unitPrice: product.price, cost: product.cost, discount, discountAmount: discount,
      subtotal, total, profit, payment, status: 'tamamlandi' as const,
      items: [{ productId: product.id, productName: product.name, quantity: qty, unitPrice: product.price, cost: product.cost, total }],
      createdAt: nowIso, updatedAt: nowIso,
    };
    save(prev => ({
      ...prev,
      sales: [...prev.sales, sale],
      products: prev.products.map(p => p.id === productId ? { ...p, stock: p.stock - qty } : p),
      kasa: payment !== 'cari' ? [...prev.kasa, { id: genId(), type: 'gelir' as const, category: 'satis', amount: total, kasa: payment === 'nakit' ? 'nakit' : 'banka', description: `Hızlı Satış: ${product.name}`, relatedId: sale.id, createdAt: nowIso, updatedAt: nowIso }] : prev.kasa,
    }));
    showToast(`✅ Satış kaydedildi! ${formatMoney(total)}`, 'success');
    onClose();
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label style={fLbl}>Ürün *</label>
        <select value={productId} onChange={e => setProductId(e.target.value)} style={fInp}>
          <option value="">-- Ürün Seç --</option>
          {db.products.filter(p => !p.deleted && p.stock > 0).map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock}, ₺{p.price})</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={fLbl}>Adet</label><input type="number" value={qty} min={1} max={product?.stock || 999} onChange={e => setQty(parseInt(e.target.value) || 1)} style={fInp} /></div>
        <div><label style={fLbl}>İskonto (₺)</label><input type="number" value={discount} min={0} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} style={fInp} /></div>
      </div>
      <div>
        <label style={fLbl}>Ödeme</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['nakit', 'kart', 'havale', 'cari'] as const).map(p => (
            <button key={p} onClick={() => setPayment(p)} style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', background: payment === p ? '#ff5722' : 'rgba(255,255,255,0.05)', color: payment === p ? '#fff' : '#64748b' }}>{p}</button>
          ))}
        </div>
      </div>
      {product && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Row label="Ara Toplam" value={formatMoney(subtotal)} />
          {discount > 0 && <Row label="İskonto" value={`-${formatMoney(discount)}`} color="#ef4444" />}
          <Row label="TOPLAM" value={formatMoney(total)} color="#10b981" big />
          <Row label="Kâr" value={formatMoney(profit)} color={profit >= 0 ? '#10b981' : '#ef4444'} />
        </div>
      )}
      <button onClick={handleSave} style={{ background: 'linear-gradient(135deg, #ff5722, #ff7043)', border: 'none', borderRadius: 12, color: '#fff', padding: '13px 0', fontWeight: 800, cursor: 'pointer', fontSize: '1rem', letterSpacing: '-0.01em' }}>
        🛒 Hızlı Satış — {formatMoney(total)}
      </button>
    </div>
  );
}

function QuickIncomeModal({ db, save, onClose, type }: { db: ReturnType<typeof useDB>['db']; save: ReturnType<typeof useDB>['save']; onClose: () => void; type: 'gelir' | 'gider' }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [kasa, setKasa] = useState('nakit');
  const [category, setCategory] = useState('');

  const kasalar = db.kasalar || [{ id: 'nakit', name: 'Nakit', icon: '💵' }, { id: 'banka', name: 'Banka', icon: '🏦' }];

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast('Geçerli tutar girin!', 'error'); return; }
    const nowIso = new Date().toISOString();
    save(prev => ({ ...prev, kasa: [...prev.kasa, { id: genId(), type, category: category || (type === 'gelir' ? 'diger_gelir' : 'diger_gider'), amount: amt, kasa, description, createdAt: nowIso, updatedAt: nowIso }] }));
    showToast(`${type === 'gelir' ? 'Gelir' : 'Gider'} kaydedildi!`, 'success');
    onClose();
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><label style={fLbl}>Tutar (₺) *</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={fInp} placeholder="0,00" autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fLbl}>Kasa</label>
          <select value={kasa} onChange={e => setKasa(e.target.value)} style={fInp}>
            {kasalar.map(k => <option key={k.id} value={k.id}>{k.icon} {k.name}</option>)}
          </select>
        </div>
        <div><label style={fLbl}>Kategori</label><input value={category} onChange={e => setCategory(e.target.value)} style={fInp} placeholder="opsiyonel" /></div>
      </div>
      <div><label style={fLbl}>Açıklama</label><input value={description} onChange={e => setDescription(e.target.value)} style={fInp} placeholder="Açıklama..." /></div>
      <button onClick={handleSave} style={{ background: type === 'gelir' ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #dc2626, #ef4444)', border: 'none', borderRadius: 12, color: '#fff', padding: '13px 0', fontWeight: 800, cursor: 'pointer', fontSize: '1rem' }}>
        💾 {type === 'gelir' ? 'Gelir Kaydet' : 'Gider Kaydet'}
      </button>
    </div>
  );
}

function QuickProductModal({ db, save, onClose }: { db: ReturnType<typeof useDB>['db']; save: ReturnType<typeof useDB>['save']; onClose: () => void }) {
  const { showToast } = useToast();
  const cats = db.productCategories || [];
  const defaultCat = cats[0]?.id || 'soba';
  const [form, setForm] = useState({ name: '', category: defaultCat, cost: '', price: '', stock: '', minStock: '5' });

  const handleSave = () => {
    if (!form.name || !form.price) { showToast('Ad ve fiyat zorunlu!', 'error'); return; }
    const nowIso = new Date().toISOString();
    save(prev => ({ ...prev, products: [...prev.products, { id: genId(), name: form.name, category: form.category as any, cost: parseFloat(form.cost) || 0, price: parseFloat(form.price) || 0, stock: parseInt(form.stock) || 0, minStock: parseInt(form.minStock) || 5, createdAt: nowIso, updatedAt: nowIso }] }));
    showToast('Ürün eklendi!', 'success');
    onClose();
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><label style={fLbl}>Ürün Adı *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={fInp} autoFocus /></div>
      <div>
        <label style={fLbl}>Kategori</label>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={fInp}>
          {cats.length > 0
            ? cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)
            : [['soba','🔥 Soba'],['aksesuar','🔧 Aksesuar'],['yedek','⚙️ Yedek Parça'],['boru','🔩 Boru'],['pelet','🪵 Pelet']].map(([v,l]) => <option key={v} value={v}>{l}</option>)
          }
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={fLbl}>Alış (₺)</label><input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} style={fInp} /></div>
        <div><label style={fLbl}>Satış (₺) *</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={fInp} /></div>
        <div><label style={fLbl}>Stok</label><input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} style={fInp} /></div>
        <div><label style={fLbl}>Min. Stok</label><input type="number" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} style={fInp} /></div>
      </div>
      <button onClick={handleSave} style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', borderRadius: 12, color: '#fff', padding: '13px 0', fontWeight: 800, cursor: 'pointer', fontSize: '1rem' }}>📦 Ürün Ekle</button>
    </div>
  );
}

function GlobalSearch({ onNavigate, db }: { onNavigate: (tab: TabId) => void; db: ReturnType<typeof useDB>['db'] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const res: { tab: TabId; label: string; icon: string; match: string }[] = [];
    TABS.forEach(t => { if (t.label.toLowerCase().includes(q)) res.push({ tab: t.id, label: t.label, icon: t.icon, match: 'Modül' }); });
    db.products.filter(p => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)).slice(0, 3).forEach(p => res.push({ tab: 'products', label: p.name, icon: '📦', match: `Stok: ${p.stock} · ₺${p.price}` }));
    db.cari.filter(c => c.name.toLowerCase().includes(q)).slice(0, 3).forEach(c => res.push({ tab: 'cari', label: c.name, icon: '👤', match: c.type === 'musteri' ? 'Müşteri' : 'Tedarikçi' }));
    db.suppliers.filter(s => s.name.toLowerCase().includes(q)).slice(0, 2).forEach(s => res.push({ tab: 'suppliers', label: s.name, icon: '🏭', match: 'Tedarikçi' }));
    return res.slice(0, 8);
  }, [query, db]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#334155', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Ürün, müşteri, modül ara..." style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
        {query && <button onClick={() => { setQuery(''); setOpen(false); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#0f1e35', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, zIndex: 200, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
          {results.map((r, i) => (
            <button key={i} onClick={() => { onNavigate(r.tab); setQuery(''); setOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', color: '#f1f5f9', cursor: 'pointer', textAlign: 'left', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,87,34,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}>
              <span style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>{r.match}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FAB({ db, save, onOpenAI }: { db: ReturnType<typeof useDB>['db']; save: ReturnType<typeof useDB>['save']; onOpenAI: () => void }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<'sale' | 'gelir' | 'gider' | 'product' | null>(null);

  const actions = [
    { id: 'sale' as const, label: 'Hızlı Satış', icon: '🛒', color: '#ff5722' },
    { id: 'product' as const, label: 'Ürün Ekle', icon: '📦', color: '#3b82f6' },
    { id: 'gelir' as const, label: 'Gelir Ekle', icon: '💚', color: '#10b981' },
    { id: 'gider' as const, label: 'Gider Ekle', icon: '🔴', color: '#ef4444' },
  ];

  const titles: Record<string, string> = { sale: '🛒 Hızlı Satış', gelir: '💚 Hızlı Gelir', gider: '🔴 Hızlı Gider', product: '📦 Hızlı Ürün Ekle' };

  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />}
      {/* AI Floating Button — sol alt */}
      <button
        onClick={onOpenAI}
        title="AI Asistan"
        style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 150, width: 52, height: 52, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 28px rgba(99,102,241,0.5)', transition: 'transform 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        🤖
      </button>
      <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {open && actions.map((a, i) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, animation: `slideUp 0.2s ease ${i * 0.04}s both` }}>
            <div style={{ background: 'rgba(10,17,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', backdropFilter: 'blur(8px)' }}>{a.label}</div>
            <button onClick={() => { setModal(a.id); setOpen(false); }} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${a.color}, ${a.color}cc)`, color: '#fff', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px ${a.color}50` }}>
              {a.icon}
            </button>
          </div>
        ))}
        <button onClick={() => setOpen(o => !o)} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #ff5722, #ff8c42)', color: '#fff', cursor: 'pointer', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 28px rgba(255,87,34,0.5)', transition: 'all 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0)' }}>
          +
        </button>
      </div>

      {modal && (
        <Modal open={true} onClose={() => setModal(null)} title={titles[modal] || ''} maxWidth={480}>
          {modal === 'sale' && <QuickSaleModal db={db} save={save} onClose={() => setModal(null)} />}
          {modal === 'gelir' && <QuickIncomeModal db={db} save={save} onClose={() => setModal(null)} type="gelir" />}
          {modal === 'gider' && <QuickIncomeModal db={db} save={save} onClose={() => setModal(null)} type="gider" />}
          {modal === 'product' && <QuickProductModal db={db} save={save} onClose={() => setModal(null)} />}
        </Modal>
      )}
    </>
  );
}

// ── AI Drawer ──
function AIDrawer({ open, onClose, db }: { open: boolean; onClose: () => void; db: ReturnType<typeof useDB>['db'] }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(5,10,20,0.65)', backdropFilter: 'blur(6px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />
      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 100vw)', zIndex: 1101,
        background: 'linear-gradient(160deg, #0d1b30 0%, #0a1422 100%)',
        borderLeft: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
        visibility: open ? 'visible' : 'hidden',
      }}>
        {/* Drawer header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid rgba(99,102,241,0.15)', flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', flexShrink: 0 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.95rem' }}>Soba AI Asistan</div>
            <div style={{ color: '#475569', fontSize: '0.72rem' }}>Claude · Gemini · Çevrimdışı</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b', cursor: 'pointer', width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
          >×</button>
        </div>
        {/* AIAsistan content — her zaman mount, sadece visibility değişir (konuşma korunur) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <AIAsistan db={db} embedded />
        </div>
      </div>
    </>
  );
}

// Grup renkleri
const GROUP_COLORS: Record<string, { text: string; bg: string; glow: string }> = {
  Ana:     { text: '#ff7043', bg: 'rgba(255,87,34,0.12)',  glow: 'rgba(255,87,34,0.35)' },
  Tedarik: { text: '#34d399', bg: 'rgba(52,211,153,0.12)', glow: 'rgba(52,211,153,0.3)' },
  Finans:  { text: '#60a5fa', bg: 'rgba(96,165,250,0.12)', glow: 'rgba(96,165,250,0.3)' },
  Analiz:  { text: '#a78bfa', bg: 'rgba(167,139,250,0.12)', glow: 'rgba(167,139,250,0.3)' },
  Sistem:  { text: '#94a3b8', bg: 'rgba(148,163,184,0.08)', glow: 'rgba(148,163,184,0.2)' },
};

function AppContent() {
  const { db, save, exportJSON, importJSON } = useDB();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const isOnline = useOnlineStatus();
  const prevOnline = useRef(isOnline);
  const { showToast } = useToast();

  // Sync durum izleme
  useEffect(() => {
    const unsub = onSyncStatus((status, detail) => {
      setSyncStatus(status);
      if (status === 'saved') setLastSyncTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
      if (status === 'error' && detail) console.warn('[sync]', detail);
    });
    return unsub;
  }, []);

  // İlk kurulum verisini DB'ye yaz (bir kez)
  useEffect(() => {
    const setup = getSetupData();
    if (!setup) return;
    const applied = localStorage.getItem('sobaYonetim_setupApplied');
    if (applied) return;
    save(prev => {
      const now = new Date().toISOString();
      // Kasalar
      const kasalar = setup.kasalar.length > 0 ? setup.kasalar : prev.kasalar;
      // Ürünler
      const mevcutIds = new Set(prev.products.map((p: {id:string}) => p.id));
      const yeniUrunler = (setup.urunler || []).filter((u: {id:string}) => !mevcutIds.has(u.id));
      const products = [...prev.products, ...yeniUrunler];
      // Ortaklar
      const mevcutOrtakIds = new Set(((prev as any).partners || []).map((p: {id:string}) => p.id));
      const yeniOrtaklar = (setup.ortaklar || []).filter((o: {id:string}) => !mevcutOrtakIds.has(o.id));
      const partners = [...((prev as any).partners || []), ...yeniOrtaklar];
      // Ortak carileri
      const mevcutCariIds = new Set(prev.cari.map((c: {id:string}) => c.id));
      const yeniCariOrtaklar = (setup.cariOrtaklar || []).filter((c: {id:string}) => !mevcutCariIds.has(c.id));
      const cari = [...prev.cari, ...yeniCariOrtaklar];
      // Settings
      const settings = { ...prev.settings, companyName: setup.companyName, city: setup.city };
      // Kategoriler
      const mevcutKatIds = new Set((prev.productCategories || []).map((k: {id:string}) => k.id));
      const yeniKategoriler = (setup.kategoriler || []).filter((k: {id:string}) => !mevcutKatIds.has(k.id));
      const productCategories = [...(prev.productCategories || []), ...yeniKategoriler];
      return { ...prev, kasalar, products, partners, cari, settings, productCategories };
    });
    localStorage.setItem('sobaYonetim_setupApplied', '1');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevOnline.current !== isOnline) {
      if (isOnline) {
        showToast('İnternet bağlantısı yeniden kuruldu', 'success');
      } else {
        showToast('Çevrimdışı çalışıyorsunuz — veriler korunuyor', 'info' as any);
      }
      prevOnline.current = isOnline;
    }
  }, [isOnline, showToast]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navigate = useCallback((tab: TabId) => { setActiveTab(tab); setSidebarOpen(false); }, []);

  const badges = useMemo(() => ({
    products: db.products.filter(p => !p.deleted && p.stock === 0).length + db.products.filter(p => !p.deleted && p.stock > 0 && p.stock <= p.minStock).length,
    sales: db.sales.filter(s => s.status === 'tamamlandi' && new Date(s.createdAt).toDateString() === new Date().toDateString()).length,
    suppliers: db.orders.filter(o => o.status === 'bekliyor').length,
    bank: db.bankTransactions.filter(t => t.status === 'unmatched').length,
    monitor: db.monitorRules.filter(r => r.active).reduce((c, r) => {
      if (r.type === 'stok_sifir' && db.products.some(p => !p.deleted && p.stock === 0)) return c + 1;
      if (r.type === 'stok_min' && db.products.some(p => !p.deleted && p.stock > 0 && p.stock <= p.minStock)) return c + 1;
      return c;
    }, 0),
  }), [db]);

  const totalKasa = useMemo(() => db.kasa.filter(k => !k.deleted).reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0), [db.kasa]);
  const nakit = useMemo(() => db.kasa.filter(k => !k.deleted && k.kasa === 'nakit').reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0), [db.kasa]);
  const groups = ['Ana', 'Tedarik', 'Finans', 'Analiz', 'Sistem'];

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const map: Record<string, TabId> = { '1': 'dashboard', '2': 'products', '3': 'sales', '4': 'kasa', '5': 'reports' };
        if (map[e.key]) { e.preventDefault(); navigate(map[e.key]); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070e1c', color: '#f1f5f9', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99, backdropFilter: 'blur(4px)' }} />}
      {/* SIDEBAR */}
      <aside style={{
        width: 236, minHeight: '100vh',
        background: 'linear-gradient(180deg, #05101f 0%, #070d1c 60%, #060b18 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', left: isMobile && !sidebarOpen ? -248 : 0,
        top: 0, bottom: 0, zIndex: 100,
        transition: 'left 0.28s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '4px 0 30px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 14px 13px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, flexShrink: 0,
              background: 'linear-gradient(135deg, #ff5722, #ff8c42)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.15rem',
              boxShadow: '0 4px 20px rgba(255,87,34,0.45), 0 0 0 6px rgba(255,87,34,0.06)',
              animation: 'sidebarLogoPulse 4s ease-in-out infinite',
            }}>🔥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.94rem', letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Soba Yönetim</div>
              <div style={{ color: '#1e3a5f', fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 1 }}>Sistemi · v2.0</div>
            </div>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, color: '#475569', cursor: 'pointer', padding: '6px 8px', fontSize: '1rem', transition: 'all 0.15s', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}>✕</button>
            )}
          </div>
        </div>

        {/* NAV */}
        <nav style={{ flex: 1, padding: '8px 7px', overflowY: 'auto', overflowX: 'hidden' }}>
          {groups.map(group => {
            const gc = GROUP_COLORS[group] || GROUP_COLORS['Sistem'];
            return (
              <div key={group} style={{ marginBottom: 6 }}>
                <div style={{
                  padding: '8px 10px 4px',
                  color: gc.text,
                  fontSize: '0.6rem', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  opacity: 0.7,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${gc.text}30, transparent)` }} />
                  {group}
                  <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${gc.text}30)` }} />
                </div>
                {TABS.filter(t => t.group === group).map(tab => {
                  const badge = badges[tab.id as keyof typeof badges];
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => navigate(tab.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                        padding: '9px 10px', border: 'none', borderRadius: 10,
                        cursor: 'pointer', marginBottom: 1,
                        background: isActive ? gc.bg : 'transparent',
                        color: isActive ? gc.text : '#3d5166',
                        fontWeight: isActive ? 700 : 400,
                        fontSize: '0.845rem',
                        transition: 'all 0.18s cubic-bezier(0.22,1,0.36,1)',
                        borderLeft: isActive ? `2.5px solid ${gc.text}` : '2.5px solid transparent',
                        outline: 'none', textAlign: 'left',
                        boxShadow: isActive ? `inset 0 0 0 1px ${gc.text}18, 0 2px 12px ${gc.glow}` : 'none',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = 'rgba(255,255,255,0.03)';
                          el.style.color = '#94a3b8';
                          el.style.borderLeft = `2.5px solid rgba(255,255,255,0.06)`;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = 'transparent';
                          el.style.color = '#3d5166';
                          el.style.borderLeft = '2.5px solid transparent';
                        }
                      }}
                    >
                      {/* İkon arka planı */}
                      <span style={{
                        width: 26, height: 26, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 7, fontSize: '0.88rem',
                        background: isActive ? gc.bg : 'transparent',
                        transition: 'all 0.18s',
                        filter: isActive ? 'none' : 'grayscale(40%)',
                      }}>{tab.icon}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
                      {badge ? (
                        <span style={{
                          background: (tab.id === 'products' || tab.id === 'monitor') ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #d97706, #f59e0b)',
                          color: '#fff', borderRadius: 20,
                          minWidth: 19, height: 17, padding: '0 4px',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.62rem', fontWeight: 900, letterSpacing: '-0.01em',
                          boxShadow: (tab.id === 'products' || tab.id === 'monitor')
                            ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(245,158,11,0.4)',
                          animation: 'badgePulse 2.5s ease-in-out infinite',
                          flexShrink: 0,
                        }}>{badge > 99 ? '99+' : badge}</span>
                      ) : null}
                      {/* Aktif gösterge çizgisi */}
                      {isActive && (
                        <span style={{
                          position: 'absolute', right: 0, top: '20%', bottom: '20%',
                          width: 2, borderRadius: 2,
                          background: `linear-gradient(180deg, transparent, ${gc.text}, transparent)`,
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Kasa Widget */}
        <div
          onClick={() => navigate('kasa')}
          style={{
            margin: '0 7px 7px', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.09) 0%, rgba(16,185,129,0.02) 100%)',
            border: '1px solid rgba(16,185,129,0.13)',
            borderRadius: 12, padding: '10px 12px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(16,185,129,0.05))';
            el.style.boxShadow = '0 4px 20px rgba(16,185,129,0.15)';
            el.style.borderColor = 'rgba(16,185,129,0.25)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.09), rgba(16,185,129,0.02))';
            el.style.boxShadow = 'none';
            el.style.borderColor = 'rgba(16,185,129,0.13)';
          }}
        >
          <div style={{ color: '#065f46', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>💰</span>
            <span>Toplam Kasa</span>
            <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block' }} />
          </div>
          <div style={{ fontSize: '1.18rem', fontWeight: 900, color: totalKasa >= 0 ? '#10b981' : '#ef4444', letterSpacing: '-0.025em', lineHeight: 1 }}>
            {formatMoney(totalKasa)}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 7 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#064e3b', fontSize: '0.59rem', marginBottom: 2 }}>Nakit</div>
              <div style={{ color: '#6ee7b7', fontSize: '0.78rem', fontWeight: 700 }}>{formatMoney(nakit)}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(16,185,129,0.12)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#064e3b', fontSize: '0.59rem', marginBottom: 2 }}>Banka</div>
              <div style={{ color: '#6ee7b7', fontSize: '0.78rem', fontWeight: 700 }}>{formatMoney(totalKasa - nakit)}</div>
            </div>
          </div>
        </div>

        {/* Alt durum çubuğu */}
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          {/* Online/offline + sync durumu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: isOnline ? '#10b981' : '#f59e0b',
              display: 'inline-block',
              boxShadow: isOnline ? '0 0 8px #10b981' : '0 0 8px #f59e0b',
              animation: isOnline ? 'onlinePulse 3s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color: isOnline ? '#10b981' : '#f59e0b', fontSize: '0.64rem', fontWeight: 700, flex: 1 }}>
              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            </span>
            {/* Sync durumu */}
            <span style={{
              fontSize: '0.6rem', fontWeight: 600,
              color: syncStatus === 'saved' ? '#10b981'
                : syncStatus === 'saving' ? '#f59e0b'
                : syncStatus === 'error' ? '#ef4444'
                : '#1e3a5f',
            }}>
              {syncStatus === 'saving' ? '⟳ Senkronize…'
                : syncStatus === 'saved' ? `✓ ${lastSyncTime}`
                : syncStatus === 'error' ? '✗ Hata'
                : syncStatus === 'loading' ? '↓ Yüklüyor'
                : ''}
            </span>
          </div>
          <div style={{ color: '#0f2235', fontSize: '0.58rem', textAlign: 'center' }}>🔒 Firebase & localStorage · Güvenli</div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ width: isMobile ? '100vw' : 'calc(100vw - 236px)', marginLeft: isMobile ? 0 : 236, display: 'flex', flexDirection: 'column', minHeight: '100vh', transition: 'margin-left 0.28s cubic-bezier(0.22,1,0.36,1)', boxSizing: 'border-box' }}>
        {/* HEADER */}
        <header style={{
          background: 'rgba(5,12,26,0.96)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: isMobile ? '10px 14px' : '10px 22px',
          display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
          position: 'sticky', top: 0, zIndex: 90,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, color: '#f1f5f9', padding: '8px 10px', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,87,34,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >☰</button>
          )}
          {/* Sayfa başlığı */}
          <div style={{ minWidth: isMobile ? 0 : 140, flex: isMobile ? 1 : undefined }}>
            <h1 style={{
              fontWeight: 800, fontSize: isMobile ? '0.9rem' : '1rem',
              color: '#f1f5f9', margin: 0, letterSpacing: '-0.015em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{
                width: 28, height: 28, background: (() => {
                  const gc = GROUP_COLORS[TABS.find(t => t.id === activeTab)?.group || 'Sistem'];
                  return gc.bg;
                })(),
                borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', flexShrink: 0,
              }}>{TABS.find(t => t.id === activeTab)?.icon}</span>
              {TABS.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          {!isMobile && <GlobalSearch onNavigate={navigate} db={db} />}
          <div style={{ display: 'flex', gap: isMobile ? 4 : 6, alignItems: 'center', flexShrink: 0 }}>
            {/* Kısayollar */}
            {!isMobile && (
              <div style={{ display: 'flex', gap: 3 }}>
                {[{ k: '⌘1', t: 'dashboard', label: 'Özet' }, { k: '⌘2', t: 'products', label: 'Ürün' }, { k: '⌘3', t: 'sales', label: 'Satış' }, { k: '⌘4', t: 'kasa', label: 'Kasa' }].map(s => (
                  <button
                    key={s.k}
                    onClick={() => navigate(s.t as TabId)}
                    title={`${s.label} (Ctrl+${s.k.replace('⌘', '')})`}
                    style={{
                      background: activeTab === s.t ? 'rgba(255,87,34,0.14)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${activeTab === s.t ? 'rgba(255,87,34,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 6, color: activeTab === s.t ? '#ff7043' : '#2d4059',
                      padding: '4px 7px', cursor: 'pointer', fontSize: '0.67rem', fontWeight: 700,
                      transition: 'all 0.15s',
                      boxShadow: activeTab === s.t ? '0 0 10px rgba(255,87,34,0.2)' : 'none',
                    }}
                    onMouseEnter={e => { if (activeTab !== s.t) (e.currentTarget.style.color = '#64748b'); }}
                    onMouseLeave={e => { if (activeTab !== s.t) (e.currentTarget.style.color = '#2d4059'); }}
                  >{s.k}</button>
                ))}
              </div>
            )}
            {/* Akıllı Bildirim Merkezi */}
            <NotificationCenter db={db} onNavigate={navigate} />
            {/* Uyarı bildirimleri */}
            {badges.monitor > 0 && (
              <button
                onClick={() => navigate('monitor')}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', padding: '5px 10px', cursor: 'pointer', fontSize: '0.77rem', fontWeight: 700, transition: 'all 0.15s', animation: 'badgePulse 2.5s ease-in-out infinite' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
              >🔔 {badges.monitor}</button>
            )}
            {!isMobile && badges.products > 0 && (
              <button
                onClick={() => navigate('products')}
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.14)', borderRadius: 8, color: '#fca5a5', padding: '5px 10px', cursor: 'pointer', fontSize: '0.77rem', fontWeight: 600, transition: 'all 0.15s' }}
              >📦 {badges.products}</button>
            )}
            {/* Sync göstergesi */}
            {!isMobile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 9px', borderRadius: 7,
                background: syncStatus === 'saving' ? 'rgba(245,158,11,0.08)'
                  : syncStatus === 'error' ? 'rgba(239,68,68,0.08)'
                  : 'transparent',
                border: syncStatus === 'saving' ? '1px solid rgba(245,158,11,0.15)'
                  : syncStatus === 'error' ? '1px solid rgba(239,68,68,0.15)'
                  : '1px solid transparent',
                transition: 'all 0.3s',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                  background: syncStatus === 'saved' ? '#10b981'
                    : syncStatus === 'saving' ? '#f59e0b'
                    : syncStatus === 'error' ? '#ef4444'
                    : syncStatus === 'loading' ? '#60a5fa'
                    : '#1e3a5f',
                  boxShadow: syncStatus === 'saved' ? '0 0 6px #10b981'
                    : syncStatus === 'saving' ? '0 0 6px #f59e0b'
                    : 'none',
                  animation: syncStatus === 'saving' ? 'onlinePulse 1s ease-in-out infinite' : 'none',
                }} />
                <span style={{
                  fontSize: '0.67rem', fontWeight: 600,
                  color: syncStatus === 'saved' ? '#10b981'
                    : syncStatus === 'saving' ? '#f59e0b'
                    : syncStatus === 'error' ? '#ef4444'
                    : '#1e3a5f',
                }}>
                  {syncStatus === 'saving' ? 'Kaydediliyor'
                    : syncStatus === 'saved' ? `Senkron ${lastSyncTime}`
                    : syncStatus === 'error' ? 'Sync Hatası'
                    : syncStatus === 'loading' ? 'Yükleniyor'
                    : 'Firebase'}
                </span>
              </div>
            )}
            <button
              onClick={exportJSON}
              title="Hızlı Yedek Al"
              style={{ background: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 8, color: '#60a5fa', padding: '5px 10px', cursor: 'pointer', fontSize: '0.77rem', fontWeight: 700, transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.09)')}
            >{isMobile ? '💾' : '💾 Yedek'}</button>
            {!isMobile && (
              <div style={{ color: '#1e3a5f', fontSize: '0.73rem', fontWeight: 500, whiteSpace: 'nowrap', padding: '0 4px' }}>
                {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <main key={activeTab} className="page-enter" style={{ flex: 1, padding: isMobile ? '14px 10px' : '20px 22px', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {activeTab === 'dashboard' && <Dashboard db={db} onTabChange={(tab) => navigate(tab as TabId)} />}
          {activeTab === 'products' && <Products db={db} save={save} />}
          {activeTab === 'sales' && <Sales db={db} save={save} />}
          {activeTab === 'fatura' && <Fatura db={db} save={save} />}
          {activeTab === 'suppliers' && <Suppliers db={db} save={save} />}
          {activeTab === 'pelet' && <Pelet db={db} save={save} />}
          {activeTab === 'boruTed' && <BoruTed db={db} save={save} />}
          {activeTab === 'cari' && <Cari db={db} save={save} />}
          {activeTab === 'kasa' && <Kasa db={db} save={save} />}
          {activeTab === 'butce' && <Butce db={db} save={save} />}
          {activeTab === 'bank' && <Bank db={db} save={save} />}
          {activeTab === 'reports' && <Reports db={db} />}
          {activeTab === 'stock' && <Stock db={db} save={save} />}
          {activeTab === 'monitor' && <Monitor db={db} save={save} />}
          {activeTab === 'kontrol' && <KontrolHalkasi db={db} />}
          {activeTab === 'entegrasyon' && <Entegrasyonlar db={db} />}
          {activeTab === 'partners' && <Partners db={db} save={save} />}
          {activeTab === 'settings' && <Settings db={db} save={save} exportJSON={exportJSON} importJSON={importJSON} />}
        </main>
      </div>

      {/* FAB */}
      <FAB db={db} save={save} onOpenAI={() => setAiDrawerOpen(true)} />

      {/* AI Drawer */}
      <AIDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} db={db} />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070e1c; }
        input, select, textarea, button { outline: none; font-family: inherit; }
        input:focus, select:focus, textarea:focus { border-color: rgba(255,87,34,0.5) !important; box-shadow: 0 0 0 3px rgba(255,87,34,0.12) !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.13); }
        nav::-webkit-scrollbar { width: 0; }

        /* ── Animasyonlar ── */
        @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp  { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn  { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scaleIn  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        @keyframes badgePulse {
          0%,100% { box-shadow: 0 0 6px rgba(239,68,68,0.4); }
          50%      { box-shadow: 0 0 14px rgba(239,68,68,0.7); }
        }
        @keyframes onlinePulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(0.8); }
        }
        @keyframes sidebarLogoPulse {
          0%,100% { box-shadow: 0 4px 20px rgba(255,87,34,0.45), 0 0 0 6px rgba(255,87,34,0.06); }
          50%      { box-shadow: 0 6px 28px rgba(255,87,34,0.65), 0 0 0 8px rgba(255,87,34,0.1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Sayfa geçiş animasyonu */
        .page-enter { animation: scaleIn 0.22s cubic-bezier(0.22,1,0.36,1); }

        /* Sonner toast özelleştirmeleri */
        [data-sonner-toast][data-type='success'] { border-color: rgba(16,185,129,0.35) !important; background: linear-gradient(135deg, rgba(16,185,129,0.1), #0a1525) !important; }
        [data-sonner-toast][data-type='error']   { border-color: rgba(239,68,68,0.35)  !important; background: linear-gradient(135deg, rgba(239,68,68,0.1),  #0a1525) !important; }
        [data-sonner-toast][data-type='warning'] { border-color: rgba(245,158,11,0.35) !important; background: linear-gradient(135deg, rgba(245,158,11,0.08), #0a1525) !important; }
        [data-sonner-toast][data-type='info']    { border-color: rgba(99,102,241,0.35) !important; background: linear-gradient(135deg, rgba(99,102,241,0.1),  #0a1525) !important; }
        [data-sonner-toaster] [data-sonner-toast] { min-width: 280px !important; max-width: 380px !important; }
        [data-sonner-toast] [data-icon] { font-size: 1.1rem !important; }

        /* Tablo satırı hover */
        tr:hover td { background: rgba(255,255,255,0.02) !important; transition: background 0.12s; }
        button:active { transform: scale(0.97) !important; }

        @media (max-width: 768px) {
          table { display: block; overflow-x: auto; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
        @media print {
          body { background: #fff !important; }
          aside, header, .fab-container, [data-sonner-toaster] { display: none !important; }
          * { color: #000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const { authed, login } = useAuth();
  const [setupDone, setSetupDone] = useState(isSetupDone);

  if (!setupDone) {
    return <SetupWizard onComplete={() => { setSetupDone(true); }} />;
  }

  if (!authed) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <ErrorBoundary>
    <ConfirmProvider>
      <AppContent />
      <Toaster
        richColors
        position="bottom-right"
        gap={8}
        toastOptions={{
          duration: 3500,
          style: {
            background: 'linear-gradient(135deg, #0f1e35, #0c1628)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '14px',
            color: '#e2e8f0',
            fontSize: '0.875rem',
            fontWeight: 600,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            padding: '13px 18px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            backdropFilter: 'blur(12px)',
            gap: '10px',
          },
          classNames: {
            toast: 'soba-toast',
            title: 'soba-toast-title',
            description: 'soba-toast-desc',
          },
        }}
      />
    </ConfirmProvider>
    </ErrorBoundary>
  );
}

const fLbl: React.CSSProperties = { display: 'block', marginBottom: 6, color: '#64748b', fontSize: '0.82rem', fontWeight: 600 };
const fInp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' };

function Row({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#475569', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: color || '#f1f5f9', fontWeight: big ? 900 : 600, fontSize: big ? '1.05rem' : '0.85rem' }}>{value}</span>
    </div>
  );
}
