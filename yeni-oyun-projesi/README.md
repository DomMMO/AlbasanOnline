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
- GM paneli ve harita editörü web'de kalıyor (sunucu verisini düzenleyen araçlar).
- Harita editörü bir bölgeyi değiştirince (`mapChanged`) bake yeniden çalıştırılmalı; web
  istemcisi bunu canlı yapıyor.
- Boss müziği `.ogg`/`.mp3` ister (`art/licensed/music/<mob>.ogg`); web'deki `.weba` dosyasını
  dönüştür: `ffmpeg -i elder_dragon.weba elder_dragon.ogg`.
- Dekor animasyonları (çeşme dalgaları, bayrak dalgalanması, kıvılcım parçacıkları) pişirilirken
  ilk karede donuyor; bulutlar ve lamba/pencere ışıltıları hareketli.
