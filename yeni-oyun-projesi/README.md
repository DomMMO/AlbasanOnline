# Albasan Online — Godot istemcisi

Oyunun Godot 4.7 (GDScript, GL Compatibility) istemcisi. Colyseus sunucusuna (REST `/api`,
eşleştirme `/matchmake`, WebSocket) bağlanır. Web build'i https://albasanonline.com kökünde
sunulur; telefonda dokunmatik kontrollerle oynanır.

Depoda yalnızca kod, sahneler ve `characters/` durur. `data/` ve `art/` (fontlar hariç) bake
çıktısıdır ve depoya girmez (bir kısmı lisanslı pikseller içerir): ilk açılıştan önce depo
kökünde `npm run bake:godot` çalıştır, `art/licensed/` için yerel lisanslı dosyaları kopyala.

## Çalıştırma

1. Godot 4.7 ile `yeni-oyun-projesi/project.godot` dosyasını aç (ilk açılışta görseller içe aktarılır).
2. Depo kökünde `npm run dev` ile yerel sunucuyu başlat, sonra F5. Editörden çalıştırınca
   varsayılan sunucu `http://localhost:2567`; dışa aktarılmış sürümler (exe, web)
   `https://albasanonline.com`'a bağlanır.
   - Editörden canlı sunucuya bağlanmak için Godot'u `--server=https://albasanonline.com`
     argümanıyla çalıştır (Proje > Proje Ayarları > Çalıştır > Ana Çalıştırma Argümanları ya da
     komut satırı), veya `user://settings.cfg` içine `[net] server="https://albasanonline.com"` yaz.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `scripts/net/` | MsgPack, Colyseus şema (v3) çözücüsü, oda bağlantısı, durum geri çağrıları |
