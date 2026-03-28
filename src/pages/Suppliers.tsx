import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { genId, formatMoney, formatDate } from '@/lib/utils-tr';
import type { DB, Supplier, Order, OrderItem } from '@/types';

interface Props { db: DB; save: (fn: (prev: DB) => DB) => void; }

const emptySupplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> = { name: '', category: '', taxNo: '', contact: '', phone: '', email: '', address: '', note: '', totalOrders: 0, totalAmount: 0 };

export default function Suppliers({ db, save }: Props) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [tab, setTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [supModal, setSupModal] = useState(false);
  const [orderModal, setOrderModal] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>(emptySupplier);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSup, setSelectedSup] = useState('');

  // Order form
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderSupplierId, setOrderSupplierId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderNote, setOrderNote] = useState('');

  const addOrderItem = (productId: string) => {
    const p = db.products.find(x => x.id === productId);
    if (!p) return;
    setOrderItems(prev => {
      const ex = prev.find(i => i.productId === productId);
      if (ex) return prev.map(i => i.productId === productId ? { ...i, qty: i.qty + 1, lineTotal: (i.qty + 1) * i.unitCost } : i);
      return [...prev, { productId, productName: p.name, qty: 1, unitCost: p.cost, lineTotal: p.cost }];
    });
  };

  const saveSupplier = () => {
    if (!form.name) { showToast('Tedarikçi adı gerekli!', 'error'); return; }
    const nowIso = new Date().toISOString();
    save(prev => {
      const suppliers = [...prev.suppliers];
      if (editId) {
        const i = suppliers.findIndex(s => s.id === editId);
        if (i >= 0) suppliers[i] = { ...suppliers[i], ...form, updatedAt: nowIso } as Supplier;
        showToast('Tedarikçi güncellendi!');
      } else {
        suppliers.push({ id: genId(), createdAt: nowIso, updatedAt: nowIso, totalOrders: 0, totalAmount: 0, name: '', category: '', phone: '', ...form } as Supplier);
        showToast('Tedarikçi eklendi!');
      }
      return { ...prev, suppliers };
    });
    setSupModal(false);
  };

  const saveOrder = () => {
    if (!orderSupplierId) { showToast('Tedarikçi seçin!', 'error'); return; }
    if (orderItems.length === 0) { showToast('Ürün ekleyin!', 'error'); return; }
    const amount = orderItems.reduce((s, i) => s + i.lineTotal, 0);
    const nowIso = new Date().toISOString();
    const order: Order = {
      id: genId(), supplierId: orderSupplierId, items: orderItems, amount, paidAmount: 0, remainingAmount: amount,
      payments: [], deliveryDate, note: orderNote, status: 'bekliyor', createdAt: nowIso, updatedAt: nowIso,
    };
    save(prev => {
      const suppliers = prev.suppliers.map(s => s.id === orderSupplierId ? { ...s, totalOrders: (s.totalOrders || 0) + 1, totalAmount: (s.totalAmount || 0) + amount } : s);
      return { ...prev, orders: [...prev.orders, order], suppliers };
    });
    showToast('Sipariş oluşturuldu!');
    setOrderItems([]); setOrderSupplierId(''); setDeliveryDate(''); setOrderNote('');
    setOrderModal(false);
  };

  const deleteSupplier = (id: string) => {
    showConfirm('Tedarikçi Sil', 'Silmek istediğinizden emin misiniz?', () => {
      save(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== id) }));
      showToast('Silindi!');
    });
  };

  const updateOrderStatus = (id: string, status: Order['status']) => {
    save(prev => {
      const orders = prev.orders.map(o => {
        if (o.id !== id) return o;
        const updated = { ...o, status, updatedAt: new Date().toISOString() };
        if (status === 'tamamlandi') {
          const products = prev.products.map(p => {
            const item = o.items.find(i => i.productId === p.id);
            if (!item) return p;
            const before = p.stock;
            const after = p.stock + item.qty;
            return { ...p, stock: after };
          });
          const stockMovements = [...prev.stockMovements, ...o.items.map(i => ({
            id: genId(), productId: i.productId, productName: i.productName, type: 'giris' as const,
            amount: i.qty, before: prev.products.find(p => p.id === i.productId)?.stock || 0,
            after: (prev.products.find(p => p.id === i.productId)?.stock || 0) + i.qty, note: 'Sipariş alındı', date: new Date().toISOString(),
          }))];
          showToast('Sipariş tamamlandı, stoklar güncellendi!');
          return { ...prev, orders: prev.orders.map(x => x.id === id ? updated : x), products, stockMovements };
        }
        return prev;
      });
      if (Array.isArray(orders)) return { ...prev, orders: prev.orders.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o) };
      return orders as DB;
    });
  };

  let suppliers = db.suppliers;
  if (search) suppliers = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone || '').includes(search));
  if (selectedSup) suppliers = suppliers.filter(s => s.id === selectedSup);

  let orders = db.orders;
  if (selectedSup) orders = orders.filter(o => o.supplierId === selectedSup);
  const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const statusColor: Record<string, string> = { bekliyor: '#f59e0b', yolda: '#3b82f6', tamamlandi: '#10b981', iptal: '#ef4444' };
  const statusLabel: Record<string, string> = { bekliyor: '⏳ Bekliyor', yolda: '🚚 Yolda', tamamlandi: '✓ Tamamlandı', iptal: '✕ İptal' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['suppliers', 'orders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, background: tab === t ? '#ff5722' : '#273548', color: tab === t ? '#fff' : '#94a3b8' }}>
            {t === 'suppliers' ? '🏭 Tedarikçiler' : '📦 Siparişler'}
          </button>
        ))}
      </div>

      {tab === 'suppliers' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => { setForm(emptySupplier); setEditId(null); setSupModal(true); }} style={{ background: '#ff5722', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>+ Yeni Tedarikçi</button>
            <button onClick={() => setOrderModal(true)} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, color: '#60a5fa', padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>📦 Sipariş Ver</button>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Ara..." style={{ flex: 1, padding: '9px 13px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {suppliers.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#64748b' }}>Tedarikçi bulunamadı</div>
            ) : suppliers.map(s => (
              <div key={s.id} style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: 18 }}>
                <h4 style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{s.name}</h4>
                <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 10 }}>{s.category || 'Genel'}</p>
                {s.phone && <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 4 }}>📞 {s.phone}</p>}
                {s.email && <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 4 }}>📧 {s.email}</p>}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{s.totalOrders || 0} sipariş</span>
                  <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>{formatMoney(s.totalAmount || 0)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => { setSelectedSup(s.id); setTab('orders'); }} style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 8, color: '#60a5fa', padding: '7px 0', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>📦 Siparişler</button>
                  <button onClick={() => { setForm({ ...s }); setEditId(s.id); setSupModal(true); }} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 8, color: '#60a5fa', padding: '7px 10px', cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => deleteSupplier(s.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, color: '#ef4444', padding: '7px 10px', cursor: 'pointer' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'orders' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setOrderModal(true)} style={{ background: '#ff5722', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>+ Sipariş Ver</button>
            <select value={selectedSup} onChange={e => setSelectedSup(e.target.value)} style={{ padding: '9px 13px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9' }}>
              <option value="">Tüm Tedarikçiler</option>
              {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.6)' }}>
                  {['Tarih', 'Tedarikçi', 'Ürünler', 'Tutar', 'Durum', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedOrders.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Sipariş bulunamadı</td></tr>
                ) : sortedOrders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem' }}>{formatDate(o.createdAt)}</td>
                    <td style={{ padding: '12px 16px', color: '#f1f5f9', fontWeight: 600 }}>{db.suppliers.find(s => s.id === o.supplierId)?.name || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.items.map(i => `${i.productName}×${i.qty}`).join(', ')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 700 }}>{formatMoney(o.amount)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: `${statusColor[o.status]}22`, color: statusColor[o.status], borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>{statusLabel[o.status]}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {o.status === 'bekliyor' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => updateOrderStatus(o.id, 'yolda')} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 6, color: '#60a5fa', padding: '4px 8px', cursor: 'pointer', fontSize: '0.78rem' }}>🚚 Yolda</button>
                          <button onClick={() => updateOrderStatus(o.id, 'tamamlandi')} style={{ background: 'rgba(16,185,129,0.1)', border: 'none', borderRadius: 6, color: '#10b981', padding: '4px 8px', cursor: 'pointer', fontSize: '0.78rem' }}>✓ Tamamla</button>
                        </div>
                      )}
                      {o.status === 'yolda' && (
                        <button onClick={() => updateOrderStatus(o.id, 'tamamlandi')} style={{ background: 'rgba(16,185,129,0.1)', border: 'none', borderRadius: 6, color: '#10b981', padding: '4px 8px', cursor: 'pointer', fontSize: '0.78rem' }}>✓ Tamamla</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={supModal} onClose={() => setSupModal(false)} title={editId ? '✏️ Tedarikçi Düzenle' : '➕ Yeni Tedarikçi'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Ad *</label>
            <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} />
          </div>
          <div><label style={lbl}>Kategori</label><input value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>Telefon</label><input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>E-posta</label><input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>Yetkili</label><input value={form.contact || ''} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} style={inp} /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Adres</label><textarea value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ ...inp, minHeight: 60 }} /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Not</label><textarea value={form.note || ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ ...inp, minHeight: 60 }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={saveSupplier} style={{ flex: 1, background: '#10b981', border: 'none', borderRadius: 10, color: '#fff', padding: '11px 0', fontWeight: 700, cursor: 'pointer' }}>💾 Kaydet</button>
          <button onClick={() => setSupModal(false)} style={{ background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', padding: '11px 20px', cursor: 'pointer' }}>İptal</button>
        </div>
      </Modal>

      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="📦 Sipariş Ver" maxWidth={620}>
        <div>
          <label style={lbl}>Tedarikçi *</label>
          <select value={orderSupplierId} onChange={e => setOrderSupplierId(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
            <option value="">-- Tedarikçi Seç --</option>
            {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={lbl}>Ürün Ekle</label>
          <select onChange={e => { if (e.target.value) { addOrderItem(e.target.value); e.target.value = ''; } }} style={{ ...inp, marginBottom: 12 }}>
            <option value="">-- Ürün Seç --</option>
            {db.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {orderItems.map(item => (
            <div key={item.productId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, background: '#0f172a', borderRadius: 8, padding: '8px 10px' }}>
              <span style={{ flex: 1, color: '#f1f5f9', fontSize: '0.88rem' }}>{item.productName}</span>
              <input type="number" value={item.qty} min={1} onChange={e => { const qty = parseInt(e.target.value) || 1; setOrderItems(prev => prev.map(i => i.productId === item.productId ? { ...i, qty, lineTotal: qty * i.unitCost } : i)); }} style={{ width: 55, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', padding: '4px 6px', textAlign: 'center' }} />
              <input type="number" value={item.unitCost} step={0.01} onChange={e => { const cost = parseFloat(e.target.value) || 0; setOrderItems(prev => prev.map(i => i.productId === item.productId ? { ...i, unitCost: cost, lineTotal: i.qty * cost } : i)); }} style={{ width: 80, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', padding: '4px 6px' }} />
              <button onClick={() => setOrderItems(prev => prev.filter(i => i.productId !== item.productId))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={lbl}>Teslim Tarihi</label><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={inp} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={lbl}>Not</label><textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} style={{ ...inp, minHeight: 50 }} /></div>
          {orderItems.length > 0 && (
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 14px', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Toplam</span>
                <span style={{ color: '#10b981', fontWeight: 800, fontSize: '1.1rem' }}>{formatMoney(orderItems.reduce((s, i) => s + i.lineTotal, 0))}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={saveOrder} style={{ flex: 1, background: '#ff5722', border: 'none', borderRadius: 10, color: '#fff', padding: '11px 0', fontWeight: 700, cursor: 'pointer' }}>📦 Sipariş Ver</button>
          <button onClick={() => setOrderModal(false)} style={{ background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', padding: '11px 20px', cursor: 'pointer' }}>İptal</button>
        </div>
      </Modal>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' };
