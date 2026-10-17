# Plato araçları

Başlangıç Vadisi'nde (world.tscn) kurulan, kullanıcının onayladığı plato yöntemi. Diğer haritalara aynı yolla uygulanır.

## Kurallar
- Karolar yalnızca izinli komşu çiftleriyle yan yana gelir (`plato_rules.json`).
- Çiftler şuradan çıkar:
  - Wall_Tiles.png'nin kahverengi plato bloğu (0-5. sütun, 0-9. satır).
  - Kullanıcının iki dersi (`ornekler.json`).
  - Onaylı ve yasak birkaç çift (`plato_rules.py` içinde, gerekçeleriyle).
- Düz kenarlar solda (0,2), sağda (5,3) tekrar eder.
- Köşe parçaları atlanmaz.
- Kenar köşedeyse uç sütun (0/5), devam ediyorsa devam sütunu (1/4) kullanılır.
- Temiz üst yüzey (2,4) tekrarıdır. Çapraz ön kenarın arkasında (2,3) olur.
- Şekiller girintili çıkıntılı kalır, düzleştirilmez.
- Zemin (yalnız çim) ile Plato (kaya ve çime inen uç) ayrı katmandır. Kaya görüşü keser (kaynak 27, alternatif 107; uçlar 0).
- Ağaç, kütük ve toprak/çakıl lekesi platoların üstüne gelmez. Ağacın bütün görseli kayadan uzak durur. Ağaçlar homojen dağılır, sıra sıra dizilmez.

## Akış
Her araç bir çalışma klasörünü ilk argüman olarak alır. Ara dosyalar oraya yazılır.

1. `layer_split.py`: zemin ile kayayı ayrı katmanlara ayırır (bir kez).
2. `plato_rules.py <klasör>`: kural çiftlerini üretir.
3. `plato_prep.py <klasör>`: çözülecek platoları, korunacak ve yasaklı kareleri (portal, nokta çevresi) çıkarır.
4. `plato_cpsat.py <klasör> <genişlik> <yükseklik>`: CP-SAT ile en iyi döşemeyi bulur.
   - Kenar kayası 32x32 pencerelerle çözülür.
   - Takılan pencerenin sınırı yeniden açılır.
5. `plato_apply.py <klasör> '<eşya taşımaları>'`: çözümü Plato ve Zemin katmanlarına yazar.
6. `plato_breaks.py <klasör>`: kalan kural ihlallerini bulur ve onarım pencereleri hazırlar. Ardından tekrar 4 ve 5 çalıştırılır.
7. `plato_vary.py <klasör>`: uzun düz kenarlara girinti ve çıkıntı ekler.
8. `trees_clear.py <klasör>`: ağaçları platolardan uzaklaştırır ve dağıtır.
9. `godot --headless --path . -s res://tools/export_maps.gd -- <zone>`: sunucu haritasını yazar. Sonra `check_maps` ve `npm run check-zones` çalıştırılır.

Yeni bir şey öğrenilirse (kullanıcı bir köşeyi elle düzeltip kaydederse) o bölge `ornekler.json`'a ders olarak eklenir.
