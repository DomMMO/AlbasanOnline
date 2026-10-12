# MMO Creation

Tarayıcıda çalışan, 2D pixel art bir online MMORPG. Savaş ve içerik yapısı WoW'dan, item basma (+N) sistemi Knight Online'dan esinleniyor.

## Çalıştırma

```bash
npm install
npm run dev
```

Durdurmak için: `npm run dev`'i çalıştırdığın terminalde **Ctrl+C**, ya da herhangi bir terminalden `npm run stop`. `npm run stop` veritabanını düzgünce kapatır ve Windows'ta arkada asılı kalmış eski süreçleri de temizler; bir şey "port kullanımda" hatası verirse önce onu çalıştır.

`npm run dev` üç süreç başlatır:

- **db**: geliştirme için gömülü PostgreSQL 17, port 5433. Kurulum gerektirmez; programı `embedded-postgres` npm paketinden gelir. Veriler kalıcıdır.
- **server**: oyun sunucusu ve REST API, http://localhost:2567
- **client**: http://localhost:5173 (aynı ağdaki telefondan: `http://<bilgisayarın-IP'si>:5173`)

Kayıt olun, bir karakter oluşturun ve oyuna girin. Yeni karakterler **Ana Merkez**'de (şehir) başlar; çıkış yaptığın bölgeye (şehir ya da Başlangıç Vadisi) geri girersin. Çok oyunculu test için ikinci bir hesap açıp başka bir sekmeden girin. Aynı karakterle ikinci kez girilirse eski bağlantı atılır.

> **Windows notu:** PostgreSQL, yolunda ASCII dışı karakter olan klasörlerde (ör. `Masaüstü`) çalışamıyor. Proje böyle bir klasördeyse PostgreSQL programı ve veriler `%LOCALAPPDATA%\mmo-creation` altında tutulur. Veritabanını sıfırlamak için `npm run dev` kapalıyken o klasördeki `data` klasörünü silin. Yayında `DATABASE_URL` ile gerçek bir PostgreSQL kullanılır.

### Sınıflar

Karakter oluştururken sınıf seçilir:

