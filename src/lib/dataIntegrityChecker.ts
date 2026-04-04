/**
 * Veri Bütünlüğü Denetçisi
 * Tüm muhasebe kurallarını ve veri tutarlılığını otomatik kontrol eder.
 */
import type { DB } from '@/types';
import { formatMoney } from './utils-tr';

export type IssueSeverity = 'critical' | 'warning' | 'info';
export type IssueCategory = 'stok' | 'kasa' | 'cari' | 'satis' | 'siparis' | 'fatura' | 'veri' | 'referans';

export interface IntegrityIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  detail: string;
  suggestion?: string;
  relatedIds?: string[];
}

// ── Ana denetim fonksiyonu ──
export function runIntegrityCheck(db: DB): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  let issueIdx = 0;
  const addIssue = (severity: IssueSeverity, category: IssueCategory, title: string, detail: string, suggestion?: string, relatedIds?: string[]) => {
    issues.push({ id: `issue_${++issueIdx}`, severity, category, title, detail, suggestion, relatedIds });
  };

  // ═══════════════════════════════════════
  // 1. STOK TUTARLILIĞI
  // ═══════════════════════════════════════
  const activeProducts = db.products.filter(p => !p.deleted);

  // 1a. Negatif stok kontrolü
  activeProducts.forEach(p => {
    if (p.stock < 0) {
      addIssue('critical', 'stok', 'Negatif stok', `"${p.name}" stoğu ${p.stock} — negatif olamaz.`, 'Stok hareketlerini kontrol edin.', [p.id]);
    }
  });

  // 1b. Maliyet sıfır veya negatif
  activeProducts.forEach(p => {
    if (p.cost < 0) {
      addIssue('warning', 'stok', 'Negatif maliyet', `"${p.name}" maliyeti ${formatMoney(p.cost)} — negatif.`, 'Ürün maliyetini düzeltin.', [p.id]);
    }
    if (p.cost === 0 && p.stock > 0) {
      addIssue('info', 'stok', 'Sıfır maliyet', `"${p.name}" maliyeti ₺0 ama ${p.stock} adet stokta.`, 'Maliyet girilmemiş olabilir.', [p.id]);
    }
  });

  // 1c. Fiyat maliyetin altında
  activeProducts.forEach(p => {
    if (p.price > 0 && p.cost > 0 && p.price < p.cost) {
      addIssue('warning', 'stok', 'Zararına fiyat', `"${p.name}" fiyatı (${formatMoney(p.price)}) maliyetinin (${formatMoney(p.cost)}) altında.`, 'Fiyatı güncelleyin.', [p.id]);
    }
  });

  // ═══════════════════════════════════════
  // 2. KASA TUTARLILIĞI
  // ═══════════════════════════════════════
  const activeKasa = db.kasa.filter(k => !k.deleted);

  // 2a. Negatif kasa bakiyesi
  const kasaMap = new Map<string, number>();
  activeKasa.forEach(k => {
    const cur = kasaMap.get(k.kasa) || 0;
    kasaMap.set(k.kasa, cur + (k.type === 'gelir' ? k.amount : -k.amount));
  });
  kasaMap.forEach((balance, kasaId) => {
    if (balance < -0.01) {
      addIssue('critical', 'kasa', 'Negatif kasa bakiyesi', `"${kasaId}" kasası bakiyesi ${formatMoney(balance)} — negatif.`, 'Kasa hareketlerini kontrol edin.');
    }
  });

  // 2b. Tutarı sıfır veya negatif olan kasa kaydı
  activeKasa.forEach(k => {
    if (k.amount <= 0) {
      addIssue('warning', 'kasa', 'Geçersiz kasa tutarı', `Kasa kaydı "${k.description || k.id}" tutarı ${formatMoney(k.amount)}.`, 'Tutar pozitif olmalı.', [k.id]);
    }
  });

  // ═══════════════════════════════════════
  // 3. CARİ TUTARLILIĞI
  // ═══════════════════════════════════════
  const activeCari = db.cari.filter(c => !c.deleted);

  // 3a. Müşteri negatif bakiye (normalden fazla ödeme?)
  activeCari.filter(c => c.type === 'musteri').forEach(c => {
    if ((c.balance || 0) < -0.01) {
      addIssue('info', 'cari', 'Müşteri negatif bakiye', `"${c.name}" bakiyesi ${formatMoney(c.balance || 0)} — fazla ödeme yapılmış olabilir.`, 'Tahsilat ve satış kayıtlarını kontrol edin.', [c.id]);
    }
  });

  // ═══════════════════════════════════════
  // 4. SATIŞ TUTARLILIĞI
  // ═══════════════════════════════════════
  const activeSales = db.sales.filter(s => !s.deleted);

  // 4a. Satış - kasa eşleşmesi (tamamlanan satışlarda kasa kaydı olmalı)
  activeSales.filter(s => s.status === 'tamamlandi').forEach(s => {
    const relatedKasa = activeKasa.filter(k => k.relatedId === s.id && k.type === 'gelir');
    const tahsilEdilen = relatedKasa.reduce((sum, k) => sum + k.amount, 0);
    const beklenen = s.payment === 'cari' ? 0 : s.total;

    // Cari ödeme değilse ve tahsilat yoksa uyar
    if (s.payment !== 'cari' && tahsilEdilen < beklenen - 0.01 && s.total > 0) {
      addIssue('warning', 'satis', 'Eksik kasa kaydı', `Satış "${s.productName}" (${formatMoney(s.total)}) için kasa kaydı eksik veya tutarsız. Kasa: ${formatMoney(tahsilEdilen)}.`, 'Kasa hareketlerini kontrol edin.', [s.id]);
    }
  });

  // 4b. Müşterisiz satış
  activeSales.forEach(s => {
    if (!s.customerId && !s.cariId) {
      addIssue('info', 'satis', 'Müşterisiz satış', `Satış "${s.productName}" (${formatMoney(s.total)}) müşteri bilgisi yok.`, 'Eski kayıt olabilir.', [s.id]);
    }
  });

  // 4c. Satış - müşteri referans bozuk
  activeSales.forEach(s => {
    const cariId = s.cariId || s.customerId;
    if (cariId && !db.cari.find(c => c.id === cariId)) {
      addIssue('warning', 'referans', 'Bozuk müşteri referansı', `Satış "${s.productName}" müşteri ID "${cariId}" veritabanında bulunamadı.`, 'Müşteri silinmiş olabilir.', [s.id]);
    }
  });

  // 4d. Negatif tutar/kâr kontrolü
  activeSales.filter(s => s.status === 'tamamlandi').forEach(s => {
    if (s.total < 0) {
      addIssue('critical', 'satis', 'Negatif satış tutarı', `"${s.productName}" tutarı ${formatMoney(s.total)}.`, 'Satış verisini kontrol edin.', [s.id]);
    }
  });

  // ═══════════════════════════════════════
  // 5. SİPARİŞ TUTARLILIĞI
  // ═══════════════════════════════════════
  const activeOrders = db.orders.filter(o => !o.deleted);

  // 5a. Tedarikçi referans bozuk
  activeOrders.forEach(o => {
    if (o.supplierId && !db.suppliers.find(s => s.id === o.supplierId)) {
      addIssue('warning', 'referans', 'Bozuk tedarikçi referansı', `Sipariş "${o.items.map(i => i.productName).join(', ')}" tedarikçi bulunamadı.`, 'Tedarikçi silinmiş olabilir.', [o.id]);
    }
  });

  // 5b. Tamamlanmış sipariş ama ödenmemiş
  activeOrders.filter(o => o.status === 'tamamlandi').forEach(o => {
    if (o.remainingAmount > 0.01) {
      addIssue('info', 'siparis', 'Ödenmemiş sipariş', `Sipariş (${formatMoney(o.amount)}) tamamlandı ama ${formatMoney(o.remainingAmount)} ödenmemiş.`, 'Ödeme yapılmalı.', [o.id]);
    }
  });

  // ═══════════════════════════════════════
  // 6. FATURA TUTARLILIĞI
  // ═══════════════════════════════════════
  const activeInvoices = (db.invoices || []).filter(f => !f.deleted);

  // 6a. Taksit toplamı fatura tutarıyla eşleşmiyor
  activeInvoices.forEach(inv => {
    const invInstallments = (db.installments || []).filter((t: { invoiceId?: string }) => t.invoiceId === inv.id);
    if (invInstallments.length > 0) {
      const taksitToplam = invInstallments.reduce((s: number, t: { amount: number }) => s + t.amount, 0);
      if (Math.abs(taksitToplam - inv.total) > 0.01) {
        addIssue('critical', 'fatura', 'Taksit-fatura uyumsuzluğu', `Fatura #${inv.invoiceNo || inv.id} toplam: ${formatMoney(inv.total)}, taksitler: ${formatMoney(taksitToplam)}.`, 'Taksit tutarlarını düzeltin.', [inv.id]);
      }
    }
  });

  // ═══════════════════════════════════════
  // 7. VERİ KALİTESİ
  // ═══════════════════════════════════════

  // 7a. Tarih formatı kontrolü (ISO string olmalı)
  activeSales.forEach(s => {
    if (s.createdAt && !/^\d{4}-\d{2}-\d{2}T/.test(s.createdAt)) {
      addIssue('info', 'veri', 'Geçersiz tarih formatı', `Satış "${s.productName}" tarihi "${s.createdAt}" — ISO formatında değil.`, 'Tarih düzeltilmeli.', [s.id]);
    }
  });

  // 7b. Soft-delete tutarlılığı (deleted kayıtlarda hâlâ işlem olmamalı)
  const deletedSaleIds = new Set(db.sales.filter(s => s.deleted).map(s => s.id));
  activeKasa.forEach(k => {
    if (k.relatedId && deletedSaleIds.has(k.relatedId)) {
      addIssue('warning', 'veri', 'Silinmiş satışa bağlı kasa kaydı', `Kasa "${k.description || k.id}" silinmiş bir satışa bağlı.`, 'Kasa kaydı da soft-delete edilmeli.', [k.id]);
    }
  });

  // 7c. Yetim stok hareketi (ürün bulunamıyor)
  (db.stockMovements || []).forEach(sm => {
    if (sm.productId && !db.products.find(p => p.id === sm.productId)) {
      addIssue('info', 'referans', 'Yetim stok hareketi', `Stok hareketi "${sm.productName || sm.productId}" ürünü bulunamadı.`);
    }
  });

  return issues;
}

// ── Özet istatistikleri ──
export function getIntegritySummary(issues: IntegrityIssue[]) {
  return {
    total: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
    byCategory: Object.fromEntries(
      (['stok', 'kasa', 'cari', 'satis', 'siparis', 'fatura', 'veri', 'referans'] as IssueCategory[])
        .map(cat => [cat, issues.filter(i => i.category === cat).length])
        .filter(([, count]) => (count as number) > 0)
    ),
    isHealthy: issues.filter(i => i.severity === 'critical').length === 0,
  };
}

// ── Hızlı sağlık skoru (0-100) ──
export function getHealthScore(db: DB): number {
  const issues = runIntegrityCheck(db);
  const critPenalty = issues.filter(i => i.severity === 'critical').length * 15;
  const warnPenalty = issues.filter(i => i.severity === 'warning').length * 5;
  const infoPenalty = issues.filter(i => i.severity === 'info').length * 1;
  return Math.max(0, 100 - critPenalty - warnPenalty - infoPenalty);
}
