import { useMemo } from 'react';
import { genId } from '@/lib/utils-tr';
import type { DB, IntegrityIssue } from '@/types';

function now(): string {
  return new Date().toISOString();
}

/**
 * Tüm muhasebe bütünlük kurallarını denetler ve sorun listesi döner.
 * Her DB değişikliğinde otomatik yeniden hesaplanır.
 */
export function useIntegrityCheck(db: DB): {
  issues: IntegrityIssue[];
  counts: { critical: number; warning: number; info: number; total: number };
} {
  const issues = useMemo(() => {
    const result: IntegrityIssue[] = [];
    const ts = now();

    // ── 1. Negatif stok ──────────────────────────────────────────────────────
    db.products
      .filter(p => !p.deleted && p.stock < 0)
      .forEach(p => {
        result.push({
          id: genId(),
          severity: 'critical',
          category: 'stok',
          message: `"${p.name}" ürününün stoğu negatif (${p.stock})`,
          detail: 'Stok miktarı sıfırın altına düşemez. Stok düzeltme hareketi gerekiyor.',
          recordId: p.id,
          detectedAt: ts,
        });
      });

    // ── 2. Satış–Kasa eşleşme (nakit/kart/havale satışlar) ──────────────────
    const kasaByRelatedId = new Set(
      db.kasa.filter(k => !k.deleted && k.relatedId).map(k => k.relatedId!)
    );
    db.sales
      .filter(s => !s.deleted && s.status === 'tamamlandi' && s.payment !== 'cari')
      .forEach(s => {
        if (!kasaByRelatedId.has(s.id)) {
          result.push({
            id: genId(),
            severity: 'warning',
            category: 'kasa',
            message: `Satış kaydı (${s.productName}) için kasa girişi bulunamadı`,
            detail: `Satış ID: ${s.id.slice(0, 8)}… · Ödeme: ${s.payment} · Tutar: ₺${s.total.toFixed(2)}`,
            recordId: s.id,
            detectedAt: ts,
          });
        }
      });

    // ── 3. Cari satış–cari bakiye tutarsızlığı ───────────────────────────────
    // Müşteri bazında: toplam cari satış tutarı vs cari.balance (yaklaşık kontrol)
    db.cari
      .filter(c => !c.deleted && c.type === 'musteri')
      .forEach(c => {
        const cariSales = db.sales.filter(
          s => !s.deleted && s.status === 'tamamlandi' && s.cariId === c.id && s.payment === 'cari'
        );
        // Cari tahsilatları (kasa'da cariId eşleşenler, gelir tipi)
        const payments = db.kasa.filter(k => !k.deleted && k.cariId === c.id && k.type === 'gelir');
        const totalSales = cariSales.reduce((s, x) => s + x.total, 0);
        const totalPaid = payments.reduce((s, k) => s + k.amount, 0);
        const expectedBalance = Math.round((totalSales - totalPaid) * 100) / 100;
        const actualBalance = Math.round(c.balance * 100) / 100;
        // %5 veya 50₺'den büyük fark varsa uyar
        const diff = Math.abs(expectedBalance - actualBalance);
        if (diff > 50 && diff > Math.abs(expectedBalance) * 0.05 && (totalSales > 0 || c.balance !== 0)) {
          result.push({
            id: genId(),
            severity: 'warning',
            category: 'cari',
            message: `"${c.name}" cari bakiyesi tutarsız`,
            detail: `Beklenen: ₺${expectedBalance.toFixed(2)}, Kayıtlı: ₺${actualBalance.toFixed(2)}, Fark: ₺${diff.toFixed(2)}`,
            recordId: c.id,
            detectedAt: ts,
          });
        }
      });

    // ── 4. Fatura–Taksit tutarsızlığı ────────────────────────────────────────
    db.invoices
      .filter(inv => !inv.deleted && inv.status !== 'iptal')
      .forEach(inv => {
        const invInstallments = db.installments.filter(i => i.invoiceId === inv.id);
        if (invInstallments.length === 0) return;
        const totalInstallment = Math.round(invInstallments.reduce((s, i) => s + i.amount, 0) * 100) / 100;
        const invTotal = Math.round(inv.total * 100) / 100;
        if (Math.abs(totalInstallment - invTotal) > 0.01) {
          result.push({
            id: genId(),
            severity: 'critical',
            category: 'taksit',
            message: `Fatura #${inv.invoiceNo} taksit toplamı fatura tutarıyla eşleşmiyor`,
            detail: `Fatura: ₺${invTotal.toFixed(2)}, Taksitler toplamı: ₺${totalInstallment.toFixed(2)}, Fark: ₺${Math.abs(totalInstallment - invTotal).toFixed(2)}`,
            recordId: inv.id,
            detectedAt: ts,
          });
        }
      });

    // ── 5. Fatura–Kasa girişi kırık referans ─────────────────────────────────
    const kasaIds = new Set(db.kasa.filter(k => !k.deleted).map(k => k.id));
    db.invoices
      .filter(inv => !inv.deleted && inv.kasaEntryId)
      .forEach(inv => {
        if (!kasaIds.has(inv.kasaEntryId!)) {
          result.push({
            id: genId(),
            severity: 'warning',
            category: 'referans',
            message: `Fatura #${inv.invoiceNo} için kasa girişi bulunamadı`,
            detail: `kasaEntryId: ${inv.kasaEntryId?.slice(0, 8)}… kayıt silinmiş veya eksik olabilir.`,
            recordId: inv.id,
            detectedAt: ts,
          });
        }
      });

    // ── 6. Satış–Ürün kırık referans ─────────────────────────────────────────
    const productIds = new Set(db.products.filter(p => !p.deleted).map(p => p.id));
    db.sales
      .filter(s => !s.deleted && s.status === 'tamamlandi')
      .forEach(s => {
        if (s.productId && !productIds.has(s.productId)) {
          result.push({
            id: genId(),
            severity: 'info',
            category: 'referans',
            message: `Satış kaydında silinmiş/eksik ürün referansı`,
            detail: `Satış: ${s.productName}, ürün ID: ${s.productId?.slice(0, 8)}…`,
            recordId: s.id,
            detectedAt: ts,
          });
        }
      });

    // ── 7. Kasa negatif bakiye ───────────────────────────────────────────────
    const kasalarIds = db.kasalar.map(k => k.id);
    kasalarIds.forEach(kasaId => {
      const balance = db.kasa
        .filter(k => !k.deleted && k.kasa === kasaId)
        .reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
      if (balance < 0) {
        const kasaName = db.kasalar.find(k => k.id === kasaId)?.name || kasaId;
        result.push({
          id: genId(),
          severity: 'critical',
          category: 'kasa',
          message: `${kasaName} kasası negatif bakiyede (₺${balance.toFixed(2)})`,
          detail: 'Kasa bakiyesi sıfırın altına düşemez. Hatalı bir kayıt olabilir.',
          recordId: kasaId,
          detectedAt: ts,
        });
      }
    });

    // ── 8. Stok hareketi tutarsızlığı ────────────────────────────────────────
    db.products
      .filter(p => !p.deleted)
      .forEach(p => {
        const movements = db.stockMovements.filter(m => m.productId === p.id);
        if (movements.length === 0) return;
        // En son hareketteki "after" değeri ile mevcut stok karşılaştır
        const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));
        const lastMovement = sorted[sorted.length - 1];
        if (Math.abs(lastMovement.after - p.stock) > 0) {
          result.push({
            id: genId(),
            severity: 'info',
            category: 'stok',
            message: `"${p.name}" için stok hareketi kaydı ile mevcut stok uyuşmuyor`,
            detail: `Son hareketteki stok: ${lastMovement.after}, Mevcut stok: ${p.stock}`,
            recordId: p.id,
            detectedAt: ts,
          });
        }
      });

    // ── 9. Silme işareti eksik olan siparişler ───────────────────────────────
    db.orders
      .filter(o => o.status === 'iptal' && !o.deleted)
      .forEach(o => {
        result.push({
          id: genId(),
          severity: 'info',
          category: 'referans',
          message: `İptal edilen sipariş soft-delete ile işaretlenmemiş`,
          detail: `Sipariş ID: ${o.id.slice(0, 8)}… · Tedarikçi: ${db.suppliers.find(s => s.id === o.supplierId)?.name || o.supplierId}`,
          recordId: o.id,
          detectedAt: ts,
        });
      });

    return result;
  }, [db]);

  const counts = useMemo(() => ({
    critical: issues.filter(i => i.severity === 'critical').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
    total: issues.length,
  }), [issues]);

  return { issues, counts };
}
