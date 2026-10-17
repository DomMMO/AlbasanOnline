# Oyun dengesi ve ölçekleme

Bu belge mobların ne kadar vurup ne kadar dayanacağını, kaç mobda seviye atlanacağını, ganimetin ne sıklıkla düşeceğini ve parti oyununun nasıl ödüllendirileceğini anlatır. Sayılar oyunun bugünkü formüllerinden hesaplandı (Ekim 2026).

---

## 1. Temel yaklaşım: her şey süreden türer

Denge, hasar sayılarıyla değil **sürelerle** kurulur. Önce süreler hedef olarak seçilir, sonra statlar bu hedeflerden geri hesaplanır:

| Hedef | Örnek değer |
|---|---|
| Aynı seviyedeki normal mobu tek oyuncunun öldürme süresi | 10–15 sn |
| Aynı mobun tek oyuncuyu öldürme süresi | 25–30 sn (oyuncu dövüşten canının yarısıyla çıkar) |
| İri (elit) mob | Normalin 3 katı dayanıklı |
| Zindan boss'u (tam parti) | 1–3 dk |
| Bir seviye atlama | Hedeflenen oyun süresi (örnek: 20–40 dk) |
| Nadir bir eşyanın düşmesi | "Ortalama kaç mobda bir" olarak seçilir |

Statlar şöyle türetilir:

```
mob canı      = oyuncunun saniyelik hasarı × hedef öldürme süresi
mob vuruşu    = oyuncunun canı ÷ (mobun oyuncuyu öldürme süresi ÷ mobun vuruş aralığı)
mob XP'si     = seviye için gereken XP ÷ hedeflenen mob sayısı
düşme şansı   = 1 ÷ (kaç mobda bir düşmesini istediğin)
```

Her stat **seviyenin fonksiyonu** (bir eğri) olur. Oyuncunun ve mobun eğrileri aynı oranda büyürse 10. seviyedeki dövüş ile 40. seviyedeki dövüş aynı hissettirir.

---

## 2. Oyunun bugünkü formülleri

| Ne | Formül | Dosya |
|---|---|---|
| Hasar | `saldırı × (0,85…1,15) − savunma × 0,5` (en az 1), %5 ihtimalle ×2 kritik | [progression.ts](../shared/src/data/progression.ts) `rollDamage` |
| Seviye için XP | `150 × seviye^1,6` | progression.ts `xpToNextLevel` |
| Seviye farkına göre XP | Mob yüksekse seviye başına +%10 (en çok +%40), düşükse seviye başına −%20 (5 seviye altı: 0) | progression.ts `xpForKill` |
| Savaşçı statları | can `80 + 20×(sv−1)`, saldırı `8 + 3×(sv−1)`, savunma `2 + (sv−1)` | [classes.ts](../shared/src/data/classes.ts) |
| Zindan mobu | can `12×sv + 1,3×sv²`, saldırı `3×sv`, savunma `sv`, XP `0,6×sv² + 6×sv` | [dungeonMobs.ts](../shared/src/data/dungeonMobs.ts) |
| Zindan boss'u | can mobun 11 katı (son boss 18), saldırı `3,9×sv`, XP mobun 8 katı (son boss 15) | dungeonMobs.ts |
| **Genel ayarlar** (her mobun üstüne) | can ×3, XP ×0,6, altın ×0,2, düşme şansı ×0,35, zindan boss'u vuruşu ×1,5 | [mobs.ts](../shared/src/data/mobs.ts) `MOB_TUNING` |

`MOB_TUNING` bütün oyunun zorluk düğmesidir. Tek bir sayıyı değiştirmek bütün mobları birlikte değiştirir.

---

## 3. Örnek dövüş: 10. seviye Savaşçı ve 10. seviye zindan mobu

- Savaşçı (eşyasız): 260 can, 35 saldırı, 11 savunma, 2 sn'de bir vuruş.
- Mob: 750 can (250 × 3), 30 saldırı, 10 savunma, 2,1 sn'de bir vuruş.

| | Vuruş başı | Kaç vuruşta öldürür | Süre |
|---|---|---|---|
| Savaşçı → mob | 35 − 5 = 30 | 25 | ~50 sn |
| Mob → Savaşçı | 30 − 5,5 = 24,5 | 10,6 | ~22 sn |

Eşyasız Savaşçı aynı seviyedeki tek bir zindan mobunu yeteneksiz yenemiyor. Yetenekler, eşya ve parti bu açığı kapatmak zorunda. Zindanlar grup içeriği olduğu için bu kısmen bilerek böyle, ama açığın büyüklüğü bilinçli seçilmeli.

