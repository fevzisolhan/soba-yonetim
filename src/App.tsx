import { useState, useMemo, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { useDB } from '@/hooks/useDB';
import { useToast } from '@/components/Toast';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { Toaster } from 'sonner';
import LoginScreen, { useAuth } from '@/components/LoginScreen';
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
import Pelet from '@/pages/Pelet';
import BoruTed from '@/pages/BoruTed';
import Partners from '@/pages/Partners';
import Settings from '@/pages/Settings';
import AIAsistan from '@/pages/AIAsistan';
import Fatura from '@/pages/Fatura';
import Entegrasyonlar from '@/pages/Entegrasyonlar';
import Butce from '@/pages/Butce';
import KontrolHalkasi from '@/pages/KontrolHalkasi';
import { formatMoney, genId } from '@/lib/utils-tr';
import { Modal } from '@/components/Modal';

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
  { id: 'boruTed', label: 'Boru Ted.', icon: '🔩', group: 'Tedarik' },
  { id: 'cari', label: 'Cari', icon: '👤', group: 'Finans' },
  { id: 'kasa', label: 'Kasa', icon: '💰', group: 'Finans' },
  { id: 'butce', label: 'Bütçe', icon: '📊', group: 'Finans' },
  { id: 'bank', label: 'Banka', icon: '🏦', group: 'Finans' },
  { id: 'reports', label: 'Raporlar', icon: '📈', group: 'Analiz' },
  { id: 'stock', label: 'Stok', icon: '🔢', group: 'Analiz' },
  { id: 'monitor', label: 'İzleme', icon: '🔔', group: 'Analiz' },
  { id: 'kontrol', label: 'Kontrol', icon: '⚡', group: 'Analiz' },
  { id: 'ai', label: 'AI Asistan', icon: '🤖', group: 'Analiz' },
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
          {db.products.filter(p => p.stock > 0).map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock}, ₺{p.price})</option>)}
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
  const [form, setForm] = useState({ name: '', category: 'soba', cost: '', price: '', stock: '', minStock: '5' });

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
          {[['soba', '🔥 Soba'], ['aksesuar', '🔧 Aksesuar'], ['yedek', '⚙️ Yedek Parça'], ['boru', '🔩 Boru'], ['pelet', '🪵 Pelet']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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

function FAB({ db, save }: { db: ReturnType<typeof useDB>['db']; save: ReturnType<typeof useDB>['save'] }) {
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

function AppContent() {
  const { db, save, exportJSON, importJSON } = useDB();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const isOnline = useOnlineStatus();
  const prevOnline = useRef(isOnline);
  const { showToast } = useToast();

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
    products: db.products.filter(p => p.stock === 0).length + db.products.filter(p => p.stock > 0 && p.stock <= p.minStock).length,
    sales: db.sales.filter(s => s.status === 'tamamlandi' && new Date(s.createdAt).toDateString() === new Date().toDateString()).length,
    suppliers: db.orders.filter(o => o.status === 'bekliyor').length,
    bank: db.bankTransactions.filter(t => t.status === 'unmatched').length,
    monitor: db.monitorRules.filter(r => r.active).reduce((c, r) => {
      if (r.type === 'stok_sifir' && db.products.some(p => p.stock === 0)) return c + 1;
      if (r.type === 'stok_min' && db.products.some(p => p.stock > 0 && p.stock <= p.minStock)) return c + 1;
      return c;
    }, 0),
  }), [db]);

  const totalKasa = useMemo(() => db.kasa.reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0), [db.kasa]);
  const nakit = useMemo(() => db.kasa.filter(k => k.kasa === 'nakit').reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0), [db.kasa]);
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
      <aside style={{ width: 228, minHeight: '100vh', background: 'linear-gradient(180deg, #06101f 0%, #080f1e 100%)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', position: 'fixed', left: isMobile && !sidebarOpen ? -240 : 0, top: 0, bottom: 0, zIndex: 100, transition: 'left 0.25s ease' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #ff5722, #ff8c42)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 4px 16px rgba(255,87,34,0.35)', flexShrink: 0 }}>🔥</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.92rem', letterSpacing: '-0.01em' }}>Soba Yönetim</div>
              <div style={{ color: '#1e3a5f', fontSize: '0.65rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sistemi v2.0</div>
            </div>
            {isMobile && <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '1.4rem', cursor: 'pointer', padding: '4px 8px' }}>✕</button>}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 4 }}>
              <div style={{ padding: '7px 10px 3px', color: '#1e3a5f', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{group}</div>
              {TABS.filter(t => t.group === group).map(tab => {
                const badge = badges[tab.id as keyof typeof badges];
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => navigate(tab.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: 'none', borderRadius: 9, cursor: 'pointer', marginBottom: 1, background: isActive ? 'rgba(255,87,34,0.15)' : 'transparent', color: isActive ? '#ff7043' : '#475569', fontWeight: isActive ? 700 : 400, fontSize: '0.85rem', transition: 'all 0.15s', borderLeft: isActive ? '2px solid #ff5722' : '2px solid transparent', outline: 'none' }}
                    onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; } }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; } }}>
                    <span style={{ width: 18, textAlign: 'center', fontSize: '0.9rem', flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>{tab.icon}</span>
                    <span style={{ flex: 1 }}>{tab.label}</span>
                    {badge ? <span style={{ background: tab.id === 'products' || tab.id === 'monitor' ? '#ef4444' : '#f59e0b', color: '#fff', borderRadius: '10px', minWidth: 18, height: 17, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, padding: '0 4px' }}>{badge > 99 ? '99+' : badge}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Kasa Widget */}
        <div onClick={() => navigate('kasa')} style={{ margin: '0 8px 8px', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.03))', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '11px 13px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.06))'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.03))'}>
          <div style={{ color: '#1e4d3f', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>💰 Toplam Kasa</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: totalKasa >= 0 ? '#10b981' : '#ef4444', letterSpacing: '-0.02em' }}>{formatMoney(totalKasa)}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1 }}><div style={{ color: '#1e3a5f', fontSize: '0.62rem' }}>Nakit</div><div style={{ color: '#6ee7b7', fontSize: '0.78rem', fontWeight: 700 }}>{formatMoney(nakit)}</div></div>
            <div style={{ flex: 1 }}><div style={{ color: '#1e3a5f', fontSize: '0.62rem' }}>Banka</div><div style={{ color: '#6ee7b7', fontSize: '0.78rem', fontWeight: 700 }}>{formatMoney(totalKasa - nakit)}</div></div>
          </div>
        </div>

        <div style={{ padding: '8px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? '#10b981' : '#f59e0b', display: 'inline-block', boxShadow: isOnline ? '0 0 6px #10b981' : '0 0 6px #f59e0b' }} />
            <span style={{ color: isOnline ? '#10b981' : '#f59e0b', fontSize: '0.64rem', fontWeight: 700 }}>{isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
          </div>
          <div style={{ color: '#0f2235', fontSize: '0.6rem', textAlign: 'center' }}>🔒 localStorage · Veriler yerel ve güvenli</div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ width: isMobile ? '100vw' : 'calc(100vw - 228px)', marginLeft: isMobile ? 0 : 228, display: 'flex', flexDirection: 'column', minHeight: '100vh', transition: 'margin-left 0.25s ease', boxSizing: 'border-box' }}>
        {/* HEADER */}
        <header style={{ background: 'rgba(6,16,31,0.97)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: isMobile ? '10px 14px' : '11px 24px', display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, position: 'sticky', top: 0, zIndex: 90, backdropFilter: 'blur(12px)' }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: '#f1f5f9', padding: '8px 10px', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>☰</button>
          )}
          <div style={{ minWidth: isMobile ? 0 : 130, flex: isMobile ? 1 : undefined }}>
            <h1 style={{ fontWeight: 800, fontSize: isMobile ? '0.9rem' : '1.02rem', color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TABS.find(t => t.id === activeTab)?.icon} {TABS.find(t => t.id === activeTab)?.label}</h1>
          </div>
          {!isMobile && <GlobalSearch onNavigate={navigate} db={db} />}
          <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'center', flexShrink: 0 }}>
            {!isMobile && (
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ k: '⌘1', t: 'dashboard', label: 'Özet' }, { k: '⌘2', t: 'products', label: 'Ürün' }, { k: '⌘3', t: 'sales', label: 'Satış' }, { k: '⌘4', t: 'kasa', label: 'Kasa' }].map(s => (
                  <button key={s.k} onClick={() => navigate(s.t as TabId)} title={`${s.label} (Ctrl+${s.k.replace('⌘', '')})`} style={{ background: activeTab === s.t ? 'rgba(255,87,34,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activeTab === s.t ? 'rgba(255,87,34,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, color: activeTab === s.t ? '#ff7043' : '#334155', padding: '4px 8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, transition: 'all 0.15s' }}>
                    {s.k}
                  </button>
                ))}
              </div>
            )}
            {badges.monitor > 0 && <button onClick={() => navigate('monitor')} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', padding: '5px 11px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>🔔 {badges.monitor}</button>}
            {!isMobile && badges.products > 0 && <button onClick={() => navigate('products')} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#fca5a5', padding: '5px 11px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>📦 {badges.products}</button>}
            <button onClick={exportJSON} title="Hızlı Yedek Al" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#60a5fa', padding: '5px 11px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>{isMobile ? '💾' : '💾 Yedek'}</button>
            {!isMobile && <div style={{ color: '#1e3a5f', fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
          </div>
        </header>

        {/* CONTENT */}
        <main style={{ flex: 1, padding: isMobile ? '14px 10px' : '22px 24px', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {activeTab === 'dashboard' && <Dashboard db={db} onTabChange={navigate} />}
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
          {activeTab === 'ai' && <AIAsistan db={db} />}
          {activeTab === 'entegrasyon' && <Entegrasyonlar db={db} />}
          {activeTab === 'partners' && <Partners db={db} save={save} />}
          {activeTab === 'settings' && <Settings db={db} save={save} exportJSON={exportJSON} importJSON={importJSON} />}
        </main>
      </div>

      {/* FAB */}
      <FAB db={db} save={save} />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070e1c; }
        input, select, textarea, button { outline: none; font-family: inherit; }
        input:focus, select:focus, textarea:focus { border-color: rgba(255,87,34,0.5) !important; box-shadow: 0 0 0 3px rgba(255,87,34,0.12) !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        tr:hover td { background: rgba(255,255,255,0.02) !important; transition: background 0.15s; }
        button:active { transform: scale(0.97) !important; }
        nav::-webkit-scrollbar { width: 0; }
        @media (max-width: 768px) {
          table { display: block; overflow-x: auto; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const { authed, login } = useAuth();

  if (!authed) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <ConfirmProvider>
      <AppContent />
      <Toaster richColors position="bottom-right" />
    </ConfirmProvider>
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
