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
| world | Town | ✅ onaylandı ("kusursuz"): platolar kullanıcının öğrettiği kurallarla (`tools/plato/OKU.md`), zemin ve plato ayrı katmanda, ağaçlar platolardan uzak ve dağınık. **Bu yöntem diğer bütün haritalara uygulanacak.** |
| harbor | — | ❌ kaldırıldı: yerine town adasının güneybatı kıyısında tek bir rıhtım var (Town paketinin rıhtım parçaları: halatlı direkler, bank, sandıklar, fener direği). Balık town'da tutuluyor, Balıkçı Rıfat rıhtımda (`tools/rihtim.gd`, güverte görseli `tools/rihtim_gorsel.py`). |
| portallar | Portal paketi | ✅ oyunun bütün portalları yeşil (Dimensional_Portal), oyuncunun açtığı portal mavi (Portal_sprite, yeşille aynı boya küçültüldü) |
| frost | Town kar | ✅ 128x96, frost_citadel'in karı ve çamları, buz gölleri, kristaller (onay bekliyor) |

Açık haritalar `dungeon_theme.gd -- field <tema> <zone>` ile üretiliyor. Yerler `tools/field_<zone>.json` plan dosyalarında duruyor: her alan eski yerinde ve 3 kopyası daha var, şefler tek.

## 3. Moblar ve bosslar: 🔨
- Paket aileleri bizim moblara eşlenecek: Orc, Skeleton, Zombie, Banshee, Mummy, Stone/Golem, Rat, Bandit, Royal Crew, Medusa.
- El ve silah ayrı parçalar olacak; saldırı, abartısız bir silah savuruşu olacak.
- Bosslar aynı ailenin büyük ve renk tonu farklı halleri olacak.
- Pakette karşılığı olmayan moblar (kurt, balçık, ejderha, sırtlan, ayı...) en yakın paket ailesine çevrilecek.
- ✅ Ork ailesi tamam (onay bekliyor). Görünümler ve eller paketin kendi `.aseprite` el katmanından, kare kare sanatçının yerleşimiyle:
  - Goblin (hançer): goblin, goblin_guard (gri), kobold_miner (turuncu), frost_kobold (buz).
  - Ork Rogue (yay ve bıçak): orc.
  - Ork Savaşçı (kılıç ve kalkan): orc_warrior, orc_brute (toprak tonu).
  - Ork Şaman (asa ve kitap): orc_shaman.
  - Bosslar iki kat boyda ve kendi tonlarında: Grukk, Grom, Zulgar, Mog'Thar, Uruk.
  - Sayfaları `tools/mob_sheets.py` üretiyor, düzeni `scripts/world/mob_rig.gd` çiziyor. Kare hızları paketteki gibi saniyede 10.
  - war_wolf (hayvan) eşi olmayanlarla birlikte ele alınacak.
- ✅ Moblar arası mesafe: her mobun ayağında kendi boyunu aşmayan oval bir gövde var. Sunucu ovalleri birbirinden ayırıyor, sahnelerde `Govde` olarak görünüyor (`tools/mob_bodies.py`).
- ✅ Paket çekme: bir paketten bir mob saldırıya geçince paketin tamamı gelir. Zindanlarda paketler mob sırasından çıkarılıyor; açık haritalarda bir alanın tüm mobları bir paket.
- ✅ Menzilli moblar ve yol bulma:
  - Okçular yayı gerip takip eden ok atar (Wood yay kareleri ve okları).
  - Şamanlar asalarını kaldırıp takip eden büyü mermisi atar.
  - Hasar mermi varınca işlenir.
  - Moblar menzilden çıkan ya da görüşten kaçan oyuncuyu engellerin etrafından dolaşarak (A*) kovalar.
- ✅ Orc Fortress yalnızca orklardan oluşuyor, dört sınıf var:
  - Yakın dövüş: savaşçı, zorba.
  - Okçu: Ork Okçu.
  - Büyücü: şaman.
  - Rogue: Ork Suikastçı.
  - Paketler 7 şablondan: tek sınıf (sadece okçu, sadece yakın dövüş) ya da karışık. Savaş kurtları çıkarıldı.
