import { useMemo } from 'react';
import { formatMoney } from '@/lib/utils-tr';
import type { DB } from '@/types';

interface Props { db: DB }

type Status = 'ok' | 'warn' | 'err';

const COLORS: Record<Status, { bg: string; border: string; text: string; label: string; dot: string }> = {
  ok:   { bg: '#0d2e1a', border: '#22c55e', text: '#4ade80', label: 'Tamam',   dot: '#22c55e' },
  warn: { bg: '#2e2500', border: '#f59e0b', text: '#fbbf24', label: 'Uyarı',   dot: '#f59e0b' },
  err:  { bg: '#2e0d0d', border: '#ef4444', text: '#f87171', label: 'Kritik',  dot: '#ef4444' },
};

function kasaBal(kasa: DB['kasa'], kasaId: string): number {
  return kasa
    .filter(k => !k.deleted && k.kasa === kasaId)
    .reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
}

export default function KontrolHalkasi({ db }: Props) {
  const m = useMemo(() => {
    const nakit      = kasaBal(db.kasa, 'nakit');
    const banka      = kasaBal(db.kasa, 'banka');
    const posZiraat  = kasaBal(db.kasa, 'pos_ziraat');
    const posIs      = kasaBal(db.kasa, 'pos_is');
    const posYk      = kasaBal(db.kasa, 'pos_yk');
    const totalKasa  = nakit + banka + posZiraat + posIs + posYk;

    const outOfStock = db.products.filter(p => p.stock === 0).length;
    const lowStock   = db.products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const totalStock = db.products.reduce((s, p) => s + p.stock, 0);

    const today = new Date().toDateString();
    const todaySales = db.sales.filter(s => s.status === 'tamamlandi' && new Date(s.createdAt).toDateString() === today);

    const pendingOrders    = db.orders.filter(o => o.status === 'bekliyor').length;
    const inTransitOrders  = db.orders.filter(o => o.status === 'yolda').length;
    const completedToday   = db.orders.filter(o => o.status === 'tamamlandi' && new Date(o.updatedAt).toDateString() === today).length;

    const totalReceivable = db.cari.filter(c => c.type === 'musteri' && c.balance > 0).reduce((s, c) => s + c.balance, 0);
    const totalPayable    = db.cari.filter(c => c.type === 'tedarikci' && c.balance > 0).reduce((s, c) => s + c.balance, 0);

    // Ortak çekim / tahsilat — ortakEmanetler tablosundan
    const ortakCekim     = (db.ortakEmanetler || []).filter(e => e.type === 'emanet').reduce((s, e) => s + e.amount, 0);
    const ortakTahsilat  = (db.ortakEmanetler || []).filter(e => e.type === 'iade').reduce((s, e) => s + e.amount, 0);

    return {
      nakit, banka, posZiraat, posIs, posYk, totalKasa,
      outOfStock, lowStock, totalStock,
      todaySalesCount: todaySales.length,
      todaySalesAmount: todaySales.reduce((s, x) => s + x.total, 0),
      pendingOrders, inTransitOrders, completedToday,
      totalReceivable, totalPayable,
      ortakCekim, ortakTahsilat,
      netSermaye: nakit + banka + posZiraat + posIs + posYk + totalReceivable - totalPayable,
    };
  }, [db]);

  function getStatus(node: string): Status {
    switch (node) {
      case 'stok':
        if (m.outOfStock > 0) return 'err';
        if (m.lowStock > 0)   return 'warn';
        return 'ok';
      case 'satis':
        return m.todaySalesCount === 0 ? 'warn' : 'ok';
      case 'siparis':
        return m.pendingOrders > 0 ? 'warn' : 'ok';
      case 'malgiris':
        if (m.inTransitOrders > 0) return 'warn';
        return 'ok';
      case 'kasa':
        if (m.totalKasa <= 0)       return 'err';
        if (m.totalKasa < 5000)     return 'warn';
        return 'ok';
      case 'pos_ziraat':
        return m.posZiraat === 0 ? 'warn' : 'ok';
      case 'pos_is':
        return m.posIs === 0 ? 'warn' : 'ok';
      case 'pos_yk':
        return m.posYk === 0 ? 'warn' : 'ok';
      case 'ocek':
        return m.ortakCekim > 0 ? 'warn' : 'ok';
      case 'disborc':
        return m.totalPayable > 100000 ? 'err' : m.totalPayable > 0 ? 'warn' : 'ok';
      case 'otahsilat':
        return m.ortakTahsilat > 0 ? 'warn' : 'ok';
      case 'tahsilat':
        if (m.todaySalesCount > 0 && m.totalKasa <= 0) return 'warn';
        return 'ok';
      case 'tedarikci':
        return m.totalPayable > 100000 ? 'err' : m.totalPayable > 0 ? 'warn' : 'ok';
      default:
        return 'ok';
    }
  }

  function getSub(node: string): string {
    switch (node) {
      case 'stok':      return m.outOfStock > 0 ? `${m.outOfStock} bitti` : m.lowStock > 0 ? `${m.lowStock} az` : `${m.totalStock} adet`;
      case 'satis':     return m.todaySalesCount > 0 ? `${m.todaySalesCount} satış · ${formatMoney(m.todaySalesAmount)}` : 'Bugün satış yok';
      case 'siparis':   return m.pendingOrders > 0 ? `${m.pendingOrders} bekliyor` : 'Bekleyen yok';
      case 'malgiris':  return m.inTransitOrders > 0 ? `${m.inTransitOrders} yolda` : m.completedToday > 0 ? `${m.completedToday} teslim aldı` : 'Yok';
      case 'kasa':      return formatMoney(m.totalKasa);
      case 'pos_ziraat':return formatMoney(m.posZiraat);
      case 'pos_is':    return formatMoney(m.posIs);
      case 'pos_yk':    return formatMoney(m.posYk);
      case 'ocek':      return m.ortakCekim > 0 ? formatMoney(m.ortakCekim) : 'Yok';
      case 'disborc':   return m.totalPayable > 0 ? formatMoney(m.totalPayable) : 'Yok';
      case 'otahsilat': return m.ortakTahsilat > 0 ? formatMoney(m.ortakTahsilat) : 'Yok';
      case 'tahsilat':  return formatMoney(m.totalReceivable);
      case 'tedarikci': return m.totalPayable > 0 ? `${formatMoney(m.totalPayable)} borç` : 'Borç yok';
      default:          return '';
    }
  }

  // Özet sayaçları
  const errCount  = NODES.filter(n => getStatus(n.id) === 'err').length;
  const warnCount = NODES.filter(n => getStatus(n.id) === 'warn').length;
  const okCount   = NODES.filter(n => getStatus(n.id) === 'ok').length;

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Başlık & Özet */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#f1f5f9', fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>⚡ Canlı Muhasebe Kontrol Halkası</h2>
          <p style={{ color: '#475569', fontSize: '0.78rem', margin: '4px 0 0' }}>Tüm kanallar gerçek zamanlı izleniyor</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge count={errCount}  color="#ef4444" label="Kritik" />
          <Badge count={warnCount} color="#f59e0b" label="Uyarı" />
          <Badge count={okCount}   color="#22c55e" label="Tamam" />
        </div>
      </div>

      {/* Net Sermaye Bandı */}
      <div style={{
        background: m.netSermaye >= 0 ? 'linear-gradient(90deg,rgba(34,197,94,.1),rgba(34,197,94,.04))' : 'linear-gradient(90deg,rgba(239,68,68,.1),rgba(239,68,68,.04))',
        border: `1px solid ${m.netSermaye >= 0 ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
        borderRadius: 12, padding: '12px 20px', marginBottom: 24,
        display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <NetItem label="Nakit" value={m.nakit}           color="#06b6d4" />
        <span style={{ color: '#334155' }}>+</span>
        <NetItem label="Banka" value={m.banka}           color="#6366f1" />
        <span style={{ color: '#334155' }}>+</span>
        <NetItem label="POS Toplam" value={m.posZiraat + m.posIs + m.posYk} color="#8b5cf6" />
        <span style={{ color: '#334155' }}>+</span>
        <NetItem label="Alacak" value={m.totalReceivable} color="#10b981" />
        <span style={{ color: '#ef4444' }}>−</span>
        <NetItem label="Borç" value={m.totalPayable}     color="#ef4444" />
        <span style={{ color: '#334155', fontSize: '1.3rem', fontWeight: 900 }}>=</span>
        <NetItem label="Net Sermaye" value={m.netSermaye} color={m.netSermaye >= 0 ? '#22c55e' : '#ef4444'} big />
      </div>

      {/* Halka */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 780, height: 780, maxWidth: '100%' }}>
          {/* SVG bağlantı okları */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {CONNECTIONS.map((c, i) => {
              const from = NODES.find(n => n.id === c[0]);
              const to   = NODES.find(n => n.id === c[1]);
              if (!from || !to) return null;
              const x1 = from.x + 75; const y1 = from.y + 35;
              const x2 = to.x + 75;   const y2 = to.y + 35;
              const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
              return (
                <g key={i}>
                  <path d={`M${x1},${y1} Q${mx},${my - 30} ${x2},${y2}`} fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth={1.5} strokeDasharray="5 4" />
                  <polygon points={`${x2},${y2} ${x2 - 6},${y2 - 10} ${x2 + 6},${y2 - 10}`}
                    fill="rgba(100,116,139,0.4)"
                    transform={`rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90},${x2},${y2})`} />
                </g>
              );
            })}
          </svg>

          {/* Node'lar */}
          {NODES.map(node => {
            const s = getStatus(node.id);
            const c = COLORS[s];
            return (
              <div key={node.id} style={{
                position: 'absolute',
                left: node.x, top: node.y,
                width: 150, height: 70,
                borderRadius: 40,
                background: c.bg,
                border: `2px solid ${c.border}`,
                boxShadow: `0 0 16px ${c.border}44, 0 4px 12px rgba(0,0,0,.4)`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'default',
                transition: 'all 0.4s ease',
                animation: s === 'err' ? 'pulse 1.5s infinite' : undefined,
              }}>
                <div style={{ color: c.text, fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {node.label}
                </div>
                <div style={{ color: `${c.text}bb`, fontSize: '0.65rem', marginTop: 2, maxWidth: 130, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getSub(node.id)}
                </div>
                <div style={{ position: 'absolute', top: 6, right: 10, width: 8, height: 8, borderRadius: '50%', background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 16px #ef444488, 0 4px 12px rgba(0,0,0,.4); }
          50%       { box-shadow: 0 0 32px #ef4444cc, 0 4px 20px rgba(0,0,0,.5); }
        }
      `}</style>
    </div>
  );
}

