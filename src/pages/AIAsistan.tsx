import { useState, useRef, useEffect, useCallback } from 'react';
import { formatMoney } from '@/lib/utils-tr';
import type { DB } from '@/types';

interface Props { db: DB; embedded?: boolean; }
interface Message { role: 'user' | 'assistant'; content: string; source?: 'claude' | 'gemini' | 'offline'; }

// ── API Anahtarları (Settings'ten veya localStorage'dan okunur) ──
const getKeys = () => ({
  claude: (localStorage.getItem('ai_claude_key') || '').trim(),
  gemini: (localStorage.getItem('ai_gemini_key') || '').trim(),
});

// ── Offline kural tabanlı sistem ──
function offlineReply(db: DB, query: string): string {
  const q = query.toLowerCase();
  const t = new Date();
  const todaySales = db.sales.filter(s => {
    if (s.deleted) return false;
    const d = new Date(s.createdAt);
    return s.status === 'tamamlandi' && d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
  });
  const ciro = todaySales.reduce((s, x) => s + x.total, 0);
  const kar = todaySales.reduce((s, x) => s + x.profit, 0);

  if (q.includes('stok') || q.includes('ürün') || q.includes('sipariş')) {
    const activeProducts = db.products.filter(p => !p.deleted);
    const out = activeProducts.filter(p => p.stock === 0);
    const low = activeProducts.filter(p => p.stock > 0 && p.stock <= p.minStock);
    return `📦 **Stok Özeti**\n- Stok biten: ${out.length} ürün${out.length ? ': ' + out.slice(0,3).map(p=>p.name).join(', ') : ''}\n- Az stoklu: ${low.length} ürün\n- Toplam ürün: ${activeProducts.length}\n\n⚠️ *Çevrimdışı mod — derin analiz için internet gerekli*`;
  }
  if (q.includes('kasa') || q.includes('nakit') || q.includes('para')) {
    const activeKasa = db.kasa.filter(k => !k.deleted);
    const kasa = activeKasa.reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
    const nakit = activeKasa.filter(k=>k.kasa==='nakit').reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
    return `💰 **Kasa Durumu**\n- Toplam: ${formatMoney(kasa)}\n- Nakit: ${formatMoney(nakit)}\n- Banka: ${formatMoney(kasa - nakit)}\n\n⚠️ *Çevrimdışı mod*`;
  }
  if (q.includes('alacak') || q.includes('borç') || q.includes('cari') || q.includes('müşteri')) {
    const activeCari = db.cari.filter(c => !c.deleted);
    const alacak = activeCari.filter(c=>c.type==='musteri'&&c.balance>0).reduce((s,c)=>s+c.balance,0);
    const topBorclu = [...activeCari].filter(c=>c.type==='musteri'&&c.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,3);
    return `👤 **Cari Özet**\n- Toplam alacak: ${formatMoney(alacak)}\n- En yüksek borçlular:\n${topBorclu.map(c=>`  • ${c.name}: ${formatMoney(c.balance)}`).join('\n')}\n\n⚠️ *Çevrimdışı mod*`;
  }
  if (q.includes('satış') || q.includes('analiz') || q.includes('performans') || q.includes('bu ay')) {
    return `📊 **Bu Ay Satış**\n- ${todaySales.length} işlem\n- Ciro: ${formatMoney(ciro)}\n- Kâr: ${formatMoney(kar)}\n\n⚠️ *Çevrimdışı mod — karşılaştırmalı analiz için internet gerekli*`;
  }
  return `🔌 **Çevrimdışı Mod**\n\nİnternet bağlantısı olmadığından AI analizi yapılamıyor.\n\nSorabileceğiniz konular:\n- Stok durumu\n- Kasa özeti\n- Müşteri alacakları\n- Bu ay satışlar`;
}

