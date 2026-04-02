import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { genId, formatMoney, formatDate } from '@/lib/utils-tr';
import type { DB } from '@/types';

interface Props { db: DB; save: (fn: (prev: DB) => DB) => void; }

export default function Bank({ db, save }: Props) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched' | 'confirmed'>('all');
  const [search, setSearch] = useState('');

  const matchToAccount = (transId: string, cariId: string) => {
    save(prev => ({
      ...prev,
      bankTransactions: prev.bankTransactions.map(t => t.id === transId ? { ...t, matchedCariId: cariId, status: 'confirmed' as const, updatedAt: new Date().toISOString() } : t),
    }));
    showToast('Eşleştirildi!', 'success');
  };

  const confirm = (id: string) => {
    save(prev => ({
      ...prev,
      bankTransactions: prev.bankTransactions.map(t => t.id === id ? { ...t, status: 'confirmed' as const, updatedAt: new Date().toISOString() } : t),
    }));
    showToast('Onaylandı!', 'success');
  };

  const addSample = () => {
    const nowIso = new Date().toISOString();
    const samples = [
      { id: genId(), date: nowIso, description: 'Ahmet Yılmaz - Havale', amount: 5000, type: 'income' as const, matchScore: 0, status: 'unmatched' as const, createdAt: nowIso, updatedAt: nowIso },
      { id: genId(), date: nowIso, description: 'EFT - Tedarikçi Ödemesi', amount: 12000, type: 'expense' as const, matchScore: 0, status: 'unmatched' as const, createdAt: nowIso, updatedAt: nowIso },
    ];
    save(prev => ({ ...prev, bankTransactions: [...prev.bankTransactions, ...samples] }));
    showToast('Örnek işlemler eklendi!', 'success');
  };

  let transactions = db.bankTransactions;
  if (filter !== 'all') transactions = transactions.filter(t => t.status === filter);
  if (search) transactions = transactions.filter(t => t.description.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unmatched = db.bankTransactions.filter(t => t.status === 'unmatched').length;
  const totalIn = db.bankTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = db.bankTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Toplam Gelen" value={formatMoney(totalIn)} color="#10b981" />
        <StatCard label="Toplam Giden" value={formatMoney(totalOut)} color="#ef4444" />
        <StatCard label="Net Bakiye" value={formatMoney(totalIn - totalOut)} color="#3b82f6" />
        <StatCard label="Eşleşmemiş" value={String(unmatched)} color="#f59e0b" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={addSample} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, color: '#60a5fa', padding: '9px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>+ Örnek Ekle</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Ara..." style={{ flex: 1, padding: '9px 13px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9' }} />
        {(['all', 'unmatched', 'matched', 'confirmed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: filter === f ? '#ff5722' : '#273548', color: filter === f ? '#fff' : '#94a3b8' }}>
            {f === 'all' ? 'Tümü' : f === 'unmatched' ? '⏳ Bekliyor' : f === 'matched' ? '🔄 Eşlendi' : '✓ Onaylı'}
          </button>
        ))}
      </div>

      <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.6)' }}>
              {['Tarih', 'Açıklama', 'Tutar', 'Tür', 'Cari Eşleşme', 'Durum', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>İşlem bulunamadı</td></tr>
            ) : sorted.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem' }}>{formatDate(t.date)}</td>
                <td style={{ padding: '12px 16px', color: '#f1f5f9', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                  {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: t.type === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: t.type === 'income' ? '#10b981' : '#ef4444', borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem' }}>
                    {t.type === 'income' ? '📥 Gelen' : '📤 Giden'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {t.status === 'unmatched' ? (
                    <select onChange={e => { if (e.target.value) matchToAccount(t.id, e.target.value); e.target.value = ''; }} style={{ background: '#273548', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', padding: '4px 8px', fontSize: '0.82rem' }}>
                      <option value="">Cari Seç</option>
                      {db.cari.filter(c => !c.deleted).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : t.matchedCariId ? (
                    <span style={{ color: '#10b981', fontSize: '0.85rem' }}>{db.cari.find(c => c.id === t.matchedCariId)?.name || '-'}</span>
                  ) : '-'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: t.status === 'confirmed' ? 'rgba(16,185,129,0.1)' : t.status === 'matched' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)', color: t.status === 'confirmed' ? '#10b981' : t.status === 'matched' ? '#60a5fa' : '#f59e0b', borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {t.status === 'confirmed' ? '✓ Onaylı' : t.status === 'matched' ? '🔄 Eşlendi' : '⏳ Bekliyor'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {t.status !== 'confirmed' && (
                    <button onClick={() => confirm(t.id)} style={{ background: 'rgba(16,185,129,0.1)', border: 'none', borderRadius: 6, color: '#10b981', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>✓ Onayla</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', border: `1px solid ${color}22` }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>{label}</div>
    </div>
  );
}
