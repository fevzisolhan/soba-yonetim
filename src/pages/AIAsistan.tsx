import { useState, useRef, useEffect, useCallback } from 'react';
import { formatMoney } from '@/lib/utils-tr';
import type { DB } from '@/types';
import DOMPurify from 'dompurify';

interface Props { db: DB; }

interface Message { role: 'user' | 'assistant'; content: string; }

const QUICK_PROMPTS = [
  { label: '📊 Bu Ay Analiz', prompt: 'Bu ayın satış performansını analiz et. Geçen aya göre nasıl?' },
  { label: '📦 Stok Durumu', prompt: 'Stoklarımın durumunu değerlendir. Hangi ürünleri sipariş etmeliyim?' },
  { label: '💰 Kâr Analizi', prompt: 'En kârlı ürünlerim hangileri? Kâr marjı analizi yap.' },
  { label: '🔮 Satış Tahmini', prompt: 'Verilerime göre önümüzdeki ay için satış tahmini yap.' },
  { label: '👤 Müşteri Analizi', prompt: 'Müşteri ve alacak durumumu değerlendir.' },
  { label: '🏭 Tedarikçi Öneri', prompt: 'Tedarikçilerimle ilgili ne gibi iyileştirmeler yapabilirim?' },
  { label: '💡 İpuçları', prompt: 'Bu işletme için en kritik 5 önerin nedir? Madde madde yaz.' },
  { label: '📈 Büyüme Stratejisi', prompt: 'Satışları artırmak için ne yapabilirim? Spesifik öneriler ver.' },
];

