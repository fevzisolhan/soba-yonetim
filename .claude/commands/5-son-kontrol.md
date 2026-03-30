# Adım 5 — Son Kontrol (Opus)

> **Model:** `claude-opus-4-6`  ← Bu adımı MUTLAKA Opus ile çalıştır
> **Amaç:** Adım 4'teki düzeltmelerin doğru yapıldığını ve yeni sorun çıkmadığını doğrula

## Kontrol Kapsamı

**$ARGUMENTS** (belirtilmezse `git diff main...HEAD` kapsamındaki tüm değişiklikler)

---

## Doğrulama Kontrol Listesi

### Düzeltme Kalitesi
- [ ] Adım 3'te raporlanan KRİTİK sorunların tamamı kapatılmış mı?
- [ ] Adım 3'te raporlanan YÜKSEK sorunların tamamı kapatılmış mı?
- [ ] Düzeltmeler yeni sorun yaratmış mı?
- [ ] Düzeltmeler test kapsamını bozmuş mu?

### Muhasebe Bütünlüğü (Son Onay)
- [ ] Kasa bakiyesi hesabı doğru mu?
- [ ] Çift taraflı kayıt kuralı korunuyor mu?
- [ ] Soft-delete uyumu bozulmamış mı?
- [ ] `_version` artışı hâlâ düzgün çalışıyor mu?

### Kod Kalitesi
- [ ] TypeScript hataları var mı? (`tsc --noEmit`)
- [ ] `any` kaçışı eklendi mi?
- [ ] Gereksiz `console.log` kaldı mı?

---

## Sonuç Raporu

```
## Son Kontrol Raporu — <tarih>

### Durum: ONAYLANDI / DÜZELTME GEREKİYOR

### Kapatılan sorunlar
- ✓ ...
- ✓ ...

### Kalan sorunlar (varsa)
- ⚠ ...

### Genel değerlendirme
<Projenin mevcut sağlığı hakkında 2-3 cümle>
```

---

## Onaylandıysa

```bash
git add -A
git commit -m "feat: <özellik adı> — review döngüsü tamamlandı"
git push -u origin claude/add-feature-review-workflow-a81he
```