### Seviyeye göre gidişat (Savaşçı, eşyasız, aynı seviye mob)

| Seviye | Mobu kaç vuruşta öldürür | Mob onu kaç vuruşta öldürür |
|---|---|---|
| 1 | 5 | 40 |
| 5 | 16 | 13 |
| 10 | 25 | 11 |
| 20 | 42 | 9 |
| 30 | 57 | 9 |
| 40 | 73 | 9 |

⚠️ **Dengesizlik:** mobun canı seviyenin karesiyle (sv²) büyüyor, oyuncunun saldırısı doğrusal. Mob oyuncuyu her seviyede ~9 vuruşta öldürürken oyuncunun mobu öldürmesi 5 vuruştan 73 vuruşa çıkıyor. Bunu kapatacak olan eşyaysa, eşyanın tier başına ne kadar güç kattığı bu eğriye göre ayarlanmalı. Yoksa mob canının büyüme hızı düşürülmeli.

---

## 4. Seviye atlama: kaç mob?

Aynı seviyedeki zindan mobuyla (XP ×0,6 uygulanmış hali):

| Seviye | Gereken XP | Mob başı XP | Seviye başına mob |
|---|---|---|---|
| 1 | 150 | 4 | 38 |
| 5 | 1.970 | 27 | 73 |
| 10 | 5.972 | 72 | 83 |
| 15 | 11.425 | 135 | 85 |
| 20 | 18.103 | 216 | 84 |
| 30 | 34.633 | 432 | 81 |
| 40 | 54.877 | 720 | 77 |

Seviye başına mob sayısı neredeyse sabit (~80). Bu iyi bir şey: oyun her seviyede aynı tempoda ilerler. Ama mobu öldürme süresi seviyeyle uzadığı için (bölüm 3) **seviye başına süre** artıyor:

```
seviye süresi ≈ mob sayısı × (öldürme süresi + yürüme / dinlenme süresi)
```

10. seviyede bu yaklaşık 80 × (50 sn + 10 sn) ≈ 80 dk eder (tek başına, yeteneksiz). Yeteneklerle ve partiyle kısalır. Hedeflenen seviye süresi seçilip öldürme süresi ona göre ayarlanmalı.

---

## 5. Ganimet: kaç mobda bir?

Bir eşyanın düşme şansı `p` ise:

- Ortalama **1 ÷ p** mobda bir düşer.
- `n` mob sonunda en az bir kez düşmüş olma ihtimali: **1 − (1 − p)^n**.
- %50 ihtimale ulaşmak için yaklaşık **0,69 ÷ p** mob, %90 için yaklaşık **2,3 ÷ p** mob gerekir.

Oyunda tablolardaki şans ×0,35 ile çarpılıyor:

| Tabloda yazan | Gerçek şans | Ortalama | %50 ihtimal | %90 ihtimal |
|---|---|---|---|---|
| %5 | %1,75 | 57 mob | 39 mob | 130 mob |
| %1,2 | %0,42 | 238 mob | 165 mob | 547 mob |
| %0,6 | %0,21 | 476 mob | 330 mob | 1.095 mob |

Dikkat: şans ortalamadır. %0,6'lık bir eşya için oyuncuların onda biri 1.000 mobdan fazla keser ve hâlâ alamaz. Bunu yumuşatmanın yaygın yolu **şanssızlık koruması**dır: düşmeyen her mobda şans biraz artar, eşya düşünce sıfırlanır.

Ganimet de saatlik olarak düşünülür:

```
saatlik eşya sayısı = saatlik mob sayısı × düşme şansı
saatlik altın      = saatlik mob sayısı × ortalama altın
```

Ekonomi (fiyatlar, yükseltme maliyetleri) bu saatlik değerlere göre kurulur.

---

## 6. Parti: daha zor, ama daha ödüllendirici

### Hedef
Zindana kalabalık girmek hem daha zor hem daha ödüllendirici olsun. Oyuncu tek başına girmek yerine parti kurmaya teşvik edilsin.

### Önerilen ayar: 5 kişide moblar 5 kat güçlü, düşme şansı %125 fazla
5 kişide düşme şansı ×2,25 olur (+%125). Ara sayılar için doğrusal bir kural:

```
N = zindandaki oyuncu sayısı (1–5)
düşme çarpanı = 1 + 0,3125 × (N − 1)     → 1, 1,31, 1,63, 1,94, 2,25
```

### ⚠️ Ödülü belirleyen asıl şey: ganimet kişiye mi, partiye mi düşüyor?

