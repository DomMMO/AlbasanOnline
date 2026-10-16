# Pixel Crawler geçişi: yapılacaklar

Oyun, Anokolisa "Pixel Crawler" paketine taşınıyor. Her adım bitince ekran görüntüsü ve çarpışma kontrolüyle onaya gelir.

## 0. Hazırlık: ✅ bitti
- Paket `assetpack/ANOKOLISA` altında, TileSet'ler kurulu, tema aracı `tools/dungeon_theme.gd` hazır.
- ❓ Açık soru: `assetpack/` git'e girecek mi? Lisans paketin yeniden dağıtılmasını yasaklıyor.

## 1. Zindanlar
Hepsine Forge'daki stil uygulanacak:
- 20 eşit oda, eşit koridorlar;
- bosslar 5., 10., 15. ve 20. odalarda;
- farklı oda şekilleri;
- bir odada aynı prop en fazla 2 kez;
- her odada küp (urn);
- zindan başına 1-2 şaka.

- boss odaları ve giriş hariç her odada 2 mob paketi, her pakette 5-10 mob (zindan başına ~230-250 mob).

goblin_cave ve jack_lair da 20 odalı yapıya geçti.

| # | Tema | Haritalar | Durum |
|---|---|---|---|
| 1a | Forge | magma_forges, ash_temple, dragon_lair | ✅ bitti (moblar 2 paket/oda) |
| 1b | Cave | goblin_cave, abandoned_mine, red_caves, frost_cavern | ✅ bitti (onay bekliyor) |
| 1c | Cemetery + Castle | bone_crypt, khan_barrow, jack_lair | ✅ bitti (onay bekliyor) |
| 1d | Desert | buried_caravanserai | ✅ bitti (onay bekliyor) |
| 1e | Garden + Sewer | sunken_temple | ✅ bitti (Garden duvarlarıyla yenilendi, onay bekliyor) |
| 1f | Hideout | orc_fortress | ✅ bitti (onay bekliyor) |
| 1g | Castle | keep_hall ✅ (onay bekliyor) · frost_citadel ✅ açık karlı alan (onay bekliyor) · pvp_arena ⏸ (kaldırılabilir, dokunulmadı) | 🔨 |

## 2. Açık haritalar
| Harita | Tema | Durum |
|---|---|---|
| town | Garden meydanı, çember düzen, ada | ✅ bitti (kıyılar ve meydan elle düzenlendi; aracı yeniden çalıştırma) |
| forest | Fairy Forest | ✅ 128x96 (4x alan), köklü platolar, renkli koruluklar, rün taşları; her alan +3 kopya (onay bekliyor) |
| kurgan | Cemetery | ✅ 144x112, koyu kaya platolar, köknarlar, mumlu mezar kümeleri (onay bekliyor) |
| canyon | Desert | ✅ 128x96, kum kaplı kızıl mesalar, kaktüsler, kemikler, kervan kampı (onay bekliyor) |
| volcano | Forge + Town | ✅ 128x96, gri kaya, kül zemin, lav gölleri, kuru ağaçlar (onay bekliyor) |
| world | Town | ✅ 128x96, çimli kahve kaya, meşe/çam/sonbahar korulukları (onay bekliyor) |
| harbor | — | ❌ kaldırıldı: yerine town adasının güneybatı kıyısında tek bir rıhtım var (Town paketinin rıhtım parçaları: halatlı direkler, bank, sandıklar, fener direği). Balık town'da tutuluyor, Balıkçı Rıfat rıhtımda (`tools/rihtim.gd`, güverte görseli `tools/rihtim_gorsel.py`). |
| portallar | Portal paketi | ✅ oyunun bütün portalları yeşil (Dimensional_Portal), oyuncunun açtığı portal mavi (Portal_sprite, yeşille aynı boya küçültüldü) |
| frost | Town kar | ✅ 128x96, frost_citadel'in karı ve çamları, buz gölleri, kristaller (onay bekliyor) |

Açık haritalar `dungeon_theme.gd -- field <tema> <zone>` ile üretiliyor. Yerler `tools/field_<zone>.json` plan dosyalarında duruyor: her alan eski yerinde ve 3 kopyası daha var, şefler tek.

## 3. Moblar ve bosslar: 🔨
- Paket aileleri bizim moblara eşlenecek: Orc, Skeleton, Zombie, Banshee, Mummy, Stone/Golem, Rat, Bandit, Royal Crew, Medusa.
- El ve silah ayrı parçalar olacak; saldırı, abartısız bir silah savuruşu olacak.
- Bosslar aynı ailenin büyük ve renk tonu farklı halleri olacak.
- Pakette karşılığı olmayan moblar (kurt, balçık, ejderha, sırtlan, ayı...) en yakın paket ailesine çevrilecek.
- ✅ Prototip: ork ailesi (onay bekliyor). goblin, goblin_guard, Grukk, orc, orc_warrior, orc_shaman, orc_brute, Grom, Zulgar ve Mog'Thar.
  - Sayfaları `tools/mob_sheets.py` üretiyor; çıktı `assets/moblar/` altında.
  - El ve silah düzeni `scripts/world/mob_rig.gd`'de.
- ✅ Moblar arası mesafe: her mobun ayağında kendi boyunu aşmayan oval bir gövde var. Sunucu ovalleri birbirinden ayırıyor, sahnelerde `Govde` olarak görünüyor (`tools/mob_bodies.py`).
- ✅ Paket çekme: bir paketten bir mob saldırıya geçince paketin tamamı gelir. Zindanlarda paketler mob sırasından çıkarılıyor; açık haritalarda bir alanın tüm mobları bir paket.
- ⏳ Sıradakiler: iskelet, haydut, zombi/hayalet, mumya, taş/golem, sıçan/kobold, kraliyet muhafızları, elf, kütüphane, Medusa/bahçe, mantar, yarasa; ardından eşi olmayanlar.

## 4. Silahlar: ⏳
- 12 malzeme seti tier sırasına dizilecek: Tahta → Kemik → Rustik → Kale → Bahçe → Elf → Zehir → Mantar → Kütüphane → Lanetli → Altın → Ateş.
- 5 silah hattının 17 tier'ının hepsi ayrı görünecek; hem eldeki silah hem envanter ikonu değişecek.

## Araya girenler
- [ ] Son bossun ardından her oyuncuya ayrı hazine sandığı
- [x] Ata binme (H tuşu)
- [ ] At renkleri (görseller senden gelecek)
- [ ] Açık alan zindanları: frost_citadel tarzında (koridorsuz, bosslar uzağa dağılmış, paketler eşit aralıklı) yeni zindanlar. İlki çöl versiyonu (Desert + Floors_Tiles'ın kum karoları), sonra başka temalar.