| Sınıf | Kaynak | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **Savaşçı** (yakın dövüş, ileride tank) | Öfke: vurdukça ve hasar aldıkça dolar | Ağır Darbe | Girdap (çevreye) | İkinci Nefes (can) |
| **Büyücü** (uzaktan hasar) | Mana | Ateş Topu (1,5 sn büyü) | Buz Halkası (çevredekileri 4 sn dondurur) | Yıldırım (anında) |
| **Şifacı** (iyileştirici) | Mana | Kutsal Işık (1,2 sn büyü) | Şifa (1,5 sn büyü; hedef oyuncu ya da kendin) | Koruyucu Kalkan (hasar emer) |
| **Muhafız** (tank) | Öfke | Kalkan Darbesi (güçlü tek hedef) | Meydan Okuma (çevreye vurur, hepsinin dikkatini çeker) | Kalkan Duvarı (8 sn %50 az hasar, öfke istemez) |
| **Nekromant** (çağırıcı) | Mana | Ruh Emme (1,3 sn büyü; hasarın %40'ı kadar can emer) | İskelet Çağır (25 sn, hedefine saldırır) | Kemik Patlaması (çevreye) |

- Muhafız vurduğu her düşmanın dikkatini (aggro) anında diğer oyunculardan alır ve her hasarı %10 az yer. Savaşçı'nın kılıç, balta ve plaka zırhlarını kuşanır; görevlerde Savaşçı ödüllerini alır.
- Nekromant asa (Büyücü asaları dahil) ve cübbe kuşanır; görevlerde Büyücü'nün sınıf ödüllerini alır. İskelet sahibinin saldırdığı hedefe, yoksa sahibine saldıran yaratığa vurur; sahibi ölünce ya da bölge değiştirince kaybolur. Yaratıklar iskelete saldırmaz.
- Büyü süresi olan skill'lerde büyü barı dolar; **yürürsen büyü iptal olur**.
- Uzak saldırılar ağaç ve duvarların arkasına yapılamaz (görüş hattı).
- Başka bir oyuncuya tıklamak onu dost hedef yapar (Şifa ve Kalkan için).
- Kılıç, balta ve tırpanları sadece Savaşçı; asaları sadece Büyücü ve Şifacı kuşanabilir. 4 ve 5 numaralı slotlarda Savaşçı'nın iki can iksiri, diğerlerinin can ve mana iksiri vardır.
- Sınıf verileri `shared/src/data/classes.ts`, skill'ler `shared/src/data/skills.ts` içindedir.

### Grup (parti)

En fazla 5 kişi. Bir oyuncuya tıklayıp hedef çerçevesindeki **Gruba davet et**'e bas ya da sohbete `/davet İsim` yaz; karşı tarafa Kabul/Reddet kutusu çıkar.

- Komutlar: `/p mesaj` grup sohbeti, `/ayril` gruptan çık, `/at İsim` (lider) gruptan at. Lider ayrılırsa liderlik sıradakine geçer.
- Sol taraftaki grup çerçeveleri üyelerin can/mana/bölgesini gösterir; tıklayınca (aynı bölgedeyse) hedef alınır.
- **XP:** kesilen mob'un XP'si yakındaki grup üyeleri arasında bölüşülür, kişi başı %20 grup bonusuyla.
- **Ganimet:** grubun kestiği mob'un sandığını tüm grup açabilir.
- **Roller:** Savaşçı 2 kat tehdit üretir (tank), iyileştirme de tehdit üretir. Mob hedef alınınca can barında kime saldırdığı görünür ("→ İsim").
- **Grup zindanı:** gruptan biri zindana girdiyse diğerleri aynı kapıdan girince aynı kopyaya düşer; gruba ait olmayan biri o kopyaya giremez. Her ek oyuncu için boss'ların canı %60 artar.
- **Arenada** grup arkadaşları düşman değildir; birbirinizi iyileştirebilirsiniz.

Gruplar sunucu belleğinde tutulur: sunucu yeniden başlarsa dağılır.

### Kan Arenası (PvP)

Ana Merkez'deki kırmızı portaldan (seviye 5+) girilen, herkesin herkese saldırabildiği ortak arena.

- Arenada diğer oyuncular düşmandır: kırmızı isim, tıkla ya da Tab ile hedef al. Skill'ler, otomatik saldırı, Girdap ve Buz Halkası oyunculara da işler.
- Oyuncuya verilen hasar %50'dir (skill'ler mob'lara göre ayarlı). Buz Halkası oyuncuları yarı süre (2 sn) dondurur.
- Doğunca 5 sn koruma (yarı saydam): oyuncular sana vuramaz; sen saldırınca koruma biter.
- Ölünce XP kaybı yok, arenada rastgele bir köşede yeniden doğarsın.
- **PvP puanı:** Elo benzeri, 1000'den başlar; güçlü birini yenmek daha çok kazandırır. Aynı kişiyi 2 dakika içinde tekrar öldürmek puan getirmez.
- **L**: sıralama tablosu (çevrimiçi oyuncuların değerleri canlı). 5, 10, … seri öldürmeler tüm sunucuya duyurulur.

### Sohbet

**Enter** ile yaz, **Enter** ile gönder, **Esc** ile vazgeç. Mesajlar tüm sunucuya (mağaradakiler dahil) gider; aynı bölgedekiler karakterinin üstünde konuşma balonu da görür.

- Fısıltı: `/f İsim mesaj` (sohbetteki bir isme tıklamak fısıltıyı başlatır).
- GM mesajları [GM] etiketiyle görünür; +7 ve üstü item basmaları sistem mesajı olarak düşer.
- Flood koruması: 5 saniyede en fazla 5 mesaj.

### Kontroller

| Tuş | Eylem |
| --- | --- |
| WASD / oklar | Yürü |
| Mob'a tıkla | Hedef al ve saldır |
| Tab | Sıradaki yakın mob'u hedef al |
| F | Seçili hedefe saldır |
| 1 / 2 / 3 | Ağır Darbe / Girdap / İkinci Nefes |
| 4 / 5 | İksirler (sınıfa göre can / mana) |
| Enter | Sohbet |
| J | Görev günlüğü |
| P | Pasif ağaç |
| T | Şehir portalı (bulunduğun yerde açılır) |
| L | PvP sıralaması |
| /davet İsim, /p, /ayril | Grup |
| I veya C | Karakter ve envanter penceresi |
| E | Yakındaki sandığı aç / NPC ile konuş / portal / tezgâha bak |
| Sağ tık (envanterde) | Kuşan, kullan; dükkân açıkken sat |
| Sürükle-bırak | Item'ı taşı, kuşan, çıkar |
| Esc | Açık pencereyi kapat, yoksa hedefi bırak, yoksa **menü** (ayarlar, kontroller, karakter değiştir, çıkış) |

### Mobil (telefon / tablet)

Telefon bilgisayarla aynı Wi-Fi'de olmalı: `npm run dev` çıktısındaki **Network** adresini aç (ör. `http://192.168.1.7:5173`). Windows Güvenlik Duvarı Node.js'e izin istediğinde **Özel ağlar** için izin ver; oyun sunucusu 2567 portunu kullanır, o da erişilebilir olmalı.

Dokunmatik cihazlarda ekrana kontroller gelir (bilgisayarda denemek için adrese `?touch=1` ekle):

- Sol altta **joystick**: yürü (8 yön).
- Sağ altta **Saldır** (F), **Hedef** (Tab), **E** (konuş / al / portal / tezgâh).
- Sağda **Çanta**, **Görev**, **Sohbet**, **Menü**.
- Mob'a, NPC'ye, portala ve hotbar slotlarına dokunmak doğrudan çalışır.
- Envanterde bir item'a bir kez dokun: bilgisi çıkar; tekrar dokun: kullan/kuşan (bilgisayardaki sağ tık).

Dokunmatik kontroller `client/src/ui/touch.ts` içindedir; tuşlarla aynı eylemleri tetikler (`InputManager`).

### Görseller (asset) hazırlamak

Oyun `pixelArt` modunda, kamera 2-4 kat yakınlaştırır; bu yüzden görseller küçük çizilir ve büyütülünce keskin kalır. Ölçüler:

| Ne | Şu anki boyut | Önerilen (kendi çizimin için) |
| --- | --- | --- |
| Zemin karesi (tile) | 16×16 | **16×16**, kenarları birbirine uyan |
| Oyuncu / insan NPC | 12×16 kare | **16×24** kare (ayaklar alt ortada) |
| Normal mob (kurt, balçık…) | 16×11, 12×10 | **16×16** - **24×24** |
| Elit mob | 2 kat büyütülmüş | **32×32** |
| Boss | Kabak Jack 50×47 | **48×48** - **64×64** |
| Item ikonu | 12×12 | **16×16** |
| Bina, çadır, çeşme | kodla çiziliyor | 16'nın katları (ör. 7×5 kare bina = 112×80 + çatı için 16 px üst) |
| Efekt (büyü, patlama) | kodla çiziliyor | 16×16 - 32×32 |

Kurallar:
- **PNG**, saydam arka plan, kenar yumuşatma (anti-aliasing) **kapalı**, yarı saydam piksel yok.
- Bir animasyonun bütün kareleri **aynı boyutta** olmalı; karakterin ayakları her karede aynı noktada durmalı.
- Yönler: aşağı, yukarı, yan (sağa bakan; sola bakan aynalanır). Animasyonlar: bekleme (1-4 kare), yürüme (4-6), saldırı (3-4), ölüm (3-6). Hepsini tek bir sprite sheet'te satır satır diz.
- Az renk kullan (bir karakter için 8-16 renk), 1 piksel koyu kontur.
- Araçlar: **Aseprite** (ücretli, en iyisi), **LibreSprite** / **Pixelorama** / **Piskel** (ücretsiz).

Hazır sheet'leri `client/src/assets/` altına koy. Kabak Jack'teki gibi her sheet için bir `.json` (kare boyutu, ayak noktası, animasyon kare aralıkları) yazılır ve `client/src/gfx/imageSprites.ts` ile oyuna bağlanır. Kaynak/lisans bilgisini `CREDITS.md`'ye ekle.

### Arayüz

- **Esc** sırası: önce oyun menüsü (ayarlar/kontroller sayfasındaysan ana menüye döner), sonra **en son açılan pencere**, sonra hedef; hiçbir şey açık değilse menüyü açar. Grup davetinde Esc daveti reddeder.
- Menü açıkken oyun girdisi kilitlidir (yürüme, skill, kısayollar).
- Pencereler başlığından **sürüklenir**, tıklanan öne gelir; yeri bu tarayıcıda hatırlanır. Başlığa çift tıklamak varsayılan yerine döndürür.
- Başlıklar, isimler ve düğmeler **Cloister Black** ile yazılır (`client/src/assets/fonts/`, Türkçe harfler eklenmiş kopya); uzun metinler okunaklı bir serif fontla. Pencere yönetimi `client/src/ui/windows.ts`, tema `style.css` sonundaki "Theme" bölümündedir.

### Hikaye: Kırık Mühür

Yüzyıllar önce Gölge Efendisi Moraz bu toprakları karanlığa boğdu. Atalar onu **Altın Mühür** ile yerin altına zincirledi. Mühür kırıldı; parçaları diyara saçıldı ve gölge sızmaya başladı. Balçıklar, kurtlar, goblinler azgınlaştı. Bir parçayı yutan Kabak Jack canavara dönüştü; bir başkasını bulan Haydut Reisi Kara Murat, Kara Orman'ı ele geçirdi. Ana Merkez son kale. Sen kapıdan yeni girmiş bir maceracısın.

Hikaye görevlerle anlatılır: NPC'lerin teklif ve bitiş konuşmaları hikayenin kendisidir. Üçüncü parçanın Ejder Sırtı'nda olduğu söylenir (sonraki bölge).

### Görevler

Başında sarı **!** olan NPC'nin verecek görevi var; sarı **?** teslim edilecek bitmiş görev, gri **?** devam eden görev demek. NPC'ye tıkla ya da yanında **E**'ye bas: konuşma penceresi açılır (dükkânı olan NPC'lerde **Alışveriş** düğmesi de vardır).