// ── Claude API (Anthropic direkt) ──
async function askClaude(messages: Message[], context: string, key: string, onChunk: (t: string) => void): Promise<void> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Sen Soba işletmesi için AI analistsin. Kısa, net, Türkçe yanıt ver.\n\n${context}`,
      messages: messages.filter(m=>m.content).map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`Claude API: ${res.status}`);
  const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.type === 'content_block_delta') onChunk(d.delta?.text || '');
      } catch { /* ignore */ }
    }
  }
}

// ── Gemini API (yedek) ──
async function askGemini(messages: Message[], context: string, key: string, onChunk: (t: string) => void): Promise<void> {
  const contents = [
    { role: 'user', parts: [{ text: `İşletme verilerim:\n${context}` }] },
    { role: 'model', parts: [{ text: 'Anladım, verilerinizi inceledim. Nasıl yardımcı olabilirim?' }] },
    ...messages.filter(m=>m.content).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: 'Türkçe, kısa ve net yanıt ver. Soba işletmesi analistisin.' }] } }),
  });
  if (!res.ok) throw new Error(`Gemini API: ${res.status}`);
  const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const d = JSON.parse(line.slice(6));
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch { /* ignore */ }
    }
  }
}

function buildContext(db: DB): string {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const monthSales = db.sales.filter(s => !s.deleted && s.status === 'tamamlandi' && new Date(s.createdAt) >= monthStart);
  const lastMonthSales = db.sales.filter(s => !s.deleted && s.status === 'tamamlandi' && new Date(s.createdAt) >= lastMonthStart && new Date(s.createdAt) <= lastMonthEnd);
  const totalKasa = db.kasa.filter(k => !k.deleted).reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
  const nakit = db.kasa.filter(k=>!k.deleted&&k.kasa==='nakit').reduce((s,k)=>s+(k.type==='gelir'?k.amount:-k.amount),0);
  const outStock = db.products.filter(p=>!p.deleted&&p.stock===0);
  const lowStock = db.products.filter(p=>!p.deleted&&p.stock>0&&p.stock<=p.minStock);
  const stokDeger = db.products.filter(p=>!p.deleted).reduce((s,p)=>s+p.cost*p.stock,0);
  const topProducts = [...db.products].filter(p=>!p.deleted).sort((a,b)=>{
    const ar=db.sales.filter(s=>!s.deleted&&s.productId===a.id&&s.status==='tamamlandi').reduce((s,x)=>s+x.total,0);
    const br=db.sales.filter(s=>!s.deleted&&s.productId===b.id&&s.status==='tamamlandi').reduce((s,x)=>s+x.total,0);
    return br-ar;
  }).slice(0,5);
  const alacak=db.cari.filter(c=>!c.deleted&&c.type==='musteri'&&c.balance>0).reduce((s,c)=>s+c.balance,0);
  const borc=db.cari.filter(c=>!c.deleted&&c.type==='tedarikci'&&c.balance<0).reduce((s,c)=>s+Math.abs(c.balance),0);
  const catSales: Record<string,number>={};
  db.sales.filter(s=>!s.deleted&&s.status==='tamamlandi').forEach(s=>{const c=s.productCategory||'Diğer';catSales[c]=(catSales[c]||0)+s.total;});
  return `## İşletme Özeti (${today.toLocaleDateString('tr-TR')})
### Satış
- Bu ay: ${monthSales.length} satış, ${formatMoney(monthSales.reduce((s,x)=>s+x.total,0))} ciro, ${formatMoney(monthSales.reduce((s,x)=>s+x.profit,0))} kâr
- Geçen ay: ${lastMonthSales.length} satış, ${formatMoney(lastMonthSales.reduce((s,x)=>s+x.total,0))} ciro
- Tüm zamanlar: ${db.sales.filter(s=>!s.deleted&&s.status==='tamamlandi').length} satış
### Kasa: ${formatMoney(totalKasa)} (Nakit: ${formatMoney(nakit)}, Banka: ${formatMoney(totalKasa-nakit)})
### Stok
- Toplam: ${db.products.filter(p=>!p.deleted).length} ürün, Stok değeri: ${formatMoney(stokDeger)}
- Biten: ${outStock.length}, Az stoklu: ${lowStock.length}
### Top 5 Ürün: ${topProducts.map(p=>{const r=db.sales.filter(s=>!s.deleted&&s.productId===p.id&&s.status==='tamamlandi').reduce((s,x)=>s+x.total,0);return `${p.name}(${formatMoney(r)})`;}).join(', ')}
### Cari: Alacak ${formatMoney(alacak)}, Borç ${formatMoney(borc)}
### Tedarikçi: ${db.suppliers.length}, Bekleyen sipariş: ${db.orders.filter(o=>o.status==='bekliyor').length}
### Kategoriler: ${Object.entries(catSales).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`${c}:${formatMoney(v)}`).join(', ')||'Veri yok'}`;
}

