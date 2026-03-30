import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { exportToExcel } from '@/lib/excelExport';
import { genId, formatMoney, formatDate } from '@/lib/utils-tr';
import type { DB, Cari as CariType } from '@/types';

interface Props { db: DB; save: (fn: (prev: DB) => DB) => void; }

const empty: Omit<CariType, 'id' | 'createdAt' | 'updatedAt'> = { name: '', type: 'musteri', taxNo: '', phone: '', email: '', address: '', balance: 0 };

export default function Cari({ db, save }: Props) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'musteri' | 'tedarikci'>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Partial<CariType>>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  let cari = db.cari.filter(c => !c.deleted);
  if (filter !== 'all') cari = cari.filter(c => c.type === filter);
  if (search) cari = cari.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));
  const sorted = [...cari].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const totalReceivable = db.cari.filter(c => !c.deleted && c.type === 'musteri' && c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const totalPayable = db.cari.filter(c => !c.deleted && c.type === 'tedarikci' && c.balance > 0).reduce((s, c) => s + c.balance, 0);

  const openAdd = () => { setForm({ ...empty }); setEditId(null); setModalOpen(true); };
  const openEdit = (c: CariType) => { setForm({ ...c }); setEditId(c.id); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name) { showToast('Ad gerekli!', 'error'); return; }
    const nowIso = new Date().toISOString();
    save(prev => {
      const cari = [...prev.cari];
      if (editId) {
        const i = cari.findIndex(c => c.id === editId);
        if (i >= 0) cari[i] = { ...cari[i], ...form, updatedAt: nowIso } as CariType;
        showToast('Cari güncellendi!', 'success');
      } else {
        cari.push({ id: genId(), createdAt: nowIso, updatedAt: nowIso, name: '', type: 'musteri', balance: 0, ...form } as CariType);
        showToast('Cari eklendi!', 'success');
      }
      return { ...prev, cari };
    });
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    showConfirm('Cari Sil', 'Bu cari kaydını silmek istediğinizden emin misiniz?', () => {
      // Fix: soft-delete — cari kaydı finansal geçmişi taşır, fiziksel silinmez
      save(prev => ({ ...prev, cari: prev.cari.map(c => c.id === id ? { ...c, deleted: true, updatedAt: new Date().toISOString() } : c) }));
      showToast('Cari silindi!', 'success');
    });
  };

  const detail = detailId ? db.cari.find(c => c.id === detailId) : null;
  const detailKasa = detailId ? db.kasa.filter(k => k.cariId === detailId || (detail && k.description?.includes(detail.name))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30) : [];
  const detailSales = detailId && detail ? db.sales.filter(s => s.cariId === detailId || s.cariName === detail.name || s.customerName === detail.name).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20) : [];
  const detailInvoices = detailId ? (db.invoices || []).filter(inv => inv.cariId === detailId || (detail && inv.cariName === detail.name)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20) : [];
  const totalPaid = detailKasa.filter(k => k.type === 'gelir').reduce((s, k) => s + k.amount, 0);
  const totalPurchased = detailSales.reduce((s, s2) => s + s2.total, 0) + detailInvoices.filter(i => i.type === 'satis').reduce((s, i) => s + i.total, 0);
  const [histTab, setHistTab] = useState<'kasa' | 'satis' | 'fatura'>('kasa');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Toplam Cari" value={String(db.cari.length)} color="#3b82f6" />
        <StatCard label="Alacak" value={formatMoney(totalReceivable)} color="#10b981" sub="Müşterilerden" />
        <StatCard label="Borç" value={formatMoney(totalPayable)} color="#ef4444" sub="Tedarikçilere" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={openAdd} style={{ background: '#ff5722', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>+ Yeni Cari</button>
        <button onClick={() => { exportToExcel(db, { sheets: ['cari'] }); showToast('Excel indirildi!', 'success'); }} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, color: '#a78bfa', padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>📊 Excel İndir</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Ara..." style={{ flex: 1, padding: '9px 13px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9' }} />
        {(['all', 'musteri', 'tedarikci'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: filter === f ? '#ff5722' : '#273548', color: filter === f ? '#fff' : '#94a3b8' }}>
            {f === 'all' ? 'Tümü' : f === 'musteri' ? '👤 Müşteri' : '🏭 Tedarikçi'}
          </button>
        ))}
      </div>

      <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.6)' }}>
              {['Ad', 'Tür', 'Telefon', 'Bakiye', 'Son İşlem', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cari bulunamadı</td></tr>
            ) : sorted.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => setDetailId(c.id)}>
                <td style={{ padding: '12px 16px', color: '#f1f5f9', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: c.type === 'musteri' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: c.type === 'musteri' ? '#60a5fa' : '#f59e0b', borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {c.type === 'musteri' ? '👤 Müşteri' : '🏭 Tedarikçi'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{c.phone || '-'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: c.balance > 0 ? '#10b981' : c.balance < 0 ? '#ef4444' : '#64748b' }}>{formatMoney(Math.abs(c.balance))}{c.balance > 0 ? ' ↑' : c.balance < 0 ? ' ↓' : ''}</td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem' }}>{c.lastTransaction ? formatDate(c.lastTransaction) : '-'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 6, color: '#60a5fa', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem' }}>✏️</button>
                    <button onClick={() => handleDelete(c.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, color: '#ef4444', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem' }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? '✏️ Cari Düzenle' : '➕ Yeni Cari'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Ad *</label>
            <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Tür</label>
            <select value={form.type || 'musteri'} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'musteri' | 'tedarikci' }))} style={inp}>
              <option value="musteri">👤 Müşteri</option>
              <option value="tedarikci">🏭 Tedarikçi</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Telefon</label>
            <input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Vergi No</label>
            <input value={form.taxNo || ''} onChange={e => setForm(f => ({ ...f, taxNo: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>E-posta</label>
            <input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Adres</label>
            <textarea value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ ...inp, minHeight: 60 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={handleSave} style={{ flex: 1, background: '#10b981', border: 'none', borderRadius: 10, color: '#fff', padding: '11px 0', fontWeight: 700, cursor: 'pointer' }}>💾 Kaydet</button>
          <button onClick={() => setModalOpen(false)} style={{ background: '#273548', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', padding: '11px 20px', cursor: 'pointer' }}>İptal</button>
        </div>
      </Modal>

      {detail && (
        <Modal open={!!detailId} onClose={() => { setDetailId(null); setHistTab('kasa'); }} title={`📋 ${detail.name}`} maxWidth={680}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Bakiye', value: formatMoney(Math.abs(detail.balance)), color: detail.balance > 0 ? '#10b981' : detail.balance < 0 ? '#ef4444' : '#64748b', icon: detail.balance > 0 ? '↑' : '↓' },
              { label: 'Toplam Alışveriş', value: formatMoney(totalPurchased), color: '#3b82f6', icon: '🛒' },
              { label: 'Tahsil Edilen', value: formatMoney(totalPaid), color: '#10b981', icon: '💰' },
              { label: 'Fatura Sayısı', value: String(detailInvoices.length), color: '#8b5cf6', icon: '🧾' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: `1px solid ${s.color}15` }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 3 }}>{s.icon}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Info Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {[['Tür', detail.type === 'musteri' ? '👤 Müşteri' : '🏭 Tedarikçi'], ['Telefon', detail.phone || '-'], ['E-posta', detail.email || '-'], ['Vergi No', detail.taxNo || '-']].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem' }}>
                <span style={{ color: '#475569' }}>{l}: </span><span style={{ color: '#e2e8f0', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          {/* History Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 4 }}>
            {[{ id: 'kasa' as const, label: `💰 Ödemeler (${detailKasa.length})` }, { id: 'satis' as const, label: `🛒 Satışlar (${detailSales.length})` }, { id: 'fatura' as const, label: `🧾 Faturalar (${detailInvoices.length})` }].map(t => (
              <button key={t.id} onClick={() => setHistTab(t.id)} style={{ flex: 1, padding: '7px 4px', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', background: histTab === t.id ? 'linear-gradient(135deg,#ff5722,#ff7043)' : 'transparent', color: histTab === t.id ? '#fff' : '#64748b' }}>{t.label}</button>
            ))}
          </div>
          {histTab === 'kasa' && (
            detailKasa.length === 0 ? <EmptyState /> : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead><tr>{['Tarih', 'Açıklama', 'Tutar', 'Hesap'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontSize: '0.7rem', fontWeight: 700 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {detailKasa.map(k => (
                      <tr key={k.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{formatDate(k.createdAt)}</td>
                        <td style={{ padding: '8px 10px', color: '#e2e8f0' }}>{k.description || '-'}</td>
                        <td style={{ padding: '8px 10px', color: k.type === 'gelir' ? '#10b981' : '#ef4444', fontWeight: 700 }}>{k.type === 'gelir' ? '+' : '-'}{formatMoney(k.amount)}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{k.kasa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {histTab === 'satis' && (
            detailSales.length === 0 ? <EmptyState /> : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead><tr>{['Tarih', 'Ürün', 'Adet', 'Toplam', 'Ödeme'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontSize: '0.7rem', fontWeight: 700 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {detailSales.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{formatDate(s.createdAt)}</td>
                        <td style={{ padding: '8px 10px', color: '#e2e8f0' }}>{s.productName || (s.items?.[0]?.productName) || '-'}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{s.quantity || (s.items?.reduce((a: number, i: { quantity: number }) => a + i.quantity, 0)) || '-'}</td>
                        <td style={{ padding: '8px 10px', color: '#10b981', fontWeight: 700 }}>{formatMoney(s.total)}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{s.payment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {histTab === 'fatura' && (
            detailInvoices.length === 0 ? <EmptyState /> : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead><tr>{['No', 'Tür', 'Tarih', 'Tutar', 'Durum'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontSize: '0.7rem', fontWeight: 700 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {detailInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', color: '#ff7043', fontFamily: 'monospace', fontWeight: 700 }}>{inv.invoiceNo}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{inv.type === 'satis' ? '📤 Satış' : '📥 Alış'}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{formatDate(inv.createdAt)}</td>
                        <td style={{ padding: '8px 10px', color: '#10b981', fontWeight: 700 }}>{formatMoney(inv.total)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ background: inv.status === 'odendi' ? 'rgba(16,185,129,0.12)' : inv.status === 'onaylandi' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)', color: inv.status === 'odendi' ? '#10b981' : inv.status === 'onaylandi' ? '#60a5fa' : '#f59e0b', borderRadius: 5, padding: '2px 7px', fontSize: '0.72rem', fontWeight: 700 }}>{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Modal>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' };

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', border: `1px solid ${color}22` }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return <p style={{ color: '#334155', textAlign: 'center', padding: '20px 0', fontSize: '0.85rem' }}>Kayıt bulunamadı</p>;
}