- 📐 İlke: bir harita hangi paketin malzemesiyle yapıldıysa, o paketin düşman ailesiyle dolar. Onaylanan eşleşme:

  | Harita | Paket | Aile | Durum |
  |---|---|---|---|
  | Kara Orman (forest) | Fairy Forest | Elfler | ✅ |
  | orc_fortress | Hideout | Haydutlar (adı ve bossları da haydut olacak: Haydut Sığınağı) | ⏳ |
  | world (Başlangıç Vadisi) | Town | Orklar (Orc Fortress'teki orklar buraya taşınacak) | ⏳ |
  | bone_crypt, khan_barrow, jack_lair, kurgan | Cemetery (+Castle) | Zombiler | ⏳ |
  | sunken_temple | Garden (+Sewer) | Bahçe halkı ve Medusa | ⏳ |
  | canyon, buried_caravanserai | Desert | Mumyalar | ⏳ |
  | volcano, magma_forges, ash_temple, dragon_lair | Forge | Taş ailesi | ⏳ |
  | mağara zindanları | Cave | Mantarlar | ⏳ |
  | keep_hall, frost_citadel | Castle | Kraliyet muhafızları | ⏳ |
- ✅ Elf ailesi (Kara Orman). Eller ve silahlar sanatçının kendi `Social/Elfs.aseprite` dosyasından; koşu kareleriyle piksel piksel aynı:
  - Elf İzci (orak): dark_wolf, moon_wolf (gece tonu), skeleton (Mezar Soyguncusu).
  - Elf Avcı (yay ve ok, menzilli): satyr_spearman, orc (Elf Yağmacı), bandit_chief (Kara Murat, iki kat boy, kendi tonu).
    - Yayı yarım ve tam gerili kareler paketin silah vitrininden (`Social/Weapon.png`) blok blok okundu.
    - Kendi elf okunu atıyorlar.
  - Elf Koruyucu (kalkan ve çekiç): bandit, satyr_warrior, satyr_chief, dire_bear (Elf Vahşisi, ayı postlu, iki kat boy).
  - Elf Druid (kitap ve asa, büyü mermisi): poison_slime, night_wraith, moss_golem.
  - Görev metinleri elflere göre yeniden yazıldı; hedefler aynı.
  - Not: jack_lair'deki dark_wolf ve poison_slime şimdilik elf görünüyor; zombi geçişinde düzelecek.
- ⏳ Sıradakiler: yukarıdaki tablodaki aileler (her zindan kendi paketinin ailesiyle); ardından eşi olmayanlar.
- ✅ Duruş (idle) animasyonu sanatçının hızının 0,7'si (saniyede 7 kare).
- ✅ Mob plakası %5 küçük, %10 ince.
- ✅ Cast barları (WoW gibi; `shared/src/data/mobCasts.ts`, sunucu `server/src/game/mobCasts.ts`):
  - Sarı (büyü): kesme skilli ya da sersemletme durdurur.
    - Yıkım Küresi (büyük vuruş), Lanet Patlaması (yere işaretli alan), Şifa Ayini (paketi iyileştirir), Dehşet Laneti (3 sn sersemletir).
  - Gri (fiziksel): sadece sersemletme durdurur.
    - Ok Yağmuru (yere işaretli alan), Ezici Darbe, Hiddet (iri moblar, 10 sn daha sert ve hızlı vuruş).
  - Kim ne atar: casterlar Yıkım Küresi + bir büyü daha; okçular Ok Yağmuru; yakın dövüşçüler Ezici Darbe (iriler Hiddet de). 8. seviye altındaki moblar yetenek kullanmaz.
  - Kesilen büyü o mobda (boss da dahil) 10 sn yeniden başlayamaz.
  - Bosslar sersemlemez ama kesmeyi yer: Kan Ayini (kendini iyileştirir, sarı) kesilebilir; Yer Sarsıntısı, Sıçrayış ve Hücum gri bar gösterir.
  - Cast sürerken plaka yukarı kayar, bar altında belirir; kesilince kırmızı "Kesildi".
- ✅ Her sınıfa doğuştan kesme skilli (puansız, 1. seviyeden, 12 sn bekleme, global beklemeye girmez; boş hotbar yuvasına kendiliğinden yerleşir):
  - Savaşçı: Susturan Yumruk
  - Şaman: Rüzgâr Kesiği
  - Suikastçı: Boğaz Tekmesi
  - Okçu: Susturan Ok
  - Druid: Diken Gemi
  - Şifacı: Kutsal Sessizlik
  - Nekromant: Ruh Kilidi

## 4. Silahlar: ⏳
- 12 malzeme seti tier sırasına dizilecek: Tahta → Kemik → Rustik → Kale → Bahçe → Elf → Zehir → Mantar → Kütüphane → Lanetli → Altın → Ateş.
- 5 silah hattının 17 tier'ının hepsi ayrı görünecek; hem eldeki silah hem envanter ikonu değişecek.

## 5. Güç dengesi: 🔨 (hesaplar `DENGE.md`'de)
- [x] Parti ölçeklemesi, sadece zindanlarda (N = zindanın gördüğü en kalabalık sayı, hiç düşmez):
  - Mob canı ve XP ×N.
  - Düz vuruş hasarı +%25/kişi.
  - Yetenekler +%15/kişi daha sık; yetenek hasarı sabit.
  - Düşme şansı +%31,25/kişi.
- [x] Zindanda ganimet kişisel: her üyeye ayrı zar, ayrı yığın.
- [x] Tank speci, ustadan seçiliyor:
  - Savaşçı: Akıncı (hasar) ya da Kalkan Eri (tank).
  - Druid: Orman Gazabı (hasar) ya da Ayı Ruhu (tank).
  - Tank: alınan hasar ×0,6, can +%30, hasar −%25. Vurduğu mobu üstüne çeker.
  - Spec'i olmayan eski karakterler bir kereye mahsus bedava seçer. Değiştirmek için Ayşe Teyze'de yol sıfırlanır.
- [x] Mob can eğrisine şimdilik dokunulmuyor. Aradaki açığı eşyalar kapatacak; ölçüm kayıtları gelince yeniden bakılacak.
- [ ] Sunucuya ölçüm kayıtları eklenecek:
  - Ortalama öldürme süresi.
  - Ölüm sayısı.
  - Seviye başına geçen süre.
  - Saatlik ganimet.

## Sıra
1. Güç dengesi (5).
2. Zindan aileleri (3'teki tablo). İlk sırada Haydut Sığınağı ve orkların world'e taşınması var.
3. **Büyük güncelleme: world'deki bütün gelişmeler bütün açık haritalara** (forest, kurgan, canyon, volcano, frost). Yöntem `tools/plato/OKU.md`'de.
   - Zemin ve plato ayrı katmanlar.
   - Platolar kullanıcının kurallarıyla, girintili çıkıntılı.
   - Kaya görüşü kesiyor.
   - Platoların üstünde ağaç, kütük ya da toprak lekesi yok.
   - Ağaçlar platolardan uzak ve dağınık.
   - Her harita ayrı onaya gelir.
   - ✅ volcano, frost, forest geçti (onay bekliyor).
   - ⏳ kurgan, canyon: çapraz uzanan platolar bu sheet'lerde bölünüyor; yol seçimi bekleniyor.
4. Silahlar (4).
5. Araya girenler.

## Araya girenler
- [ ] Son bossun ardından her oyuncuya ayrı hazine sandığı
- [x] Ata binme (H tuşu)
- [ ] At renkleri (görseller senden gelecek)
- [ ] Açık alan zindanları: frost_citadel tarzında (koridorsuz, bosslar uzağa dağılmış, paketler eşit aralıklı) yeni zindanlar. İlki çöl versiyonu (Desert + Floors_Tiles'ın kum karoları), sonra başka temalar.
