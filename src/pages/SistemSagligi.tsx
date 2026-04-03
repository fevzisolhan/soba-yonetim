import { useState, useCallback } from 'react';
import { useIntegrityCheck } from '@/hooks/useIntegrityCheck';
import { loadErrorLogs, clearErrorLogs } from '@/components/ErrorBoundary';
import { formatDate } from '@/lib/utils-tr';
import type { DB, IntegrityIssue } from '@/types';

interface Props { db: DB }

type CategoryKey = IntegrityIssue['category'] | 'all';
type SeverityKey = IntegrityIssue['severity'] | 'all';

const SEVERITY_META: Record<IntegrityIssue['severity'], { label: string; color: string; icon: string }> = {
  critical: { label: 'Kritik', color: '#ef4444', icon: '🔴' },
  warning:  { label: 'Uyarı',  color: '#f59e0b', icon: '🟡' },
  info:     { label: 'Bilgi',  color: '#3b82f6', icon: '🔵' },
};

const CATEGORY_META: Record<IntegrityIssue['category'], { label: string; icon: string }> = {
  stok:     { label: 'Stok',    icon: '📦' },
  kasa:     { label: 'Kasa',    icon: '💰' },
  cari:     { label: 'Cari',    icon: '👤' },
  fatura:   { label: 'Fatura',  icon: '🧾' },
  taksit:   { label: 'Taksit',  icon: '📅' },
  referans: { label: 'Referans', icon: '🔗' },
};

