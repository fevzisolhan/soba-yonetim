import { Component, type ReactNode, type ErrorInfo } from 'react';
import type { ErrorLog } from '@/types';

const ERROR_LOG_KEY = 'sobaYonetim_errorLog';
const MAX_LOGS = 50;

function loadErrorLogs(): ErrorLog[] {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ErrorLog[];
  } catch {
    return [];
  }
}

function saveErrorLog(entry: ErrorLog): void {
  try {
    const logs = loadErrorLogs();
    const updated = [entry, ...logs].slice(0, MAX_LOGS);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updated));
  } catch {
    // localStorage dolu veya erişilemiyor — sessizce geç
  }
}

export function clearErrorLogs(): void {
  try {
    localStorage.removeItem(ERROR_LOG_KEY);
  } catch {
    // noop
  }
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  logs: ErrorLog[];
  showHistory: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      logs: loadErrorLogs(),
      showHistory: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const entry: ErrorLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      time: new Date().toISOString(),
      url: window.location.href,
    };
    saveErrorLog(entry);
    this.setState({ logs: loadErrorLogs() });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleClearLogs = (): void => {
    clearErrorLogs();
    this.setState({ logs: [] });
  };

  render(): ReactNode {
    const { hasError, error, logs, showHistory } = this.state;

    if (hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#070e1c', color: '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          padding: 24,
        }}>
          <div style={{ maxWidth: 560, width: '100%' }}>
            {/* Hata başlık */}
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 16, padding: '28px 28px 24px', marginBottom: 16,
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>💥</div>
              <h2 style={{ color: '#f87171', fontWeight: 800, fontSize: '1.2rem', marginBottom: 8 }}>
                Beklenmedik Bir Hata Oluştu
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 16, lineHeight: 1.6 }}>
                Uygulama beklenmedik bir hatayla karşılaştı. Verileriniz korunuyor.
                Sayfayı sıfırlayarak devam edebilirsiniz.
              </p>
              {error && (
                <div style={{
                  background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '12px 16px',
                  fontFamily: 'monospace', fontSize: '0.78rem', color: '#fca5a5',
                  maxHeight: 140, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {error.message}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  onClick={this.handleReset}
                  style={{
                    flex: 1, background: 'linear-gradient(135deg, #ff5722, #ff7043)',
                    border: 'none', borderRadius: 10, color: '#fff',
                    padding: '11px 0', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                  }}
                >
                  🔄 Sayfayı Sıfırla
                </button>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, color: '#94a3b8', padding: '11px 18px', cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.85rem',
                  }}
                >
                  Yenile
                </button>
              </div>
            </div>

            {/* Hata geçmişi */}
            {logs.length > 0 && (
              <div style={{
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: 14, overflow: 'hidden',
              }}>
                <button
                  onClick={() => this.setState(s => ({ showHistory: !s.showHistory }))}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '14px 18px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', cursor: 'pointer', color: '#94a3b8',
                    fontSize: '0.85rem', fontWeight: 600,
                  }}
                >
                  <span>🕒 Hata Geçmişi ({logs.length} kayıt)</span>
                  <span>{showHistory ? '▲' : '▼'}</span>
                </button>
                {showHistory && (
                  <div style={{ borderTop: '1px solid #334155', padding: 16 }}>
                    <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {logs.map(log => (
                        <div key={log.id} style={{
                          background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 14px',
                        }}>
                          <div style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 600, marginBottom: 2 }}>
                            {log.message}
                          </div>
                          <div style={{ color: '#475569', fontSize: '0.72rem' }}>
                            {new Date(log.time).toLocaleString('tr-TR')}
                            {log.url && ` · ${log.url}`}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={this.handleClearLogs}
                      style={{
                        marginTop: 10, background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
                        color: '#f87171', padding: '7px 14px', cursor: 'pointer',
                        fontSize: '0.78rem', fontWeight: 600,
                      }}
                    >
                      🗑️ Geçmişi Temizle
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Hata loglarını okuyan yardımcı — SistemSagligi sayfasında kullanılır */
export { loadErrorLogs };
