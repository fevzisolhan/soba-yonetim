# Adım 1 — Özellik Ekle (Sonnet)

> **Model:** `claude-sonnet-4-6`
> **Amaç:** İstenen özelliği projeye ekle

## Talimatlar

Aşağıdaki özelliği uygula: **$ARGUMENTS**

### Uyulması gereken kurallar

1. Sadece `useDB` hook'u üzerinden veri oku/yaz — doğrudan `localStorage` kullanma
2. Para formatı için `formatMoney()` / `formatMoneyShort()` kullan
3. ID üretimi için `genId()` kullan
4. Tarih için ISO string; gösterimde `formatDate()` / `formatDateShort()` kullan
5. Finansal kayıtları silme — `deleted: true` ile işaretle (soft-delete)
6. Yeni tip tanımlarını `src/types/index.ts`'e ekle
7. `any` kullanma

### Muhasebe bütünlüğü

- Satış: hem stok düş hem kasa/cari etkile
- Kasa hareketi: doğru `type` ('gelir' | diğer) ata
- Stok değişikliği: `stockMovements`'a kayıt düş

### Bitince

Yaptığın değişikliklerin kısa özetini yaz. Ardından **Adım 2**'ye geç:
```
/project:2-test-olustur
```