function buildContext(db: DB): string {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const monthSales = db.sales.filter(s => s.status === 'tamamlandi' && new Date(s.createdAt) >= monthStart);
  const lastMonthSales = db.sales.filter(s => s.status === 'tamamlandi' && new Date(s.createdAt) >= lastMonthStart && new Date(s.createdAt) <= lastMonthEnd);

  const totalKasa = db.kasa.reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
  const nakit = db.kasa.filter(k => k.kasa === 'nakit').reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
  const banka = totalKasa - nakit;

  const outStock = db.products.filter(p => p.stock === 0);
  const lowStock = db.products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const stokDeger = db.products.reduce((s, p) => s + p.cost * p.stock, 0);

  const topProducts = [...db.products].sort((a, b) => {
    const aRev = db.sales.filter(s => s.productId === a.id && s.status === 'tamamlandi').reduce((s, sale) => s + sale.total, 0);
    const bRev = db.sales.filter(s => s.productId === b.id && s.status === 'tamamlandi').reduce((s, sale) => s + sale.total, 0);
    return bRev - aRev;
  }).slice(0, 5);

  const alacak = db.cari.filter(c => c.type === 'musteri' && c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const borc = db.cari.filter(c => c.type === 'tedarikci' && c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0);

  const catSales: Record<string, number> = {};
  db.sales.filter(s => s.status === 'tamamlandi').forEach(s => {
    const cat = s.productCategory || 'Diğer';
    catSales[cat] = (catSales[cat] || 0) + s.total;
  });

  return `
## İşletme Özeti (${today.toLocaleDateString('tr-TR')})

### 📊 Satış Verileri
- Bu ay: ${monthSales.length} satış, ${formatMoney(monthSales.reduce((s, sale) => s + sale.total, 0))} ciro, ${formatMoney(monthSales.reduce((s, sale) => s + sale.profit, 0))} kâr
- Geçen ay: ${lastMonthSales.length} satış, ${formatMoney(lastMonthSales.reduce((s, sale) => s + sale.total, 0))} ciro
- Toplam tüm zamanlar: ${db.sales.filter(s => s.status === 'tamamlandi').length} satış

### 💰 Kasa Durumu
- Toplam: ${formatMoney(totalKasa)}
- Nakit: ${formatMoney(nakit)}
- Banka: ${formatMoney(banka)}

### 📦 Stok Durumu
- Toplam ürün sayısı: ${db.products.length}
- Stok değeri: ${formatMoney(stokDeger)}
- Stok biten ürünler: ${outStock.length} adet (${outStock.slice(0, 3).map(p => p.name).join(', ')}${outStock.length > 3 ? '...' : ''})
- Az stoklu ürünler: ${lowStock.length} adet

### 🏆 En İyi Ürünler (gelire göre)
${topProducts.map(p => {
  const rev = db.sales.filter(s => s.productId === p.id && s.status === 'tamamlandi').reduce((s, sale) => s + sale.total, 0);
  return `- ${p.name}: ${formatMoney(rev)} (stok: ${p.stock})`;
}).join('\n')}

### 📂 Kategorilere Göre Satış
${Object.entries(catSales).sort((a, b) => b[1] - a[1]).map(([cat, val]) => `- ${cat}: ${formatMoney(val)}`).join('\n') || '- Veri yok'}

### 👤 Cari Hesaplar
- Müşteri alacağı: ${formatMoney(alacak)} (${db.cari.filter(c => c.type === 'musteri' && c.balance > 0).length} müşteri)
- Tedarikçi borcu: ${formatMoney(borc)}

### 🏭 Tedarikçiler
- Toplam tedarikçi: ${db.suppliers.length}
- Bekleyen sipariş: ${db.orders.filter(o => o.status === 'bekliyor').length}
`.trim();
}

function MarkdownText({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 style="color:#ff7043;font-size:0.9rem;margin:10px 0 4px;font-weight:700">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#f1f5f9;font-size:1rem;margin:12px 0 6px;font-weight:800">$1</h3>')
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, '<ul style="list-style:none;padding:0;margin:6px 0">$&</ul>')
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g, '<br/>');
  const safeHtml = DOMPurify.sanitize(html);
  return <span dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

const API_BASE = '';

export default function AIAsistan({ db }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context] = useState(() => buildContext(db));
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput('');
    setLoading(true);
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    const aiMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, aiMsg]);

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, context }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream yok');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.done) break;
            if (data.content) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + data.content };
                return updated;
              });
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Bağlantı hatası';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `❌ Hata: ${errMsg}. API sunucusunun çalıştığından emin olun.` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, context]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => setMessages([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0, boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>🤖</div>
        <div>
          <h2 style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '1.1rem', letterSpacing: '-0.01em' }}>Soba AI Asistan</h2>
          <p style={{ color: '#475569', fontSize: '0.82rem' }}>İşletme verilerinizi analiz eder · Satış, stok ve finansal öneriler sunar</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {messages.length > 0 && <button onClick={clearChat} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#475569', padding: '7px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>🗑️ Temizle</button>}
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '7px 14px', color: '#818cf8', fontSize: '0.8rem', fontWeight: 600 }}>
            🔒 Replit AI · GPT-5 Mini
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#334155', fontSize: '0.8rem', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hızlı Sorular</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)'; (e.currentTarget as HTMLButtonElement).style.color = '#818cf8'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '2px 4px' }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: '4rem', marginBottom: 16, opacity: 0.4 }}>🤖</div>
            <h3 style={{ color: '#334155', fontWeight: 700, marginBottom: 8 }}>İşletmenizle ilgili her şeyi sorabilirsiniz</h3>
            <p style={{ color: '#1e3a5f', fontSize: '0.85rem', maxWidth: 380, lineHeight: 1.6 }}>Satış analizinden stok optimizasyonuna, kâr hesaplamalarından tedarikçi önerilerine kadar. Mevcut verilerinizi baz alarak yanıt verir.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: msg.role === 'user' ? 'linear-gradient(135deg, #ff5722, #ff7043)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0, boxShadow: msg.role === 'assistant' ? '0 2px 12px rgba(99,102,241,0.3)' : '0 2px 12px rgba(255,87,34,0.3)' }}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div style={{ maxWidth: '78%', background: msg.role === 'user' ? 'linear-gradient(135deg, rgba(255,87,34,0.12), rgba(255,87,34,0.06))' : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.04))', border: `1px solid ${msg.role === 'user' ? 'rgba(255,87,34,0.2)' : 'rgba(99,102,241,0.15)'}`, borderRadius: 14, padding: '13px 16px' }}>
              <div style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.65 }}>
                {msg.role === 'assistant' ? <MarkdownText text={msg.content || '...'} /> : msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.content === '' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', boxShadow: '0 2px 12px rgba(99,102,241,0.3)' }}>🤖</div>
            <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: '13px 18px' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Sorunuzu yazın... (Enter: gönder, Shift+Enter: yeni satır)"
            rows={2}
            disabled={loading}
            style={{ width: '100%', padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, color: '#f1f5f9', fontSize: '0.9rem', resize: 'none', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
          />
        </div>
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 48, height: 48, background: loading || !input.trim() ? 'rgba(99,102,241,0.15)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 12, color: loading || !input.trim() ? '#334155' : '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, boxShadow: loading || !input.trim() ? 'none' : '0 4px 16px rgba(99,102,241,0.4)' }}>
          {loading ? '⏳' : '→'}
        </button>
      </div>

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {QUICK_PROMPTS.slice(0, 4).map(p => (
            <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#334155', padding: '5px 11px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