- Görev türleri: **öldür** (sunucu sayar; grubunla kestiğin mob'lar herkese sayılır), **topla** (envanterden sayılır, teslimde alınır), **git konuş** (başka bir NPC'ye götür).
- Görevler zincirlidir: bir sonraki, öncekini bitirince açılır. Seviyesi yetmeyen sıradaki görev gri görünür.
- Ödüller: XP, altın ve item; silah/zırh ödülleri **sınıfına göre** verilir. Ödüller için envanterde yer olmalı.
- Sağda **görev takibi**; **J** ile görev günlüğü (görevi bırakma buradan). En fazla 15 aktif görev.
- **Tekrarlanabilir** görevler (Vadi Devriyesi, Haydut Ödülü, Kemik Tozu, Ruh Taşları) bitince tekrar alınabilir.

| Zincir | Sv | Görevler |
| --- | --- | --- |
| Kırık Mühür (vadi) | 1-9 | Komutan Baran → Bilge Ozan → Avcı Ayla: balçık, jöle (İksirci'ye), kurt, post (Zırhçı'ya), goblin, kulak (Komutan'a), Grukk, Kabak Jack, Kara Orman'a yolculuk |
| Kara Orman | 10-18 | Orman Bekçisi Tarık: kara kurt, zehirli bataklık, haydut, nişanlar (Komutan'a), iskelet, ork, boz ayı, Kara Murat |
| Kırık Mühür (final) | 18 | İki mühür parçasını Bilge Ozan'a götür |
| Akşam Yemeği | 3+ | **Ayşe Teyze** (meydanın doğusu): 5 Kurt Eti + 3 Balçık Jölesi topla, güveci Komutan Baran'a ve Bilge Ozan'a götür; sonra her akşam tekrarlanabilir. Ödül: Ayşe Teyze'nin Güveci (150 can, iksirlerden ayrı bekleme süresi). Metin2'nin meşhur akşam yemeği görevine selam. |

Görevler ve hikaye metinleri `shared/src/data/quests.ts` içindedir; sunucu tarafı `server/src/game/quests.ts`. İlerleme `character_quests` tablosunda saklanır.

### Kara Orman (Sv 10-20)

Başlangıç Vadisi'nin kuzey ucundaki ışınlanma kapısından (Sv 8+) girilir. Girişte korucuların kampı var: **Orman Bekçisi Tarık** (görevler) ve **Gezgin Tüccar Rıza** (büyük iksirler, Geri Dönüş Parşömeni).

| Bölge | Mob | Sv |
| --- | --- | --- |
| Kampın kuzeydoğusu | Kara Kurt | 10 |
| Batıdaki bataklık | Zehir Balçığı | 11 |
| Kuzeydoğu, haydut kampı | Haydut | 12 |
| Kuzeybatı, eski mezarlık | İskelet Savaşçı | 14 |
| Güneybatı, ork oyuğu | Ork Yağmacı | 16 |
| Doğu, ayı ini | Boz Ayı (elit) | 18 |
| Haydut kampının kuzeyi | **Haydut Reisi Kara Murat** (saha boss'u, 5 dk'da yeniden doğar) | 20 |

Kara Murat yere vurur (kızıl halka), önündeki şeritte koşar ve %60/%30 canda haydut çağırır. Her zaman Mühür Parçası düşürür; Kabak Jack de öyle.

### Item'lar

Knight Online ve Metin2'den esinlenen 88 yeni item (Sv 3-22), çoğu `shared/src/data/gear.ts` içinde formülle üretilir:

- **Yeni slotlar:** Kolye (can), Yüzük (saldırı), Küpe (savunma). Her biri 5 kademe: Bakır → Gümüş/İnci → Yakut/Altın/Zümrüt → Ejder Gözü/Safir/Ay Taşı → Mühürlü Kolye, Kudret Yüzüğü, Kızıl Ejder Küpesi. Bakır ve gümüş takılar **Kuyumcu Selin**'de (demircinin altında) satılır.
- **Silah serileri** (her biri 5 kademe, Sv 9-22): Savaşçı kılıçları (Hilal → Dolunay → Zehirli → Aslan → Ejderha), Savaşçı baltaları (Kemik → Savaş Teberi → Kara Ay → Gök Gürültüsü → Kızıl Ejder Teberi), Büyücü asaları (Kristal → Ateş → Buzul → Yıldırım → Anka), **Şifacı topuzları** (Kutsal → Şafak → Güneş → Melek → Nur).
- **Sınıf zırh setleri** (baş, gövde, bacak, ayak; 5 kademe, Sv 8-20): Savaşçı plakaları (Tunç, Demir Pul, Kara Çelik, Kartal, Ejder Pulu) ve Büyücü/Şifacı cübbeleri (Çırak, Bilgin, Mistik, Yıldız, Kadim; daha az savunma, artı büyü gücü).
- İlk kademe silah ve zırhlar Silahçı ve Zırhçı'da satılır; üst kademeler Kara Orman'dan düşer ve görev ödülüdür.
- **İksirler:** Büyük ve Süper Can/Mana İksiri. **Geri Dönüş Parşömeni:** savaşta değilken seni Ana Merkez'e ışınlar.
- **Materyaller:** Kara Kurt Postu, Zehir Kesesi, Haydut Nişanı, Kemik Tozu, Ork Dişi, Ayı Pençesi, nadir **Ruh Taşı** (pahalı satılır, tekrarlanabilir görevde Yüksek parşömene dönüşür). **Mühür Parçası** görev eşyasıdır, satılamaz.
- İpucu kutusunda item'ı hangi sınıfların kullanabileceği yazar.

### Gece ve gündüz

Sunucunun tek bir oyun saati var: **1 oyun günü 48 gerçek dakika** (1 oyun dakikası = 2 sn). Saat ekranın üst ortasında görünür; açık alanlar (şehir, vadi, Kara Orman, arena) akşam kararır.

- **Gece 20:00-06:00:** açık alandaki tüm yaratıklar **%20 daha güçlü** (can, saldırı, savunma, boss yetenekleri) ve **%20 daha ödüllü** (XP, altın, drop şansı, item'ların daha çok statlı düşmesi). Güçlenmiş yaratıklar mor tonda görünür, hedef çerçevesinde "Gece gücü" yazar. Zindanlar etkilenmez.
- **Gece yaratıkları** sadece gece doğar, **%50 daha güçlü ve ödüllüdür**, şafakta (savaşta değillerse) kaybolur. **Gece Özü** düşürürler (tüccara iyi satılır).

| Bölge | Yaratık | Sv |
| --- | --- | --- |
| Başlangıç Vadisi, balçık alanları | Gölge Balçığı | 3 |
| Başlangıç Vadisi, kurt alanı | Hayalet Kurt | 6 |
| Kara Orman, mezarlık | Gece Hortlağı | 13 |
| Kara Orman, kurt alanı | Ay Kurdu | 16 |

- GM paneldeki **Dünya Saati** kartından saat ayarlanır, hazır düğmelerle sabah/akşam/gece yapılır ya da zaman durdurulur. Ayar veritabanına kaydedilir (`world_settings`), sunucu yeniden başlasa da korunur.
- Saat ve oranlar `shared/src/daynight.ts`, sunucu saati `server/src/game/worldClock.ts` içindedir.

### Item statları (Path of Exile tarzı)

Her ekipman (silah, zırh, takı) **1 ile 5 arası rastgele stat** ile oluşur. Item'ın değeri stat sayısından anlaşılır: ismin rengi ve ipucundaki yıldızlar stat sayısını gösterir.

| Stat sayısı | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Renk | Sıradan (beyaz) | Kaliteli (yeşil) | Nadir (mavi) | Destansı (mor) | Efsanevi (turuncu) |
| Düşme şansı | %40 | %28 | %18 | %10 | %4 |
| Satış değeri | x1 | x1,5 | x2,5 | x4 | x7 |

- Olası statlar (her biri bir item'da en fazla bir kez): Saldırı, Savunma, Can, % Saldırı, % Can, Kritik Vuruş Şansı, Saldırı Hızı, Can Çalma. Değer aralıkları item seviyesiyle büyür.
- Gece yaratıkları daha çok statlı item düşürür. Dükkân malları ve başlangıç ekipmanı hep 1 statlıdır. 5 statlı bir item bulmak tüm sunucuya duyurulur.
- Stat'lar +N basmayla değişmez; item pazarda el değiştirince statları da gider. Bu sistemden önce var olan ekipmanlar ilk yüklendiklerinde bir kez stat atar.
- GM panelinde item verirken **Stat** alanıyla stat sayısı seçilebilir (0 = normal drop gibi rastgele).
- Kurallar `shared/src/data/affixes.ts` içindedir; statlar `items.affixes` (JSONB) kolonunda saklanır.

### Pasif ağaç (P)

Sabit düğümleri yok: **20 büyük boş slot** var, seviye 2'den 21'e kadar her seviyede bir tanesi açılır. Her büyük slotun altında **5 küçük slot** vardır.

Ekran bir çemberdir: 20 büyük yuva çemberin etrafında durur. Bir yuvaya tıklayınca çember döner, yuva en üste gelir ve sarı bir çizgiyle ortadaki küçük çembere bağlanır; 5 küçük yuva orada (dördü çemberin üstünde, biri ortasında) görünür. **1, 6, 11 ve 16. yuvalar Kadim Yuva'dır** (kırmızı halka ve dört elmas işareti; seçili yuva sadece büyür ve sarı halkayla belirtilir, Kadim Yuva seçiliyken küçük yuvalara inen çizgi kırmızıdır): Büyük Mücevher'in yanı sıra **Kadim Mücevher** de alır.

- **Kadim Mücevher** (çok nadir; boss'larda %8): güçlü ve özel bir etki. +1 İskelet (aynı anda bir iskelet daha, en çok +2), skill bekleme süresi kısalması, öfke/mana bedeli azalması, alınan hasar azalması, kritik hasarı, öldürünce can yenileme, savaşta can yenilenmesi, XP bonusu, iskelet hasarı.

- Büyük slota **Büyük Mücevher** takılır. Tek ve büyük bir etkisi vardır: bir skill'in etkisi %10-30 artar (ör. "Girdap etkisi %20 artar"), ya da büyük bir genel bonus (% Saldırı, % Can, Kritik, Saldırı Hızı, Can Çalma, iskelet hasarı, kritik hasarı, bekleme süresi, XP).
- Büyük mücevher takılı olan slotun küçük slotlarına **Küçük Mücevher** takılır. Her biri bir özellik verir (ör. "+5 Güç").
- Mücevherler her yaratıktan düşebilir (normal %3 küçük / %1 büyük, elitler ve boss'lar çok daha sık). Değerleri düşüren yaratığın seviyesiyle büyür. Gece oranları artar.
- Mücevherler yuvarlaktır: büyükler altın çerçeveli iri taş, küçükler çerçevesiz ufak taş. Her mücevher bir **nadirlikle** düşer (Sıradan %40 … Efsanevi %4, gece daha iyi); rengi nadirliğini gösterir, nadir olan değer aralığının üst kısmından gelir.
- Takmak için envanterden sürükle ya da sağ tıkla (ilk uygun boş slota gider). Çıkarmak için slotta sağ tık ya da envantere sürükle. Küçük mücevherleri dururken büyük mücevher çıkarılamaz, başka bir büyükle değiştirilebilir.

| Özellik | Her puan |
| --- | --- |
| Güç | +1 Saldırı, +2 Can |
| Çeviklik | +%0,2 Kritik, +%0,3 Saldırı Hızı |
| Zeka | +4 Mana, +%0,5 tüm skill etkisi |
| Dayanıklılık | +5 Can, +0,5 Savunma |

Kurallar `shared/src/data/passives.ts` ve `shared/src/data/affixes.ts`, sunucu tarafı `server/src/game/passives.ts` içindedir. Takılı mücevherler `items` tablosunda `container = 'passive'` olarak saklanır.

### Şehir portalı (T)

**T**'ye basınca bulunduğun yerde (zindan dahil, şehir hariç) Ana Merkez'e bir portal açılır. Şehirde de seni tam bıraktığın yere geri götüren bir portal durur; ikisine **E** ya da tıklamayla girilir. Portal sen başka bir haritaya girene ya da oyundan çıkana kadar (20 sn tolerans) durur; yeni bir T eskisinin yerini alır. Portal açık olduğu sürece zindan kopyası kapanmaz, döndüğünde her şey bıraktığın gibidir. Portalları herkes görür, sadece sahibi kullanabilir. Kod: `server/src/game/townPortal.ts`.

### Büyük zindanlar (Kara Orman)

Kara Orman'dan girilen beş zindan. Goblin Mağarası'ndan çok daha uzundur: odalar zinciri boyunca 40'tan fazla yaratık ve kendi odalarında 3-4 boss. Sondaki çıkış portalı **bütün boss'lar ölünce** açılır. Haritalar `shared/src/dungeons.ts` içindeki üreteçle oluşturulur, zindanlar `shared/src/bigDungeons.ts`, yaratıkları `shared/src/data/dungeonMobs.ts` içindedir.

| Zindan | Giriş (Kara Orman) | Sv | Boss'lar |
| --- | --- | --- | --- |
| Terk Edilmiş Maden | ana yolun batı ucu | 9+ | Ustabaşı Dorak, Kristal Golem, **Maden Kralı Gırtlak** |
| Batık Tapınak | bataklığın kuzeydoğusu | 12+ | Taş Muhafız, Kurban Rahibesi Selvara, Gelgit Canavarı, **Batık Kral Nerion** |
| Kemik Mahzeni | mezarlığın kuzeyi | 15+ | Mezar Bekçisi Orvak, Kemik Canavar, **Lich Azgor** |
| Ork Kalesi | ork oyuğunun güneybatısı | 18+ | Kapı Bekçisi Grom, Kurt Binicisi Uruk, Şaman Zulgar, **Savaş Lordu Mog'Thar** |
| Ejder İni | kuzey yolunun sonu | 21+ | Kül Muhafızı, Lav Devi, Ejder Rahibi Vael, **Kadim Ejder Azhdar** (Mühür Parçası düşürür) |

### Arayüz eklentileri

- Sağ üstte çevrimiçi sayısının yanında karakterin **X / Y** kare koordinatı yazar.
- **Damage meter** (sağ altta, Details! tarzı): modlar Damage Done, Healing Done, Damage Taken; her satırda toplam, saniyelik değer (DPS / HPS / DTPS) ve pay birlikte görünür. Savaşlar Current Segment, geçmiş savaşlar ve Overall olarak ayrılır. İskeletin hasarı sahibine sayılır. ⟲ ile sıfırlanır; Esc → Ayarlar → "Hasar ölçeri göster" ile açılıp kapanır.

### Yaratıklar ve seviye farkı

Kendinden **5 ya da daha çok seviye yüksek** bir oyuncuya yaratıklar saldırmaz; yakından geçerse yavaşça biraz geri çekilir (yuvasından fazla uzaklaşmadan). Saldırırsan karşılık verir. Boss'lar geri çekilmez.

### Ana Merkez (şehir)

Surlarla çevrili şehir; mob yok, PvP yok. Ortada çeşmeli meydan, kuzey caddesinde dükkânlar, güneyde pazar meydanı var.

| NPC | Satar / yapar |
| --- | --- |
| **Silahçı Kerem** | Demir Kılıç, Savaş Baltası, Çelik Kılıç, Meşe Asa, Dişbudak Asa |
| **Zırhçı Leyla** | Deri başlık/yelek/pantolon, Eski Çizme, Pullu Yelek, Demir Çizme |
| **Parşömenci Nuri** | Düşük Sınıf (30) ve Orta Sınıf (450) Yükseltme Parşömeni |
| **İksirci Zehra** | Can ve mana iksirleri |
| **Demirci Hasan** | Ekipman yükseltme (aşağıya bakın) |
| **Kuyumcu Selin** | Bakır ve gümüş yüzük, kolye, küpe |
| **Komutan Baran** (doğu kapısı) | Görevler |
| **Bilge Ozan** (çeşmenin batısı) | Görevler, hikaye |

- Her NPC'ye satış yapılabilir (dükkân açıkken envanterde sağ tık).
- Doğu kapısından çıkan yolun sonunda **ışınlanma kapısı** var: içine yürüyünce Başlangıç Vadisi'ne ışınlanırsın (E'ye basmana gerek yok). Vadideki kavşakta da şehre dönüş kapısı var.
- Kan Arenası portalı şehrin doğusunda, meydanın sağında.
- Şehirde ölünemez; vadide ölürsen şehir kapısının yanında doğarsın.

### Pazar (oyuncudan oyuncuya satış)

Knight Online tarzı tezgâh. Şehrin güneyindeki **tuğla döşeli pazar meydanına** gir, ekranda çıkan **Pazar Kur** düğmesine bas.

1. Tezgâha bir ad ver (boş bırakırsan "İsim'in Tezgâhı" olur).
2. Envanterde item'a sağ tıkla ya da pencereye sürükle (en fazla 8 item), her birine **birim fiyat** yaz.
3. **Pazarı Aç**: karakterin tentenin altına oturur, başının üstünde tezgâh adı görünür.

- Pazar açıkken yerinden kalkamaz ve envanterine dokunamazsın. Satılan her şey sohbete yazılır; her şey satılınca pazar kendiliğinden kapanır. Kapatmak için **Pazarım → Pazarı Kapat**.
- Başkasının tezgâhına bakmak için oyuncuya/tabelaya tıkla ya da yanındayken **E**'ye bas. Yığılan item'larda adet seçilir.
- Satışlar sunucuda kontrol edilir (mesafe, altın, yer, fiyat değişmiş mi) ve iki karakter **tek veritabanı işleminde** hemen kaydedilir; item kopyalanamaz ya da kaybolmaz. Tek parça item'lar (+N dahil) aynı kimlikle el değiştirir.
- Tezgâhlar birbirine çok yakın kurulamaz. Pazar ayarları `shared/src/constants.ts` içindedir, pazar kodu `server/src/game/market.ts`.

### Başlangıç Vadisi (av sahası)

Kavşağın (şehir kapısının olduğu yer) kuzeybatısında ve güneydoğusunda Balçıklar (Sv 1, pasif), kuzeydoğusunda Gri Kurtlar (Sv 3, agresif), güneybatısında Goblinler (Sv 5, agresif) var. Öldürülen mob'un yerinde bir sandık çıkar; ilk 30 saniye sadece öldüren oyuncu açabilir, sonra herkese açılır.

`npm run typecheck` komutu sunucu ve istemcinin tip kontrolünü yapar.

### Item basma (+N)

Demirciye konuş, ekipmanı envanterden sağ tıkla ya da yükseltme slotuna sürükle, **Yükselt**'e bas. Her deneme bir parşömen ve altın harcar.

| Hedef | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Şans | %100 | %95 | %90 | %80 | %70 | %55 | %40 | %30 | %20 | %10 |
| Parşömen | Düşük | Düşük | Düşük | Düşük | Orta | Orta | Orta | Yüksek | Yüksek | Yüksek |

- +1 ile +3 arası güvenlidir: başarısız olursa sadece seviye artmaz.
- +4 ve sonrasında başarısızlık item'ı **yakar**. **Koruma Tılsımı** işaretlenirse item yanmaz; tılsım sadece riskli denemelerde harcanır.
- Her +1, item'ın temel statlarına %10 (yukarı yuvarlanır) ve +1 ekler.
- +7 ve üstü başarılar tüm sunucuya duyurulur.
- Orta Sınıf parşömen Parşömenci'den pahalıya (450) alınabilir ya da mob'lardan düşer. Yüksek parşömen ve Koruma Tılsımı sadece mob'lardan düşer (en çok Goblinlerden).
- Oranlar ve ücretler `shared/src/data/upgrade.ts` içindedir.

### Goblin Mağarası (dungeon)

Başlangıç Vadisi'nde kavşaktan güneybatıya giden patikanın sonunda, Goblin bölgesinin içinde mağara girişi var (seviye 5+). Patika bir nehri **ahşap köprüyle** geçer; köprü tek geçittir. Mağaranın iki yanında meşaleler yanar. Girişin yanında **E**'ye bas: sana özel bir mağara kopyası (instance) açılır.

- Odalar: Mağara Balçıkları → Goblin kampı (Muhafızlar miğferli ve zincir zırhlı) → arena. Mağaradaki mob'lar yeniden doğmaz.
- **Boss: Goblin Şefi Grukk**
  - **Yer Sarsıntısı:** etrafında kırmızı bir daire dolar; dolduğunda içinde kalan büyük hasar alır, dışarı kaç.
  - **Öfke:** %50 canın altında kızarır ve hızlanır.
  - **Destek:** %75 ve %35 canda iki goblin çağırır.
- Ödüller: garantili Orta Sınıf parşömen ve iksirler; şansa bağlı Yüksek Sınıf parşömen, Koruma Tılsımı, **Grukk'un Baltası** (destansı) ve **Şef Miğferi** (nadir).
- Grukk ölünce arenada iki portal açılır: **Çıkış** ve turuncu **Jack'in Mahzeni**. Mahzene sadece Grukk'u kesen girebilir (sunucu bileti arena temizlenince verir).
- Çıkış portalları seni mağara kapısının önüne geri getirir. Mağaradayken bağlantın koparsa bir sonraki girişte de kapının önünde doğarsın.

#### Jack'in Mahzeni (2. boss)

**Kabak Jack** (Sv 10) iki yeteneği sırayla kullanır:
- **Zıplayarak Ezme:** senin durduğun yere kırmızı bir daire koyar, havalanır ve oraya iner. Daireden çık.
- **Kayarak Hücum:** önünde kırmızı bir şerit belirir, şerit boyunca hızla kayar ve yolundakileri vurur. Şeritten çık.
- %30 canın altında öfkelenir. Her zaman **+1 Kabak Jack'in Tırpanı** (efsanevi) düşürür.

Jack'in görselleri hazır bir sprite paketinden gelir (`client/src/assets/`, kaynakları `CREDITS.md` içinde); geri kalan her şey kodla çizilir.

### GM paneli

`http://localhost:5173/admin.html` (veya karakter seçim ekranındaki **GM Paneli** bağlantısı). Oyuncu ara, envanterini gör; item ver (adet ve +N ile), item sil, altın ekle/çıkar, seviye ayarla.

- Sadece GM yetkili hesaplar kullanabilir. Yetki vermek/almak için: `npm run make-admin -w server -- <kullanıcı-adı>` (almak için sonuna `--remove`).
- Oyuncu oyundaysa değişiklik anında oyuna yansır ve oyuncuya bildirim gider; değilse doğrudan veritabanına yazılır.
- Her işlem `admin_log` tablosuna kaydedilir (kim, kime, ne zaman, ne yaptı) ve panelde karakterin altında görünür.

## Yapı

```
shared/            Sunucu ve istemcinin ortak kodu
  src/data/        Oyun verisi: mob'lar + drop tabloları, skill'ler, item'lar, NPC'ler, level/hasar formülleri
server/
  scripts/dev-db   Geliştirme veritabanını başlatır
  src/db/          PostgreSQL: bağlantı, migration'lar, hesap/oturum/karakter sorguları
  src/http/        REST API: kayıt, giriş, karakter listeleme/oluşturma; admin.ts: GM API
  src/rooms/       ZoneRoom: her bölge (şehir, vadi, arena veya dungeon kopyası) bir oda; kimlik doğrular, mesajları
                   doğrular, Game'e iletir, karakteri kaydeder, portal geçişi için bilet verir
  src/game/        Oyun simülasyonu: Game (döngü), combat (skill/büyü/hasar/XP/ölüm), mobs (AI), boss (mekanikler), chat, spawns,
                   inventory (saf envanter işlemleri), items (kuşanma, loot, dükkân), upgrade (+N basma)
client/
  src/scenes/      WorldScene: state'i görüntüye bağlar, tahmin/düzeltme
  src/entities/    EntityView (çizim), SnapshotBuffer (interpolasyon)
  src/ui/          DOM arayüzü: karakter/hedef çerçevesi, hotbar, XP barı, envanter, dükkân, demirci, tooltip
  src/gfx/         Kodla çizilen pixel art: harita, karakterler, item ikonları
```

### Temel kurallar

- **Sunucu otoriterdir.** İstemci sadece "şu yöne basıyorum" bilgisini gönderir. Konum, hasar, drop ve item basma sonucu yalnızca sunucuda hesaplanır.
- **Ortak kod `shared/` içinde durur.** Hareket fonksiyonu (`stepMovement`) iki tarafta da aynıdır. İstemci bu sayede kendi hareketini anında tahmin eder (*client-side prediction*). Sunucudan cevap gelince henüz işlenmemiş girdileri yeniden oynatarak düzeltir (*reconciliation*).
- **Diğer oyuncular 100 ms geriden çizilir.** Bu gecikme *snapshot interpolation* içindir ve kayan, kesintisiz bir hareket sağlar.
- **Girdiler eylem katmanından geçer** (`client/src/input/InputManager.ts`). Oyun kodu tuşları değil eylemleri sorar. Mobil dokunmatik kontroller ileride aynı eylemlere bağlanacak.
- **Oyun mantığı odadan ayrıdır.** `Game` ağdan habersizdir, sadece `GameIO` üzerinden mesaj yollar. İleride her dungeon instance'ı kendi `Game`'ini çalıştırır.
- **Her bölge ayrı bir odadır.** Şehir, vadi ve PvP arenası ortaktır; dungeon'lar her girişte yeni bir oda (instance) olarak açılır. Şehir ve vadi "kalıcı" bölgelerdir: karakterin bölgesi ve konumu sadece orada kaydedilir ve girişte oraya bağlanırsın. Başka bölgelere portal bileti olmadan girilemez; bilet varış noktasını da taşıyabilir (ışınlanma kapıları). Portal kullanınca sunucu tek kullanımlık bir bilet verir, istemci mevcut odadan çıkıp hedef odaya o biletle girer. Dungeon'lara biletsiz girilemez. Haritalar ve dungeon yerleşimleri `shared/src/zones.ts`, `shared/src/town.ts` ve `shared/src/dungeons.ts` içindedir. Şehrin binaları, çeşmesi ve fenerleri harita üstüne kodla çizilen dekordur (`client/src/gfx/decor.ts`); altlarındaki kareler çarpışma için `Tile.Solid`'dir.
- **Kalıcılık oda katmanındadır.** Karakter girişte veritabanından yüklenir; çıkışta ve her 30 saniyede bir kaydedilir. Şifreler bcrypt ile, oturum token'ları SHA-256 hash'i olarak saklanır.
- **Item'lar tekil kayıtlardır** (`uid`, `defId`, `qty`, `enhance`). Item'ın tüm özellikleri `shared/src/data/items.ts` içindeki tanımdan gelir; kayıt sadece hangi item olduğunu ve +N seviyesini tutar. Envanter sadece sahibine mesajla gönderilir, diğer oyunculara senkronize edilmez.
- **Şema değişiklikleri `server/src/db/migrations.ts` içindedir.** Çalışmış bir migration düzenlenmez, yenisi eklenir.
- **Mob AI basit bir durum makinesidir** (idle → chase → return). Kime saldıracağını threat tablosu belirler; parti tank mekaniği bunun üzerine kurulacak. Leash mesafesini aşan mob canı dolu şekilde evine döner.
- **Sunucu 20 tick/sn hızında, gerçek zamana göre çalışır.** Zamanlayıcı gecikirse (Windows'ta 50 ms'lik aralık ~60 ms sürer) birikmiş süre kadar tick çalıştırılır; böylece oyun saati istemcilerden geri kalmaz.
- **Hız hilesi koruması:** oyuncu tick başına en fazla bir girdi harcayabilir (kısa süreli 3'lük birikim payı var), bu yüzden hızlı paket göndermek hız kazandırmaz.

## Yol haritası

| Faz | İçerik | Durum |
| --- | --- | --- |
| 0 | İskelet: harita, hareket, birbirini görme | ✅ |
| 1a | Savaşçı, mob AI + threat, hedefleme, skill/cooldown/GCD, öfke, XP/level, ölüm | ✅ |
| 1b | PostgreSQL, hesap/giriş, karakter seçimi, karakterin kaydedilmesi | ✅ |
| 2 | Loot, gold, grid envanter, ekipman slotları, NPC dükkânı, iksirler | ✅ |
| 3 | Item basma (+N, başarı/yanma şansı), parşömenler, Koruma Tılsımı, demirci | ✅ |
| 4 | Tek kişilik dungeon (instance), Goblin Mağarası, boss mekanikleri | ✅ |
| 5 | Büyücü ve Şifacı sınıfları, büyü süresi, görüş hattı, sohbet | ✅ |
| 6 | PvP: Kan Arenası, PvP puanı ve sıralama, doğma koruması | ✅ |
| 7 | Grup sistemi: davet, grup çerçeveleri, ortak XP/ganimet, tehdit rolleri, grup zindanları | ✅ |
| 7.5 | Ana Merkez (şehir, dükkânlar, çeşme), oyuncu pazarı, ışınlanma kapıları, kayıtlı bölge | ✅ |
| 7.6 | Hikaye, görev zincirleri, Kara Orman (Sv 10-20) ve saha boss'u, takı slotları, 88 yeni item | ✅ |
| 7.7 | Gece/gündüz döngüsü, gece yaratıkları, PoE tarzı rastgele item statları | ✅ |
| 7.8 | Nekromant sınıfı, mücevherli pasif ağaç, Güç/Çeviklik/Zeka/Dayanıklılık, seviye farkında yaratıkların çekinmesi | ✅ |
| 8 | Optimizasyon, anti-cheat, yedekleme, alfa testi | ⏳ |

Faz 2 bitince oyun oynanabilir hale gelir. Sonraki fazlar bunun üzerine eklenir.

## Teknoloji

- İstemci: TypeScript, Phaser 3, Vite
- Sunucu: Node.js, TypeScript, Colyseus 0.16
- Veritabanı (Faz 1'den itibaren): PostgreSQL
- Haritalar: şimdilik kodla üretiliyor (`shared/src/map.ts`), ileride Tiled editörüne geçilecek
