import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { formatMoney } from '@/lib/utils-tr';
import type { DB } from '@/types';

interface Props { db: DB; }

const COLORS = ['#ff5722', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function Reports({ db }: Props) {
  const monthlyData = useMemo(() => {
    const map: Record<string, { revenue: number; profit: number; count: number }> = {};
    db.sales.filter(s => s.status === 'tamamlandi').forEach(s => {
      const key = new Date(s.createdAt).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { revenue: 0, profit: 0, count: 0 };
      map[key].revenue += s.total;
      map[key].profit += s.profit;
      map[key].count++;
    });
    return Object.entries(map).slice(-12).map(([name, v]) => ({ name, ...v }));
  }, [db.sales]);

  const categoryData = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    db.sales.filter(s => s.status === 'tamamlandi').forEach(s => {
      const cat = s.productCategory || 'Diğer';
      if (!map[cat]) map[cat] = { revenue: 0, count: 0 };
      map[cat].revenue += s.total;
      map[cat].count++;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [db.sales]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; count: number; profit: number }> = {};
    db.sales.filter(s => s.status === 'tamamlandi').forEach(s => {
      const id = s.productId || s.productName;
      if (!map[id]) map[id] = { name: s.productName, revenue: 0, count: 0, profit: 0 };
      map[id].revenue += s.total;
      map[id].count += s.quantity;
      map[id].profit += s.profit;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [db.sales]);

  const paymentData = useMemo(() => {
    const map: Record<string, number> = {};
    db.sales.filter(s => s.status === 'tamamlandi').forEach(s => {
      map[s.payment] = (map[s.payment] || 0) + s.total;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [db.sales]);

  const totals = useMemo(() => {
    const sales = db.sales.filter(s => s.status === 'tamamlandi');
    return {
      revenue: sales.reduce((s, x) => s + x.total, 0),
      profit: sales.reduce((s, x) => s + x.profit, 0),
      count: sales.length,
      returns: db.sales.filter(s => s.status === 'iade').length,
      avgSale: sales.length ? sales.reduce((s, x) => s + x.total, 0) / sales.length : 0,
    };
  }, [db.sales]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Toplam Ciro', value: formatMoney(totals.revenue), color: '#10b981' },
          { label: 'Toplam Kâr', value: formatMoney(totals.profit), color: '#3b82f6' },
          { label: 'Toplam Satış', value: String(totals.count), color: '#f59e0b' },
          { label: 'Ort. Satış', value: formatMoney(totals.avgSale), color: '#8b5cf6' },
          { label: 'İade', value: String(totals.returns), color: '#ef4444' },
          { label: 'Kâr Oranı', value: `%${totals.revenue ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}`, color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#1e293b', borderRadius: 14, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, color: '#f1f5f9' }}>📅 Aylık Ciro & Kâr</h3>
          {monthlyData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip formatter={(v: number) => [formatMoney(v), '']} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="revenue" fill="#ff5722" name="Ciro" radius={[3,3,0,0]} />
                <Bar dataKey="profit" fill="#10b981" name="Kâr" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#1e293b', borderRadius: 14, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, color: '#f1f5f9' }}>🥧 Kategoriye Göre</h3>
          {categoryData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`} labelLine={false}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [formatMoney(v), '']} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#1e293b', borderRadius: 14, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, color: '#f1f5f9' }}>💳 Ödeme Şekilleri</h3>
          {paymentData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name }) => name}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [formatMoney(v), '']} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#1e293b', borderRadius: 14, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16, color: '#f1f5f9' }}>🏆 En Çok Satan Ürünler</h3>
          {topProducts.length === 0 ? (
            <EmptyChart />
          ) : (
            <div>
              {topProducts.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.76rem' }}>{p.count} adet</div>
                  </div>
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>{formatMoney(p.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: '#475569' }}>Veri yok</div>;
}
