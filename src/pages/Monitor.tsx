import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { genId, formatDate } from '@/lib/utils-tr';
import type { DB, MonitorRule } from '@/types';

interface Props { db: DB; save: (fn: (prev: DB) => DB) => void; }

const ruleTypes = ['stok_min', 'stok_sifir', 'kasa_min', 'alacak_vadeli', 'borc_vadeli', 'satis_hedef'] as const;
const ruleLabels: Record<string, string> = { stok_min: '📦 Düşük Stok', stok_sifir: '🔴 Biten Stok', kasa_min: '💰 Düşük Kasa', alacak_vadeli: '📥 Vadeli Alacak', borc_vadeli: '📤 Vadeli Borç', satis_hedef: '🎯 Satış Hedefi' };
const levelColors: Record<string, string> = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

export default function Monitor({ db, save }: Props) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<MonitorRule>>({ name: '', type: 'stok_min', level: 'warning', interval: 60, popup: true, active: true, threshold: 0 });

  const openAdd = () => { setForm({ name: '', type: 'stok_min', level: 'warning', interval: 60, popup: true, active: true, threshold: 0 }); setEditId(null); setModalOpen(true); };
  const openEdit = (r: MonitorRule) => { setForm({ ...r }); setEditId(r.id); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name) { showToast('Kural adı gerekli!', 'error'); return; }
    const nowIso = new Date().toISOString();
    save(prev => {
      const rules = [...prev.monitorRules];
      if (editId) {
        const i = rules.findIndex(r => r.id === editId);
        if (i >= 0) rules[i] = { ...rules[i], ...form, updatedAt: nowIso } as MonitorRule;
        showToast('Kural güncellendi!');
      } else {
        rules.push({ id: genId(), createdAt: nowIso, updatedAt: nowIso, name: '', type: 'stok_min', level: 'warning', interval: 60, popup: true, active: true, ...form } as MonitorRule);
        showToast('Kural eklendi!');
      }
      return { ...prev, monitorRules: rules };
    });
    setModalOpen(false);
  };

  const deleteRule = (id: string) => {
    showConfirm('Kural Sil', 'Bu kuralı silmek istediğinizden emin misiniz?', () => {
      save(prev => ({ ...prev, monitorRules: prev.monitorRules.filter(r => r.id !== id) }));
      showToast('Kural silindi!');
    });
  };

  const toggleActive = (id: string) => {
    save(prev => ({ ...prev, monitorRules: prev.monitorRules.map(r => r.id === id ? { ...r, active: !r.active } : r) }));
  };

  // Aktif uyarıları hesapla
  const alerts = db.monitorRules.filter(r => r.active).flatMap(r => {
    const msgs: { level: string; msg: string }[] = [];
    if (r.type === 'stok_sifir') {
      const count = db.products.filter(p => p.stock === 0).length;
      if (count > 0) msgs.push({ level: r.level, msg: `${count} ürün stoğu bitti!` });
    } else if (r.type === 'stok_min') {
      const count = db.products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
      if (count > 0) msgs.push({ level: r.level, msg: `${count} üründe düşük stok uyarısı!` });
    } else if (r.type === 'kasa_min' && r.threshold !== undefined) {
      const kasaId = r.kasa || 'nakit';
      const bal = db.kasa.filter(k => k.kasa === kasaId).reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
      if (bal < r.threshold) msgs.push({ level: r.level, msg: `${kasaId} kasası düşük: ₺${bal.toFixed(2)}` });
    }
    return msgs.map(m => ({ ...m, ruleName: r.name }));
  });

  return (
    <div>
      {alerts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 12 }}>🔔 Aktif Uyarılar</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ background: `${levelColors[a.level] || '#94a3b8'}15`, border: `1px solid ${levelColors[a.level] || '#94a3b8'}40`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: levelColors[a.level] || '#94a3b8', flexShrink: 0 }} />
                <span style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{a.msg}</span>
                <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: 'auto' }}>{a.ruleName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={openAdd} style={{ background: '#ff5722', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>+ Yeni Kural</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {db.monitorRules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Kural bulunamadı</div>
        ) : db.monitorRules.map(r => (
          <div key={r.id} style={{ background: '#1e293b', borderRadius: 12, border: `1px solid ${r.active ? levelColors[r.level] + '33' : '#33415555'}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, opacity: r.active ? 1 : 0.6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{r.name}</span>
                <span style={{ background: `${levelColors[r.level]}22`, color: levelColors[r.level], borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{r.level}</span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.82rem' }}>{ruleLabels[r.type] || r.type} · Her {r.interval}dk</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => toggleActive(r.id)} style={{ background: r.active ? 'rgba(16,185,129,0.15)' : '#273548', border: 'none', borderRadius: 8, color: r.active ? '#10b981' : '#64748b', padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                {r.active ? '✓ Aktif' : '○ Pasif'}
              </button>
              {!r.isDefault && <button onClick={() => openEdit(r)} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 8, color: '#60a5fa', padding: '7px 10px', cursor: 'pointer' }}>✏️</button>}
              {!r.isDefault && <button onClick={() => deleteRule(r.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, color: '#ef4444', padding: '7px 10px', cursor: 'pointer' }}>🗑️</button>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? '✏️ Kural Düzenle' : '➕ Yeni Kural'}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div><label style={lbl}>Kural Adı *</label><input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} /></div>
          <div>
            <label style={lbl}>Kural Tipi</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as MonitorRule['type'] }))} style={inp}>
              {ruleTypes.map(t => <option key={t} value={t}>{ruleLabels[t]}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Seviye</label>
            <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as MonitorRule['level'] }))} style={inp}>
              <option value="critical">🔴 Kritik</option>
              <option value="warning">🟡 Uyarı</option>
              <option value="info">🔵 Bilgi</option>
            </select>
          </div>
          {(form.type === 'kasa_min' || form.type === 'satis_hedef') && (
            <div><label style={lbl}>Eşik Değeri (₺)</label><input type="number" value={form.threshold || 0} onChange={e => setForm(f => ({ ...f, threshold: parseFloat(e.target.value) || 0 }))} style={inp} /></div>
          )}
          <div><label style={lbl}>Kontrol Aralığı (dakika)</label><input type="number" value={form.interval || 60} onChange={e => setForm(f => ({ ...f, interval: parseInt(e.target.value) || 60 }))} style={inp} min={1} /></div>
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
