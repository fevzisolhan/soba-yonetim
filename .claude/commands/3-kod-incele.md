# Adım 3 — Kapsamlı Kod İncelemesi (Opus)

> **Model:** `claude-opus-4-6`  ← Bu adımı MUTLAKA Opus ile çalıştır
> **Amaç:** Projedeki tüm potansiyel hataları, muhasebe mantık sorunlarını ve performans problemlerini bul

## İnceleme Kapsamı

**$ARGUMENTS** (belirtilmezse tüm `src/` dizinini incele)

---

## İnceleme Kriterleri

### 1. Muhasebe Mantığı ve Altın Kurallar

- [ ] **Çift taraflı kayıt:** Her satış hem `stockMovements`'a hem kasa/cari'ye yazılıyor mu?
- [ ] **Kasa bakiyesi tutarlılığı:** `type: 'gelir'` artış, diğerleri azalış — karışıklık var mı?
- [ ] **Cari bakiye yönü:** Müşteri ve tedarikçi bakiyeleri doğru işaretli mi?
- [ ] **Fatura–Satış bağlantısı:** Fatura kesildiğinde satış kaydıyla eşleşme yapılıyor mu?
- [ ] **Taksit bütünlüğü:** Toplam taksit tutarı fatura tutarına eşit mi? Eksik kontrol var mı?
- [ ] **Soft-delete uyumu:** Finansal kayıtlar gerçekten siliniyor mu, yoksa `deleted: true` mi?
- [ ] **Stok negatif kontrolü:** Stok sıfırın altına düşebiliyor mu?
- [ ] **`_version` artışı:** Her `save()` çağrısında artıyor mu? Yarış koşulu var mı?

### 2. Potansiyel Hatalar ve Güvenlik

- [ ] `NaN` / `undefined` para değerleri hesaplamaya giriyor mu?
- [ ] `JSON.parse` hataları yakalanıyor mu?
- [ ] Firebase API anahtarı client-side'da açık — ek Firestore güvenlik kuralı gerekli mi?
- [ ] `importJSON` sırasında veri doğrulaması yapılıyor mu?
- [ ] `localStorage` dolması durumunda ne oluyor?
- [ ] Tarih karşılaştırmaları tutarlı mı (ISO string karşılaştırması vs Date nesnesi)?
- [ ] TypeScript `any` kaçışları var mı?

### 3. Performans Sorunları

- [ ] `useDB` içinde gereksiz yeniden render tetikleyen `useCallback` bağımlılıkları
- [ ] Büyük listeler üzerinde her render'da çalışan `filter/reduce` zinciri — `useMemo` eksik mi?
- [ ] Firebase senkronizasyonu her tuş basımında tetikleniyor mu? (Debounce yeterli mi?)
- [ ] `localStorage` 5MB limitine yaklaşma riski olan array'ler

### 4. UX ve Veri Tutarlılığı

- [ ] Formlarda negatif miktar/fiyat girilebiliyor mu?
- [ ] Aynı anda iki sekmede açık uygulama — veri üzerine yazma riski
- [ ] Hata mesajları kullanıcıya gösteriliyor mu, yoksa sessizce yutulüyor mu?

---

## Çıktı Formatı

Her sorun için şu formatı kullan:

```
### [SEVİYE] Sorun Başlığı
**Dosya:** src/...tsx:satır
**Kategori:** muhasebe | hata | performans | güvenlik | ux
**Açıklama:** Sorunun ne olduğu
**Etki:** Bu sorun ne zaman/nasıl ortaya çıkar
**Öneri:** Nasıl düzeltilmeli
```

Seviyeler: `KRITIK` | `YÜKSEK` | `ORTA` | `DÜŞÜK`

---

## Bitince

Bulduğun sorunları önem sırasına göre listele.
Ardından **Adım 4**'e geç:
```
/project:4-sorun-duzelt
```