| `scripts/autoload/` | `GameData` (shared verisi), `Net` (REST + odalar), `Keys` (tuş atamaları), `Settings` |
| `scripts/core/` | `ZoneMap` (çarpışma + istemci tahmini, `shared/src/movement.ts` ile birebir), `Items` |
| `scripts/gfx/` | `Sprites` (humanoid şablonları, kurt/balçık/sandık/portal, mob sheet'leri), `HorsePainter`, `Art`, `Fonts` |
| `scripts/world/` | `World`, `EntityView`, `WeaponView`, `ZoneView`, `NightLayer`, `Fx`, `SnapshotBuffer` |
| `scripts/ui/` | HUD, sohbet, mini harita, tüm pencereler (envanter, dükkân, demirci, yetenekler, görevler, depo, ahır, arkadaşlar, takas, pazar, pasif ağaç, hasar ölçer, PvP sıralaması, menü) |
| `scripts/lobby/` | Giriş, karakter seçimi ve yaratma (kale önünde) |
| `data/` | `shared.json` (eşyalar, moblar, skill'ler, bölgeler…), `zones/<id>.json` (harita + dekor + ışıklar) |
| `art/` | Pişirilmiş görseller: bölge zeminleri, dekor, ikonlar, imleçler, küre çerçeveleri |
| `art/licensed/` | Üçüncü parti sanat/font/müzik (depoya girmez, web istemcisindeki gibi) |
| `characters/` | Tüm karakterlerin sprite sheet'leri, SpriteFrames (`.tres`), hitbox'lı sahneleri (`.tscn`), `hitboxes.json` |
| `tools/` | Testler ve üreticiler (dışa aktarılan oyuna girmez) |

## Görseller ve veri nereden geliyor? (bake)

Haritalar, dekor, ikonlar ve diğer kodla çizilen her şey `client/` içindeki çizim kodu
(harita editörüyle ortak) çalıştırılarak üretilir; bu yüzden pikseller editörle aynıdır.
`shared/` ya da çizim kodu değişince (yeni bölge, eşya, mob, dekor) depo kökünde:

```
npm run bake:godot                 # her şey (~12 dk)
node tools/godot/bake.mjs --zones town,world   # sadece bazı bölgeler + veri
```

Harita editöründe (GM) yapılan değişiklikler canlı sunucudan alınır (`--api` ile başka sunucu).
Sonra Godot editörünü açmak yeni dosyaları içe aktarır.

## Karakterler: sprite sheet ve hitbox

`characters/` altında oyunun bütün karakterleri gerçek Godot varlıkları olarak durur:

- `players/<cinsiyet>_<saç>.png` — oyuncu temel sheet'leri (9 kare: aşağı 0-2, yukarı 3-5, yan 6-8)
- `classes/<sınıf>_<cinsiyet>.png` — sınıf görünümleri (başlık, başlangıç zırhı)
- `npcs/<npc>.png|.tres|.tscn`, `mobs/<mob>.tres|.tscn` (+ kodla çizilen moblar için `.png`)
- Her `.tscn`: `Sprite` (AnimatedSprite2D, ayaklar düğümün orijininde), `Hurtbox` (Area2D,
  katman 1, sprite'ın dolu pikselleri — tıklama/hedefleme), `Feet` (Area2D, katman 2, sunucunun
  çarpışma kutusu 10×6 = `PLAYER_HITBOX`).
- `hitboxes.json`: aynı kutular veri olarak (kare boyutu, orijin, hurtbox, feet; ayağa göre piksel).

Oyun NPC ve mobları bu `.tres` dosyalarından yükler: bir tasarımcı PNG'yi yeniden çizerse (aynı
kare düzeni) oyunda doğrudan görünür. Yeniden üretmek için:

```
godot --headless --path . res://tools/export_characters.tscn -- --phase=png
godot --headless --path . --import
godot --headless --path . res://tools/export_characters.tscn -- --phase=res
```

Oyuncular zırh/saç/ten renklerine göre çalışma anında boyanır (`scripts/gfx/sprites.gd`,
web'deki `humanoid.ts` + `textures.ts` ile birebir). Hitbox'ları görmek için:
Hata Ayıklama > Görünür Çarpışma Şekilleri.

## Haritalar (Godot sahneleri)

Bütün bölge haritaları normal Godot sahneleridir: `maps/<bölge>.tscn` (24 bölge). Zemin, eşya ve
ağaçlar WORLD ELEMENT paketinden (`assetpack/`); paketin karşılığı olmayanlar (kar, kül, lav,
bataklık, kurak bozkır zeminleri; çadır, iskele, gemi, deniz feneri, kolezyum, sütun, araba,
meşale, kale, çeşme, kuyu) şimdilik eski çizim (`tilesets/zemin.tres` kaynak 10, `props/*.tscn`).

| Klasör | İçinde |
| --- | --- |
| `maps/` | Harita sahneleri (kök düğüm `GameMap`: bölge, boyut, arka plan rengi) |
| `tilesets/zemin.tres` | Zemin TileSet'i: fizik katmanı 0 **yürümeyi**, 1 **görüşü** (menzilli saldırı) engeller; `tile` özel verisi karenin ne olduğu (map.ts `Tile`: su, gökyüzü…) |
| `assets/tiles/` | Zemin kareleri ve çimen/taş kenar geçişleri (PNG, Aseprite'ta açılır) |
| `props/ev/`, `props/koy/`, `props/doga/` | Eşya sahneleri (WORLD ELEMENT paketiyle): 6 ev tipi, sokak lambası, çit/ağıl, fıçı, sandık, sancak…; çalı, ot, çiçek, mantar, taş (`Sprite2D` + `StaticBody2D` hitbox + `MapLight` + `NightGlow`) |
| `assets/town/` | Bu eşyaların PNG'leri, paketten tek tek kesilmiş (evler paketin çatı/duvar/kapı/pencere parçalarından birleştirildi; `ev_N_isik.png` gece yanan pencereler) |
| `props/*.tscn`, `assets/props/` | Henüz paket karşılığı olmayan eski eşyalar: kale, çeşme, kuyu, araba, meşale, atlar |
| `scripts/map/` | `GameMap`, `MapSpot`, `MapLight`, `NightGlow`, `DriftingClouds`, `MapExport` |

Düzenlemek, Godot'da her 2D haritada olduğu gibi:

- **Zemin:** `Zemin` (TileMapLayer) alttaki toprak/taş/su/duvar; çimen, kum ve buz kendi katmanında
  (`Cimen`, `Kum`, `Buz`). Kenarlar paketin geçiş parçalarıyla: TileMap panelinin **Terrains**
  sekmesinde "Çimen" terrain'iyle boyarsan kenarları Godot kendisi seçer. Bir haritanın kenarlarını
  baştan hesaplamak: `godot --headless --path . -s res://tools/terrain_floors.gd -- map <bölge>`.
- **Eşya:** FileSystem'den `props/` altındaki sahneyi haritadaki `Esyalar` düğümüne sürükle.
  Kendi çizdiğin bir eşya için: PNG'yi `assets/props/`'a koy, Godot'da yeni sahne (Node2D kök,
  altında Sprite2D), hitbox için `StaticBody2D` + `CollisionShape2D` ya da `CollisionPolygon2D`.
  Kökün konumu eşyanın **ayak hizası** olsun (karakterlerle y'ye göre sıralanır). Mevcut bir
  eşyanın görselini değiştirmek için PNG'sini Aseprite'ta açıp kaydetmek yeter.
- **Hitbox (engel):** her şekil olur: dikdörtgen, daire, kapsül, istediğin gibi çizilmiş çokgen.
  `StaticBody2D`'nin Collision Layer'ı: **1 = yürünmez**, **2 = görüşü keser** (ikisi = ev, duvar;
  sadece 1 = su, çit). Bir eşyaya bağlı olmayan duvarlar haritadaki `Engeller` gibi StaticBody2D'lere.
  Kareler için TileSet editöründe fizik katmanına çokgen çiz.
- **NPC, portal, doğuş, yaratık:** `Noktalar` altındaki `MapSpot`'lar (Inspector: tür, kimlik,
  adet, yarıçap). Sürükleyerek taşı. `arrival` türü: başka bir bölgenin portalından (kimlik = o
  portalın id'si) gelen oyuncunun bu haritada nereye düşeceği.
- **Ağaçlar:** `props/doga/agac_*`, `cam*` (paketin ağaçları). Ormanın engeli haritanın `Orman`
  StaticBody2D'si.
- **Gece ışığı:** `MapLight` (yarıçap, renk, titreme, lamba mı); gece yanan pencereler `NightGlow`.

`Ctrl+S`: **Harita Dışa Aktarma** eklentisi (Proje Ayarları > Eklentiler'de açık olmalı) sunucunun
okuduğu `shared/maps/<bölge>.json`'u yazar. Bir eşya sahnesi ya da TileSet kaydedilince bütün
haritalar yeniden yazılır. Dosyada sadece sunucunun ihtiyacı var: kare türleri, engel şekilleri
(tam piksel), noktalar. Oyun haritayı sahneden yükler, çarpışmayı aynı `MapExport` ile kurar;
şekiller sunucuda ve oyunda aynı kodla (`shared/src/map.ts` `shapesBlock`, `scripts/core/zone_map.gd`)
kontrol edilir. Pişirmeye gerek yok, F5 yeter (yerel sunucu `npm run dev` ile açıksa dosya
değişince kendini yeniden başlatır). Canlıya çıkmak için sahneyi ve JSON'u commit'le.

Kontrol: `godot --headless --path . res://tools/check_maps.tscn` (her haritanın JSON'u sahnesiyle
aynı mı). Bütün JSON'ları sahnelerden yeniden yazmak: `-s res://tools/export_maps.gd`. Evleri
çakışmalardan ayırmak: `-s res://tools/settle_houses.gd -- <bölge>`.

**Zindan temaları** (`assetpack/ANOKOLISA`, Pixel Crawler paketleri; lisansı paketin kendisini
yeniden dağıtmayı yasaklar, herkese açık bir depoya konmamalı): `tools/dungeon_theme.gd` bir zindanın duvarını (üst + tuğla yüz), zeminini ve
lavını temanın karolarıyla yeniden boyar, eski eşyalarını temanınkilerle değiştirir. Kare türleri ve
engeller birebir aynı kalır (sunucu dosyası değişmez). `build` ise zindanı baştan kurar
(`BUILDS`: 20 eşit oda, 5/10/15/20. odalarda boss, çeşitli oda biçimleri ve düzenleri, her eşya bir
odada en fazla 2 kez) ve doğuştan her noktaya yol olduğunu kontrol eder. Forge: magma_forges,
ash_temple, dragon_lair.

```
godot --headless --path . -s res://tools/dungeon_theme.gd -- lava forge      # lav sayfası (assets/zindan/)
godot --headless --path . --import
godot --headless --path . -s res://tools/dungeon_theme.gd -- tileset forge   # TileSet kaynakları 11, 12
godot --headless --path . -s res://tools/dungeon_theme.gd -- scenes forge    # props/forge/
godot --headless --path . -s res://tools/dungeon_theme.gd -- build forge <bölge> ...
```

**Bir bölgeyi Godot'ya taşımak** (bir kerelik; görseller bake'teki çizimden PNG olarak çıkar):

```
npx tsx tools/godot/import-zone.mts <bölge> --edits <web-editör-json>   # ya da --api ...
node tools/godot/bake.mjs --zones <bölge> --quick
godot --headless --path . -s res://tools/migrate_map.gd -- <bölge> images
godot --headless --path . --import
godot --headless --path . -s res://tools/migrate_map.gd -- <bölge> scenes
```

Sonra `maps/<bölge>.tscn`'i aç, kaydet (JSON sahneden yazılır).

## Testler

- `godot --headless --path . -s res://tools/check_scripts.gd` — bütün betikleri derler.
- `godot --headless --path . -s res://tools/net_smoke.gd -- --server=http://localhost:2567` — kayıt,
  karakter, odaya katılma, durum çözme, hareket, MsgPack mesajları.
- `godot --path . res://tools/visual_test.tscn -- --server=... --user=... --pass=... --out=klasör [--combat|--windows|--skills|--portal]`
  — oyunu gerçekten oynar ve ekran görüntüsü alır.

## Dışa aktarma

`export_presets.cfg`: Windows ve Web. `.json` veri dosyaları `include_filter` ile pakete girer.

**Web'de yayın (`https://albasanonline.com/oyun/`):** web sürümü sunucu adresini sayfanın
adresinden alır (aynı alan adı, CORS gerekmez; iş parçacığı kapalı olduğu için özel başlık da
gerekmez). Tarayıcıda sistem fontu olmadığından `art/fonts/` altındaki OFL fontları (EB Garamond,
Courier Prime, Noto Symbols) kullanılır.

1. Veriyi **sunucunun çalıştırdığı koddan** pişir (genelde `main`): harita farkı olursa hareket
   tahmini sapar.
2. `godot --headless --path . --export-release Web ../build/godot-web/index.html`
3. Depo kökünden `deploy/deploy-godot.sh root@SUNUCU yeni-oyun-projesi/../build/godot-web` — paketi
   `/opt/mmo/godot-web`'e koyar ve sunucunun mevcut koduyla yeniden derler (`update.sh` bu
   paketi `client/public/oyun/` içine kopyalar).

## Web istemcisinden farklar / henüz yapılmayanlar

- Dokunmatik kontroller (telefon joystick'i) yok: Godot istemcisi masaüstü için.
- GM paneli web'de kalıyor. Haritalar Godot sahnesi (yukarıda); henüz taşınmamış bölgeler için web
  editörü de duruyor, onunla değişen bölgede bake yeniden çalıştırılmalı.
- Boss müziği `.ogg`/`.mp3` ister (`art/licensed/music/<mob>.ogg`); web'deki `.weba` dosyasını
  dönüştür: `ffmpeg -i elder_dragon.weba elder_dragon.ogg`.
- Dekor animasyonları (çeşme dalgaları, bayrak dalgalanması, kıvılcım parçacıkları) pişirilirken
  ilk karede donuyor; bulutlar ve lamba/pencere ışıltıları hareketli.