Bugün oyunda **mob başına tek bir ganimet yığını** düşüyor ve partinin ortak malı oluyor (`dropLoot`: sahibi "party:<id>"). Moblar 5 kat dayanıklı olursa 5 kişilik parti onları, tek oyuncunun normal mobu öldürdüğü hızda öldürür. Yani saatte aynı sayıda mob ölür. O zaman:

| Ganimet şekli | 5 kişide kişi başı ganimet (tek oyuncuya göre) |
|---|---|
| **Ortak yığın** (bugünkü), şans ×2,25 | 2,25 ÷ 5 = **×0,45** (tek başına oynamaktan daha az!) |
| **Kişisel ganimet** (her oyuncuya ayrı zar), şans ×2,25 | **×2,25** |

Yani bu ayar ancak **kişisel ganimetle** amacına ulaşır. Ortak yığında parti oyunu cezalandırılmış olur.

### ⚠️ XP de aynı sorunu taşıyor
Bugün XP partiye bölünüyor. Kişi başı pay `(1 + 0,2 × (N − 1)) ÷ N`, 5 kişide mob XP'sinin %36'sı. Mobun XP'si aynı kalıp canı 5 kat olursa kişi başı saatlik XP tek başına oynamanın **%36'sına** düşer. Öneri: mobun XP'si de can çarpanıyla birlikte artsın (×N). O zaman kişi başı XP `1 + 0,2 × (N − 1)` olur, 5 kişide **×1,8**.

### ⚠️ "5 kat güçlü" can mı, hasar mı?
- **Can ×N:** doğru. Daha fazla oyuncu daha fazla hasar verir.
- **Hasar ×N:** önerilmez. Mob tek bir oyuncuya (tanka) vurur. 5 kat hasar tankı tek vuruşta öldürür, partinin kalabalığı tanka yardım etmez. Hasar daha yumuşak artmalı:

```
can çarpanı    = N                         → 1, 2, 3, 4, 5
hasar çarpanı  = 1 + 0,15 × (N − 1)        → 1, 1,15, 1,3, 1,45, 1,6
XP çarpanı     = N                         (bölüşüm kuralıyla kişi başı ×1,8)
düşme çarpanı  = 1 + 0,3125 × (N − 1)      (kişisel ganimetle kişi başı ×2,25)
```

- **Zorluğu mekanikle artır.** Kalabalık partide cast barlı yetenekler daha sık gelsin ve aynı anda birden fazla mob cast etsin. Kesme ve sersemletme sorumluluğu partiye dağılır. "Daha zor" hissi düz hasardan değil koordinasyondan gelir.

### Bugün oyunda olanlar
- Parti XP bonusu: ek üye başına +%20, menzil 40 karo (`PARTY_XP_BONUS`, `PARTY_XP_RANGE`).
- Zindan boss'unun canı ek oyuncu başına +%60 (`PARTY_BOSS_HP_PER_PLAYER`). Kimse çıkınca boss zayıflamıyor.
- Boss 2 kişiden az oyuncuyla dövülürse hasarın %30'unu alıyor ve kendini iyileştiriyor (tek başına kesilemiyor).
- Normal zindan mobları parti sayısıyla **ölçeklenmiyor**. Önerilen çarpanlar onlara da uygulanacak.

### Karar verilmesi gerekenler
1. Ganimet kişisel mi olsun (önerilen), ortak yığın mı kalsın?
2. Çarpanlar sadece zindanlarda mı, açık haritalarda da mı geçerli olsun?
3. Hasar çarpanı +%15/kişi uygun mu?
4. Zindana girerken oyuncu sayısı kilitlensin mi, yoksa biri girip çıktıkça değişsin mi? Bugün boss'larda "artar ama azalmaz" kuralı var.

---

## 7. Ayarlama süreci

1. **Hedefleri seç** (bölüm 1'deki tablo).
2. **Tabloda / simülasyonda hesapla.** Her sınıf ve seviye için öldürme süresi, seviye süresi, saatlik ganimet. Binlerce dövüşü simüle edip ortalamaya bakmak rastlantıyı ortadan kaldırır.
3. **Oyna.** Gerçek dövüşte yetenekler, hareket ve dinlenme hesabı değiştirir.
4. **Ölç.** Sunucuya küçük kayıtlar eklenir: ortalama öldürme süresi, ölüm sayısı, seviye başına geçen süre, saatlik ganimet. Sayılar hedeften saparsa formül değil önce `MOB_TUNING` gibi genel düğmeler çevrilir.
5. **Tekrarla.** Denge bir kerede bitmez. Yeni sınıf, eşya ya da mekanik geldikçe 2–4 tekrarlanır.
