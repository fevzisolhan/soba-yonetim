import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { genId, formatMoney, getCategoryName, getCategoryIcon, calcProfit } from '@/lib/utils-tr';
import type { DB, Product } from '@/types';

interface Props { db: DB; save: (fn: (prev: DB) => DB) => void; }

const categories = ['all', 'soba', 'aksesuar', 'yedek', 'boru', 'pelet'] as const;

const empty: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = { name: '', category: 'soba', brand: '', cost: 0, price: 0, stock: 0, minStock: 5, barcode: '', description: '' };

export default function Products({ db, save }: Props) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Product>>(empty);
  const [editId, setEditId] = useState<string | null>(null);

  let products = db.products;
  if (filter === 'zero') products = products.filter(p => p.stock === 0);
  else if (filter === 'low') products = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  else if (filter !== 'all') products = products.filter(p => p.category === filter);
  if (search) products = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search));

  const openAdd = () => { setForm({ ...empty, category: 'soba' }); setEditId(null); setModalOpen(true); };
  const openEdit = (p: Product) => { setForm({ ...p }); setEditId(p.id); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name) { showToast('Ürün adı gerekli!', 'error'); return; }
    const nowIso = new Date().toISOString();
    save(prev => {
      const products = [...prev.products];
      if (editId) {
        const i = products.findIndex(p => p.id === editId);
        if (i >= 0) products[i] = { ...products[i], ...form, updatedAt: nowIso } as Product;
        showToast('Ürün güncellendi!', 'success');
      } else {
        const np: Product = { id: genId(), createdAt: nowIso, updatedAt: nowIso, name: '', category: 'soba', cost: 0, price: 0, stock: 0, minStock: 5, ...form } as Product;
        products.push(np);
        showToast('Ürün eklendi!', 'success');
      }
      return { ...prev, products };
    });
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    showConfirm('Ürünü Sil', 'Bu ürünü silmek istediğinizden emin misiniz?', () => {
      save(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
      showToast('Ürün silindi!', 'success');
    });
  };

  const f = (k: keyof Product, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const totalValue = db.products.reduce((s, p) => s + p.cost * p.stock, 0);
  const outOfStock = db.products.filter(p => p.stock === 0).length;
  const lowStock = db.products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={openAdd} style={{ background: '#ff5722', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>+ Yeni Ürün</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Ürün ara..." style={{ flex: 1, minWidth: 200, padding: '10px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: '0.9rem' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Chip label="Tümü" active={filter === 'all'} onClick={() => setFilter('all')} />
        {categories.slice(1).map(c => <Chip key={c} label={`${getCategoryIcon(c)} ${getCategoryName(c)}`} active={filter === c} onClick={() => setFilter(c)} />)}
        <Chip label="🔴 Biten" active={filter === 'zero'} onClick={() => setFilter('zero')} danger={outOfStock > 0} count={outOfStock} />
        <Chip label="⚠️ Az" active={filter === 'low'} onClick={() => setFilter('low')} warning={lowStock > 0} count={lowStock} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Toplam Ürün', value: String(db.products.length), color: '#3b82f6' },
          { label: 'Stok Değeri', value: formatMoney(totalValue), color: '#10b981' },
          { label: 'Biten Stok', value: String(outOfStock), color: '#ef4444' },
          { label: 'Az Stok', value: String(lowStock), color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1e293b', borderRadius: 10, padding: '14px 16px', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {products.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#64748b' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📦</div>
            <p>Ürün bulunamadı</p>
          </div>
        ) : products.map(p => {
          const margin = calcProfit(p.price, p.cost);
          const marginColor = margin >= 30 ? '#10b981' : margin >= 10 ? '#f59e0b' : '#ef4444';
          const stockStatus = p.stock === 0 ? { color: '#ef4444', label: '🔴 Stok Yok' } : p.stock <= p.minStock ? { color: '#f59e0b', label: `⚠️ Az: ${p.stock}` } : { color: '#10b981', label: `✓ ${p.stock} adet` };
          return (
            <div key={p.id} style={{ background: '#1e293b', borderRadius: 12, border: `1px solid ${p.stock === 0 ? '#ef444433' : p.stock <= p.minStock ? '#f59e0b33' : '#334155'}`, padding: 16, transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = ''}>
              <div style={{ fontSize: '2.2rem', marginBottom: 10, textAlign: 'center' }}>{getCategoryIcon(p.category)}</div>
              <h4 style={{ fontWeight: 700, marginBottom: 4, color: '#f1f5f9', fontSize: '0.95rem' }}>{p.name}</h4>
              <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 10 }}>{p.brand ? `${p.brand} · ` : ''}{getCategoryName(p.category)}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1rem' }}>{formatMoney(p.price)}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: marginColor }}>%{margin} kâr</span>
              </div>
              <div style={{ color: stockStatus.color, fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>{stockStatus.label}</div>
              {p.barcode && <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: 10 }}>🔖 {p.barcode}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEdit(p)} style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#60a5fa', padding: '7px 0', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>✏️ Düzenle</button>
                <button onClick={() => handleDelete(p.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', padding: '7px 10px', cursor: 'pointer', fontWeight: 600 }}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? '✏️ Ürün Düzenle' : '➕ Yeni Ürün'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Ürün Adı *</label>
            <input value={form.name || ''} onChange={e => f('name', e.target.value)} style={inp} placeholder="Ürün adı" />
          </div>
          <div>
            <label style={lbl}>Kategori</label>
            <select value={form.category || 'soba'} onChange={e => f('category', e.target.value)} style={inp}>
              <option value="soba">🔥 Soba</option>
              <option value="aksesuar">🔧 Aksesuar</option>
              <option value="yedek">⚙️ Yedek Parça</option>
              <option value="boru">🔩 Boru</option>
              <option value="pelet">🪵 Pelet</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Marka</label>
            <input value={form.brand || ''} onChange={e => f('brand', e.target.value)} style={inp} placeholder="Marka" />
          </div>
          <div>
            <label style={lbl}>Alış Fiyatı (₺)</label>
            <input type="number" value={form.cost || 0} onChange={e => f('cost', parseFloat(e.target.value) || 0)} style={inp} min={0} step={0.01} />
          </div>
          <div>
            <label style={lbl}>Satış Fiyatı (₺)</label>
            <input type="number" value={form.price || 0} onChange={e => f('price', parseFloat(e.target.value) || 0)} style={inp} min={0} step={0.01} />
          </div>
          <div>
            <label style={lbl}>Stok</label>
            <input type="number" value={form.stock || 0} onChange={e => f('stock', parseInt(e.target.value) || 0)} style={inp} min={0} />
          </div>
          <div>
            <label style={lbl}>Min. Stok</label>
            <input type="number" value={form.minStock || 5} onChange={e => f('minStock', parseInt(e.target.value) || 0)} style={inp} min={0} />
          </div>
          <div>
            <label style={lbl}>Barkod</label>
            <input value={form.barcode || ''} onChange={e => f('barcode', e.target.value)} style={inp} placeholder="Barkod" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Açıklama</label>
            <textarea value={form.description || ''} onChange={e => f('description', e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
          </div>
          {form.cost && form.price ? (
            <div style={{ gridColumn: '1/-1', background: '#0f172a', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 20 }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Kâr Marjı: <strong style={{ color: calcProfit(form.price, form.cost) >= 20 ? '#10b981' : '#f59e0b' }}>%{calcProfit(form.price, form.cost)}</strong></span>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Kâr: <strong style={{ color: '#10b981' }}>{formatMoney((form.price - form.cost) * (form.stock || 0))}</strong></span>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={handleSave} style={{ flex: 1, background: '#10b981', border: 'none', borderRadius: 10, color: '#fff', padding: '11px 0', fontWeight: 700, cursor: 'pointer' }}>💾 Kaydet</button>
          <button onClick={() => setModalOpen(false)} style={{ background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', padding: '11px 20px', cursor: 'pointer' }}>İptal</button>
        </div>
      </Modal>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' };

function Chip({ label, active, onClick, danger, warning, count }: { label: string; active: boolean; onClick: () => void; danger?: boolean; warning?: boolean; count?: number }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', background: active ? '#ff5722' : danger ? 'rgba(239,68,68,0.1)' : warning ? 'rgba(245,158,11,0.1)' : '#273548', color: active ? '#fff' : danger ? '#ef4444' : warning ? '#f59e0b' : '#94a3b8', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
      {label} {count !== undefined && count > 0 && <span style={{ background: active ? 'rgba(255,255,255,0.2)' : danger ? '#ef4444' : '#f59e0b', color: '#fff', borderRadius: '50%', minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>{count}</span>}
    </button>
  );
}