const QUICK_PROMPTS = [
  { label: '📊 Bu Ay Analiz', prompt: 'Bu ayın satış performansını analiz et. Geçen aya göre nasıl?' },
  { label: '📦 Stok Durumu', prompt: 'Stoklarımın durumunu değerlendir. Hangi ürünleri sipariş etmeliyim?' },
  { label: '💰 Kâr Analizi', prompt: 'En kârlı ürünlerim hangileri? Kâr marjı analizi yap.' },
  { label: '🔮 Satış Tahmini', prompt: 'Verilerime göre önümüzdeki ay için satış tahmini yap.' },
  { label: '👤 Müşteri Analizi', prompt: 'Müşteri ve alacak durumumu değerlendir.' },
  { label: '🏭 Tedarikçi Öneri', prompt: 'Tedarikçilerimle ilgili ne gibi iyileştirmeler yapabilirim?' },
  { label: '💡 İpuçları', prompt: 'Bu işletme için en kritik 5 önerin nedir?' },
  { label: '📈 Büyüme', prompt: 'Satışları artırmak için ne yapabilirim?' },
];

function MarkdownText({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 style="color:#ff7043;font-size:0.9rem;margin:10px 0 4px;font-weight:700">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#f1f5f9;font-size:1rem;margin:12px 0 6px;font-weight:800">$1</h3>')
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, '<ul style="list-style:none;padding:0;margin:6px 0">$&</ul>')
    .replace(/\n\n/g, '<br/>').replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── API Ayarları Paneli ──
function ApiSettings({ onClose }: { onClose: () => void }) {
  const [ck, setCk] = useState(localStorage.getItem('ai_claude_key') || '');
  const [gk, setGk] = useState(localStorage.getItem('ai_gemini_key') || '');
  const save = () => {
    localStorage.setItem('ai_claude_key', ck.trim());
    localStorage.setItem('ai_gemini_key', gk.trim());
    onClose();
  };
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'monospace' };
  return (
    <div style={{ padding: '16px 0' }}>
      <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 14 }}>API anahtarları yalnızca bu cihazda saklanır (localStorage).</p>
      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.82rem', marginBottom: 4 }}>🤖 Claude API Key (Anthropic — birincil)</label>
      <input value={ck} onChange={e => setCk(e.target.value)} placeholder="sk-ant-..." style={{ ...inp, marginBottom: 14 }} type="password" />
      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.82rem', marginBottom: 4 }}>✨ Gemini API Key (Google — yedek)</label>
      <input value={gk} onChange={e => setGk(e.target.value)} placeholder="AIza..." style={{ ...inp, marginBottom: 18 }} type="password" />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={save} style={{ flex: 1, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 0', fontWeight: 700, cursor: 'pointer' }}>💾 Kaydet</button>
        <button onClick={onClose} style={{ background: '#273548', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '10px 16px', cursor: 'pointer' }}>İptal</button>
      </div>
    </div>
  );
}