// ─── Yardımcı Bileşenler ───────────────────────────────────────────────────

function Badge({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
      <div style={{ color, fontWeight: 900, fontSize: '1.1rem', lineHeight: 1 }}>{count}</div>
      <div style={{ color: `${color}99`, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function NetItem({ label, value, color, big }: { label: string; value: number; color: string; big?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ color, fontWeight: big ? 900 : 700, fontSize: big ? '1.15rem' : '0.9rem' }}>{formatMoney(value)}</div>
    </div>
  );
}

// ─── Node Konumları (780×780 tuval) ───────────────────────────────────────

const NODES = [
  { id: 'tedarikci',  label: 'TEDARİKÇİ',       x: 315, y: 0   },
  { id: 'disborc',    label: 'ORTAK DIŞ BORÇ',   x: 590, y: 110 },
  { id: 'kasa',       label: 'KASA / BANKA',     x: 608, y: 320 },
  { id: 'pos_ziraat', label: 'POS ZİRAAT',       x: 540, y: 535 },
  { id: 'pos_is',     label: 'POS İŞ',           x: 315, y: 690 },
  { id: 'pos_yk',     label: 'POS YAPIKREDI',    x: 80,  y: 535 },
  { id: 'tahsilat',   label: 'TAHSİLAT',         x: 10,  y: 320 },
  { id: 'otahsilat',  label: 'ORTAK TAHSİLAT',   x: 30,  y: 130 },
  { id: 'satis',      label: 'SATIŞ',            x: 120, y: 530 },
  { id: 'stok',       label: 'STOK',             x: 10,  y: 530 }, // updated below
  { id: 'malgiris',   label: 'MAL GİRİŞİ',       x: 560, y: 530 }, // updated below
  { id: 'siparis',    label: 'SİPARİŞ',          x: 315, y: 690 }, // will adjust
  { id: 'ocek',       label: 'ORTAK ÇEKİM',      x: 315, y: 530 },
] as const;

// Gerçek halka konumları — 13 node için çember üzerinde eşit aralıklı
const NODE_COUNT = 13;
const CX = 390; const CY = 390; const R = 320;

const RING_NODES: { id: string; label: string; x: number; y: number }[] = [
  'tedarikci', 'disborc', 'kasa', 'pos_ziraat', 'pos_is', 'pos_yk',
  'tahsilat', 'otahsilat', 'satis', 'stok', 'malgiris', 'siparis', 'ocek',
].map((id, i) => {
  const angle = (i / NODE_COUNT) * 2 * Math.PI - Math.PI / 2;
  return {
    id,
    label: NODES.find(n => n.id === id)?.label ?? id,
    x: Math.round(CX + R * Math.cos(angle)) - 75,
    y: Math.round(CY + R * Math.sin(angle)) - 35,
  };
});

// Bağlantı akışı (halka + çapraz)
const CONNECTIONS: [string, string][] = [
  ['tedarikci', 'siparis'],
  ['siparis',   'malgiris'],
  ['malgiris',  'stok'],
  ['stok',      'satis'],
  ['satis',     'tahsilat'],
  ['tahsilat',  'kasa'],
  ['kasa',      'pos_ziraat'],
  ['kasa',      'pos_is'],
  ['kasa',      'pos_yk'],
  ['disborc',   'kasa'],
  ['otahsilat', 'kasa'],
  ['ocek',      'kasa'],
  ['tedarikci', 'disborc'],
];

// RING_NODES'u kullan (çember yerleşimi)
Object.assign(NODES, RING_NODES);
