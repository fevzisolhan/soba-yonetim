# Adım 2 — Birim Testleri Oluştur (Sonnet)

> **Model:** `claude-sonnet-4-6`
> **Amaç:** Son eklenen özellik veya belirtilen modül için birim testleri yaz

## Test Kapsamı

Şu dosya/modül için testler oluştur: **$ARGUMENTS**
(Belirtilmezse son değiştirilen dosyaları `git diff --name-only HEAD` ile belirle)

### Test öncelikleri

1. **Muhasebe hesaplamaları**
   - `getKasaBakiye()` — gelir/gider doğruluğu
   - `getTotalKasa()` — toplam bakiye tutarlılığı
   - `calcProfit()` — kar marjı hesabı
   - Taksit toplamı = fatura tutarı kontrolü

2. **Veri dönüşümleri**
   - `formatMoney()`, `formatMoneyShort()`, `formatDate()`
   - `genId()` — UUID formatı ve tekliği
   - `loadFromStorage()` / `makeDefaultDB()` birleştirme mantığı

3. **İş kuralları**
   - Stok negatife düşemez
   - Silinen kayıtlar sorgularda çıkmamalı
   - `_version` her kayıtta artmalı

### Test dosyası konumu

```
src/__tests__/<modül-adı>.test.ts
```

### Test çerçevesi

Vitest kullan. Kurulu değilse önce kur:
```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

`package.json`'a ekle:
```json
"test": "vitest",
"test:ui": "vitest --ui"
```

### Bitince

Test dosyasının tam yolunu ve kaç test yazdığını belirt. Ardından **Adım 3**'e geç:
```
/project:3-kod-incele
```