export default function SistemSagligi({ db }: Props) {
  const { issues, counts } = useIntegrityCheck(db);
  const [filterCategory, setFilterCategory] = useState<CategoryKey>('all');
  const [filterSeverity, setFilterSeverity] = useState<SeverityKey>('all');
  const [errorLogs, setErrorLogs] = useState(loadErrorLogs);
  const [showErrorLogs, setShowErrorLogs] = useState(false);

  const filtered = issues.filter(i =>
    (filterCategory === 'all' || i.category === filterCategory) &&
    (filterSeverity === 'all' || i.severity === filterSeverity)
  );

  const handleClearLogs = useCallback(() => {
    clearErrorLogs();
    setErrorLogs([]);
  }, []);

  const systemHealthScore = counts.total === 0
    ? 100
    : Math.max(0, Math.round(100 - counts.critical * 20 - counts.warning * 5 - counts.info * 1));

  const healthColor = systemHealthScore >= 90 ? '#22c55e' : systemHealthScore >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Başlık */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h2 style={{ color: '#f1f5f9', fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>
            🏥 Sistem Sağlığı
          </h2>
          <p style={{ color: '#475569', fontSize: '0.78rem', margin: '4px 0 0' }}>
            Veri bütünlüğü ve muhasebe tutarlılığı denetimi
          </p>
        </div>
        {/* Skor */}
        <div style={{
          background: `${healthColor}12`, border: `1px solid ${healthColor}44`,
          borderRadius: 14, padding: '12px 20px', textAlign: 'center', minWidth: 120,
        }}>
          <div style={{ color: healthColor, fontWeight: 900, fontSize: '1.8rem', lineHeight: 1 }}>
            {systemHealthScore}
          </div>
          <div style={{ color: `${healthColor}aa`, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>
            Sağlık Skoru
          </div>
        </div>
      </div>

      {/* Özet sayaçlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
        {(Object.entries(SEVERITY_META) as [IntegrityIssue['severity'], typeof SEVERITY_META[keyof typeof SEVERITY_META]][]).map(([sev, meta]) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(f => f === sev ? 'all' : sev)}
            style={{
              background: filterSeverity === sev ? `${meta.color}18` : 'rgba(30,41,59,0.6)',
              border: `1px solid ${filterSeverity === sev ? meta.color + '55' : '#334155'}`,
              borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ color: meta.color, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1 }}>
              {counts[sev]}
            </div>
            <div style={{ color: `${meta.color}bb`, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>
              {meta.icon} {meta.label}
            </div>
          </button>
        ))}
        <div style={{
          background: 'rgba(30,41,59,0.6)', border: '1px solid #334155',
          borderRadius: 12, padding: '14px 16px', textAlign: 'center',
        }}>
          <div style={{ color: '#94a3b8', fontWeight: 900, fontSize: '1.5rem', lineHeight: 1 }}>
            {counts.total}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>
            📋 Toplam
          </div>
        </div>
      </div>

      {/* Kategori filtreleri */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterCategory('all')}
          style={catBtnStyle(filterCategory === 'all', '#64748b')}
        >
          Tümü
        </button>
        {(Object.entries(CATEGORY_META) as [IntegrityIssue['category'], typeof CATEGORY_META[keyof typeof CATEGORY_META]][]).map(([cat, meta]) => {
          const catCount = issues.filter(i => i.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(f => f === cat ? 'all' : cat)}
              style={catBtnStyle(filterCategory === cat, '#ff5722')}
            >
              {meta.icon} {meta.label} {catCount > 0 && `(${catCount})`}
            </button>
          );
        })}
      </div>

      {/* Sorun listesi */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 14, padding: '32px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '1rem' }}>
            {counts.total === 0 ? 'Veri bütünlüğü tam — sorun bulunamadı!' : 'Bu filtre için sorun yok'}
          </div>
          {counts.total === 0 && (
            <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: 6 }}>
              Tüm muhasebe kuralları doğrulandı.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(issue => {
            const sv = SEVERITY_META[issue.severity];
            const cat = CATEGORY_META[issue.category];
            return (
              <div key={issue.id} style={{
                background: `${sv.color}0a`, border: `1px solid ${sv.color}33`,
                borderRadius: 12, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: sv.color,
                    flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${sv.color}`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.88rem' }}>
                        {issue.message}
                      </span>
                      <span style={{
                        background: `${sv.color}22`, color: sv.color,
                        borderRadius: 6, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {sv.icon} {sv.label}
                      </span>
                      <span style={{
                        background: 'rgba(255,255,255,0.05)', color: '#64748b',
                        borderRadius: 6, padding: '1px 7px', fontSize: '0.7rem',
                        flexShrink: 0,
                      }}>
                        {cat.icon} {cat.label}
                      </span>
                    </div>
                    {issue.detail && (
                      <div style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5 }}>
                        {issue.detail}
                      </div>
                    )}
                    <div style={{ color: '#334155', fontSize: '0.7rem', marginTop: 4 }}>
                      {formatDate(issue.detectedAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Runtime Hata Geçmişi */}
      <div style={{ marginTop: 28 }}>
        <button
          onClick={() => setShowErrorLogs(v => !v)}
          style={{
            width: '100%', background: '#1e293b', border: '1px solid #334155',
            borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', cursor: 'pointer', color: '#94a3b8',
            fontSize: '0.85rem', fontWeight: 600,
          }}
        >
          <span>🕒 Runtime Hata Geçmişi {errorLogs.length > 0 ? `(${errorLogs.length})` : '(temiz)'}</span>
          <span>{showErrorLogs ? '▲' : '▼'}</span>
        </button>

        {showErrorLogs && (
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderTop: 'none',
            borderRadius: '0 0 12px 12px', padding: 16,
          }}>
            {errorLogs.length === 0 ? (
              <div style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                ✅ Hata kaydı bulunamadı
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
                  {errorLogs.map(log => (
                    <div key={log.id} style={{
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: 10, padding: '10px 14px',
                    }}>
                      <div style={{ color: '#f87171', fontSize: '0.82rem', fontWeight: 600, marginBottom: 2 }}>
                        {log.message}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.72rem' }}>
                        {formatDate(log.time)}
                      </div>
                      {log.stack && (
                        <details style={{ marginTop: 6 }}>
                          <summary style={{ color: '#475569', fontSize: '0.7rem', cursor: 'pointer' }}>
                            Stack trace
                          </summary>
                          <pre style={{
                            marginTop: 6, fontFamily: 'monospace', fontSize: '0.68rem',
                            color: '#64748b', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            maxHeight: 120, overflowY: 'auto',
                          }}>
                            {log.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleClearLogs}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8, color: '#f87171', padding: '7px 14px',
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  }}
                >
                  🗑️ Hata Geçmişini Temizle
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function catBtnStyle(active: boolean, activeColor: string): React.CSSProperties {
  return {
    background: active ? `${activeColor}18` : 'rgba(30,41,59,0.5)',
    border: `1px solid ${active ? activeColor + '55' : '#334155'}`,
    borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
    color: active ? activeColor : '#64748b', fontWeight: active ? 700 : 500,
    fontSize: '0.8rem', transition: 'all 0.15s',
  };
}
