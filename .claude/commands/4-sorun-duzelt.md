# Adım 4 — Sorunları Düzelt (Sonnet)

> **Model:** `claude-sonnet-4-6`
> **Amaç:** Opus'un Adım 3'te raporladığı sorunları düzelt

## Talimatlar

Opus'un tespit ettiği şu sorunu/sorunları düzelt: **$ARGUMENTS**

(Belirtilmezse: önceki incelemeden KRİTİK ve YÜKSEK seviyeli tüm sorunları düzelt)

### Düzeltme öncelik sırası

1. `KRITIK` — Veri kaybı veya yanlış muhasebe hesabı yaratan sorunlar
2. `YÜKSEK` — Güvenlik açıkları ve ciddi hatalar
3. `ORTA` — Performans sorunları ve UX problemleri
4. `DÜŞÜK` — Kod kalitesi iyileştirmeleri

### Her düzeltme için

- Minimum değişiklik yap — sadece sorunu çöz, etrafındaki kodu refactor etme
- Değişikliği kısa bir yorum ile belge (`// Fix: <açıklama>`)
- Muhasebe mantığını değiştiriyorsan `CLAUDE.md`'deki altın kuralları tekrar gözden geçir
- Test varsa (`src/__tests__/`) testlerin hâlâ geçtiğini doğrula

### Bitince

Her düzeltilen sorun için tek satır özet yaz:
```
✓ [SEVİYE] Dosya:satır — ne düzeltildi
```

Ardından **Adım 5**'e geç:
```
/project:5-son-kontrol
```