export default function AIAsistan({ db, embedded = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'claude' | 'gemini' | 'offline'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const context = buildContext(db);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, loading]);

  const { claude: claudeKey, gemini: geminiKey } = getKeys();
  const hasKeys = !!(claudeKey || geminiKey);

  const send = useCallback(async (text?: string) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput('');
    setLoading(true);
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    // Çevrimdışı kontrolü
    if (!navigator.onLine) {
      const reply = offlineReply(db, userMsg);
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: reply, source: 'offline' }; return u; });
      setApiStatus('offline'); setLoading(false); return;
    }

    const appendChunk = (chunk: string) => {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + chunk }; return u; });
    };

    // Claude önce dene
    if (claudeKey) {
      try {
        setApiStatus('claude');
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], source: 'claude' }; return u; });
        await askClaude(newMessages, context, claudeKey, appendChunk);
        setLoading(false); return;
      } catch (e) {
        console.warn('Claude başarısız, Gemini deneniyor:', e);
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: '' }; return u; });
      }
    }

    // Gemini yedek
    if (geminiKey) {
      try {
        setApiStatus('gemini');
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], source: 'gemini' }; return u; });
        await askGemini(newMessages, context, geminiKey, appendChunk);
        setLoading(false); return;
      } catch (e) {
        console.warn('Gemini de başarısız:', e);
      }
    }

    // Hiçbiri yoksa offline fallback
    const reply = !hasKeys
      ? '🔑 API anahtarı girilmemiş. Sağ üstteki ⚙️ ikonuna tıklayarak Claude veya Gemini anahtarınızı ekleyin.'
      : offlineReply(db, userMsg);
    setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: reply, source: 'offline' }; return u; });
    setApiStatus('offline');
    setLoading(false);
  }, [input, loading, messages, context, db, hasKeys]);

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const sourceLabel: Record<string, { label: string; color: string }> = {
    claude: { label: '🤖 Claude', color: '#6366f1' },
    gemini: { label: '✨ Gemini', color: '#8b5cf6' },
    offline: { label: '🔌 Çevrimdışı', color: '#64748b' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: embedded ? '100%' : 'calc(100vh - 140px)' }}>
      {/* Header — sadece standalone modda */}
      {!embedded && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0, boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>🤖</div>
        <div>
          <h2 style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '1.1rem' }}>Soba AI Asistan</h2>
          <p style={{ color: '#475569', fontSize: '0.82rem' }}>
            {hasKeys ? (claudeKey ? '✅ Claude (birincil)' : '') + (geminiKey ? ' + ✅ Gemini (yedek)' : '') : '⚠️ API anahtarı girilmemiş — ⚙️ ayarlara girin'}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#475569', padding: '7px 14px', cursor: 'pointer', fontSize: '0.82rem' }}>🗑️</button>
          )}
          <button onClick={() => setShowSettings(true)} title="API Ayarları" style={{ background: showSettings ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#818cf8', padding: '7px 14px', cursor: 'pointer', fontSize: '0.9rem' }}>⚙️</button>
          {!navigator.onLine && <span style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 8, padding: '7px 12px', color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}>🔌 Çevrimdışı</span>}
        </div>
      </div>
      )}

      {/* API Ayarları modalı */}
      {showSettings && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>⚙️ API Ayarları</h3>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
          </div>
          <ApiSettings onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* Quick prompts */}
      {messages.length === 0 && !showSettings && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#334155', fontSize: '0.8rem', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hızlı Sorular</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '2px 4px' }}>
        {messages.length === 0 && !showSettings && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: '4rem', marginBottom: 16, opacity: 0.4 }}>🤖</div>
            <h3 style={{ color: '#334155', fontWeight: 700, marginBottom: 8 }}>İşletmenizle ilgili her şeyi sorabilirsiniz</h3>
            <p style={{ color: '#1e3a5f', fontSize: '0.85rem', maxWidth: 380, lineHeight: 1.6 }}>{hasKeys ? 'Claude ve Gemini hazır. Mevcut verilerinizi baz alarak yanıt verir.' : '⚠️ Önce ⚙️ Ayarlar\'dan API anahtarını girin. İnternetsiz de temel sorulara yanıt verir.'}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: msg.role === 'user' ? 'linear-gradient(135deg,#ff5722,#ff7043)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div style={{ maxWidth: '78%' }}>
              <div style={{ background: msg.role === 'user' ? 'linear-gradient(135deg,rgba(255,87,34,0.12),rgba(255,87,34,0.06))' : 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(99,102,241,0.04))', border: `1px solid ${msg.role === 'user' ? 'rgba(255,87,34,0.2)' : 'rgba(99,102,241,0.15)'}`, borderRadius: 14, padding: '13px 16px' }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.65 }}>
                  {msg.role === 'assistant' ? <MarkdownText text={msg.content || '...'} /> : msg.content}
                </div>
              </div>
              {msg.role === 'assistant' && msg.source && msg.content && (
                <div style={{ marginTop: 4, textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: sourceLabel[msg.source]?.color || '#64748b', fontWeight: 600 }}>{sourceLabel[msg.source]?.label}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.content === '' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
            <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: '13px 18px' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0,1,2].map(i=><div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', animation: `pulse 1.2s ease ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Sorunuzu yazın... (Enter: gönder)" rows={2} disabled={loading}
            style={{ width: '100%', padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, color: '#f1f5f9', fontSize: '0.9rem', resize: 'none', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit' }} />
        </div>
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ width: 48, height: 48, background: loading || !input.trim() ? 'rgba(99,102,241,0.15)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: loading || !input.trim() ? '#334155' : '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {loading ? '⏳' : '→'}
        </button>
      </div>

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {QUICK_PROMPTS.slice(0,4).map(p=>(
            <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#334155', padding: '5px 11px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>{p.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
