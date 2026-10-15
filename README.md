# Albasan Online

Tarayıcıda çalışan, 2D pixel art bir online MMORPG. Savaş ve içerik yapısı WoW'dan, item basma (+N) sistemi Knight Online'dan esinleniyor.

Oyun istemcisi **Godot 4.7** ile yazılmıştır (`yeni-oyun-projesi/`, ayrıntılar onun README'sinde); web build'i https://albasanonline.com adresinde telefon ve bilgisayarda oynanır. Eski Phaser web istemcisi kaldırıldı; `client/` artık yalnızca GM paneli, harita editörü ve Godot görsellerini üreten **bake** için çizim kodunu içerir.

## Çalıştırma

```bash
npm install
npm run dev
```

Durdurmak için: `npm run dev`'i çalıştırdığın terminalde **Ctrl+C**, ya da herhangi bir terminalden `npm run stop`. `npm run stop` veritabanını düzgünce kapatır ve Windows'ta arkada asılı kalmış eski süreçleri de temizler; bir şey "port kullanımda" hatası verirse önce onu çalıştır.

`npm run dev` üç süreç başlatır:

- **db**: geliştirme için gömülü PostgreSQL 17, port 5433. Kurulum gerektirmez; programı `embedded-postgres` npm paketinden gelir. Veriler kalıcıdır.
- **server**: oyun sunucusu ve REST API, http://localhost:2567
- **client**: GM paneli ve harita editörü, http://localhost:5173/admin.html

Oyunu Godot ile aç (`yeni-oyun-projesi/README.md`) ve yerel sunucuya bağla. Kayıt olun, bir karakter oluşturun ve oyuna girin. Yeni karakterler **Ana Merkez**'de (şehir) başlar; çıkış yaptığın bölgeye (şehir ya da Başlangıç Vadisi) geri girersin. Çok oyunculu test için ikinci bir hesap açıp başka bir sekmeden girin. Aynı karakterle ikinci kez girilirse eski bağlantı atılır.

> **Windows notu:** PostgreSQL, yolunda ASCII dışı karakter olan klasörlerde (ör. `Masaüstü`) çalışamıyor. Proje böyle bir klasördeyse PostgreSQL programı ve veriler `%LOCALAPPDATA%\mmo-creation` altında tutulur. Veritabanını sıfırlamak için `npm run dev` kapalıyken o klasördeki `data` klasörünü silin. Yayında `DATABASE_URL` ile gerçek bir PostgreSQL kullanılır.

### Karakter seçme ve yaratma

Giriş yapınca **Ana Merkez'in iç kalesinin önüne** gelirsin (Metin2 tarzı): karakterlerin (en fazla 3) avluda yan yana, giydikleri zırh ve silahlarıyla durur. Birine **tıklayınca seçilir**: ayağının altında altın halka belirir ve kendi etrafında döner, diğerleri gölgede kalır. Soldaki panelde ismi, sınıfı, seviyesi, en son bulunduğu bölge ve **oyun süresi** yazar.

- **Başla** (ya da Enter): seçili karakterle oyuna gir.
- **Yeni Karakter** ya da avludaki **Boş** yere tıkla: karakter yaratma ekranı. Hiç karakteri olmayan hesap doğrudan buraya gelir.
- **Sil**: karakteri kalıcı olarak siler; onay için adını yazman gerekir. Oyundaki bir karakter silinemez.

**Karakter yaratma:** ortada karakterin büyük haliyle döner (⟲ ⟳ ile elle de çevrilir); soldan seçilir:

| Seçenek | Seçenekler |
| --- | --- |
| Cinsiyet | Erkek, Kadın (kadın karakterde ince bel ve dudak) |
| Saç modeli | Kısa, Diken, Uzun, At Kuyruğu, Topuz, Kel |
| Saç rengi | 10 renk |
| Ten rengi | 7 ton |
| Kıyafet rengi | 10 renk |

**Rastgele** hepsini rastgele seçer. Görünüm oyunda herkese aynı görünür (senkronize). Miğfer saçı, Şaman şapkası ve kapüşonlar saçın üstünü örter; uzun saç ve at kuyruğu arkadan ve yandan görünür. Veriler `characters.look` (JSON) ve `characters.play_seconds` sütunlarında; seçenekler `shared/src/data/appearance.ts`, piksel şablonları `client/src/gfx/humanoid.ts`, lobi sahnesi `yeni-oyun-projesi/scripts/lobby/lobby.gd`.

### Sınıflar

Karakter oluştururken sınıf **seçilmez**: herkes **Acemi** başlar (yeteneği yok, paslı kılıçla idare eder). Komutan Baran'ın ilk görevi **Ustaların Ateşi** seni İç Kale'nin büyük salonuna gönderir; ateşin başında oturan yedi ustadan birine konuşup **Yolunu seç**'e basarsın. Hemen seçmez: "Emin misin?" sayfası açılır, **Eminim, seç** ile kesinleşir. Sonra Komutan'a dönünce görev biter, ödülü sınıfına göre başlangıç silahıdır (yay ya da asa).

| Usta | Sınıf | Kaynak | 1 | 2 | 3 |
| --- | --- | --- | --- | --- | --- |
| **Alp** | **Savaşçı** (yakın dövüş, tank) | Öfke: vurdukça ve hasar aldıkça dolar | Ağır Darbe | Girdap (çevreye) | İkinci Nefes (can) |
| **Kam** | **Şaman** (gök ve ruhlar) | Mana | Gök Kamçısı (1,3 sn büyü) | Gök Davulu (çevreye) | Ata Ruhu (iyileştirir) |
| **Börü** | **Suikastçı** (hızlı yakın dövüş) | Enerji (hızla dolar) | Sinsi Darbe | Bıçak Yelpazesi (çevreye) | İç Parçalama (ağır son vuruş) |
| **Tigin** | **Okçu** (yay ve ok) | Enerji | Nişanlı Atış (1 sn nişan) | Ok Yağmuru (hedefin çevresine) | Seri Atış (anında) |
| **Erşek** | **Druid** (orman ve hayvanlar) | Mana | Diken Kırbacı (1,2 sn büyü) | Sarmaşık (çevredekileri köklere bağlar) | Yaprak Şifası (iyileştirir) |
| **Ak Ana** | **Şifacı** (arındırma ve kutsama) | Mana | Kutsal Işık (1,2 sn büyü) | Şifa (hedef oyuncu ya da kendin) | Koruyucu Kalkan (hasar emer) |
| **Erlik Ruh Eğitmeni** | **Nekromant** (çağırıcı) | Mana | Ruh Emme (hasarın %40'ı kadar can emer) | Kemik Patlaması (çevreye) | İskelet Çağır (25 sn) |

- **Yolu sıfırlamak:** Ayşe Teyze'de **Yolumu sıfırla** (seviye × 100 altın), yine "emin misin?" sorulur. Yeniden Acemi olursun; seviye ve eşyalar kalır, yalnızca o sınıfa ait giydiklerin çantaya döner (yer yoksa önce yer açman istenir). Sonra kaleye dönüp yeni bir usta seçersin.
- Büyücü ve Muhafız sınıfları kaldırıldı; o sınıftaki karakterler Acemi oldu (migration 14) ve kaleden yeniden seçer.
- Nekromant ve Druid görevlerde Şaman'ın sınıf ödüllerini (asa, cübbe), Suikastçı ve Okçu Savaşçı'nın zırh ödüllerini alır; Okçu silah ödülü olarak yay alır. İskelet sahibinin saldırdığı hedefe, yoksa sahibine saldıran yaratığa vurur; yaratıklar iskelete saldırmaz.
- Tabloda her sınıfın ilk üç skill'i var; tam liste aşağıda **Yetenekler** bölümünde.
- Büyü süresi olan skill'lerde büyü barı dolar; **yürürsen büyü iptal olur**.
- Uzak saldırılar ağaç ve duvarların arkasına yapılamaz (görüş hattı).
- Başka bir oyuncuya tıklamak onu dost hedef yapar (Şifa ve Kalkan için).
- Kılıç, balta ve tırpanları Savaşçı, Suikastçı ve Acemi; yayları Okçu; asaları Şaman, Druid, Şifacı ve Nekromant; plaka zırhı Savaşçı, Suikastçı ve Okçu; cübbeleri büyü kullananlar kuşanır.
- Sınıf verileri `shared/src/data/classes.ts`, skill'ler `shared/src/data/skills.ts` içindedir.

### Grup (parti)

En fazla 5 kişi. Bir oyuncuya tıklayıp hedef çerçevesindeki **Gruba davet et**'e bas ya da sohbete `/davet İsim` yaz; karşı tarafa Kabul/Reddet kutusu çıkar.

- Komutlar: `/p mesaj` grup sohbeti, `/ayril` gruptan çık, `/at İsim` (lider) gruptan at. Lider ayrılırsa liderlik sıradakine geçer.
- Sol taraftaki grup çerçeveleri üyelerin can/mana/bölgesini gösterir; tıklayınca (aynı bölgedeyse) hedef alınır.
- **XP:** kesilen mob'un XP'si yakındaki grup üyeleri arasında bölüşülür, kişi başı %20 grup bonusuyla.
- **Ganimet:** grubun kestiği mob'un sandığını tüm grup açabilir.
- **Roller:** Savaşçı 2 kat tehdit üretir (tank), iyileştirme de tehdit üretir. Mob hedef alınınca can barında kime saldırdığı görünür ("→ İsim").
- **Grup zindanı:** gruptan biri bir zindan kapısından girince, aynı bölgede kapıya 15 kareden yakın duran grup arkadaşlarına **"… zindanına girdi. Sen de grubunla girmek ister misin?"** kutusu çıkar (30 sn). **Katıl**'a basan kapıya yürümeden aynı kopyaya ışınlanır. Seviyesi yetmeyene sadece haber verilir. Kutuyu kaçıran ya da uzakta olan, aynı kapıdan girince yine aynı kopyaya düşer. Zindanın içinde (ör. Grukk'tan sonra Jack'in Mahzeni'ne geçerken) de aynısı olur.
- Zindanın içindeyken grup kurulursa o kopya grubun olur; arkadaşların da girebilir. Gruba ait olmayan biri o kopyaya giremez. Her ek oyuncu için boss'ların canı %60 artar.
- **Gruptan çıkan zindandan atılır:** grubun zindan kopyasındayken gruptan ayrılan ya da lider tarafından atılan oyuncu zindan çıkışından dışarı, girişin önüne gönderilir. Gitmezse 8 saniye sonra bağlantısı kesilir. Kalanlar zindanda devam eder (iki kişilik grupta biri ayrılıp grup dağılırsa, kalan oyuncu zindanda kalır).
- **Arenada** grup arkadaşları düşman değildir; birbirinizi iyileştirebilirsiniz.

Gruplar sunucu belleğinde tutulur: sunucu yeniden başlarsa dağılır.

### Düello

Yanındaki bir oyuncuya tıklayıp hedef çerçevesindeki **Düello**'ya bas ya da sohbete `/duello İsim` yaz (en fazla 6 kare uzaktaki oyuncuya). Karşı taraf kabul edince 3 saniyelik geri sayımdan sonra ikiniz birbirinize düşman olursunuz; başkaları etkilenmez.

- Kimse ölmez: kaybedenin canı 1'de kalır ve kazanan herkese duyurulur. PvP puanı, ganimet ya da XP değişmez.
- 2 dakikada biten olmazsa berabere; 25 kareden fazla uzaklaşırsanız düello iptal olur. Bölgeden çıkan ya da oyundan ayrılan kaybeder.
- Kan Arenası'nda düello yoktur (orada zaten herkes düşman). Grup arkadaşınla da düello yapabilirsin.

### Kan Arenası (PvP)

Ana Merkez'deki kırmızı portaldan (seviye 5+) girilen, herkesin herkese saldırabildiği ortak arena. Bir **kolezyum**: oval kum arena, etrafında kırmızı mermer podyum duvarı ve meşaleler; yedi sıra taş tribünde tezahürat yapan seyirciler, merdiven koridorları ve tünel ağızları; kuzeyde tenteli **imparator locası** (altın taht), dış duvarda kırmızı bayraklar, güneyde iki katlı kemerli cephe. Arenadaki dört mermer sütun ve ortadaki dikilitaş görüş hattını keser (siper). Dört kapının ağzından rastgele birinde doğarsın; çıkış güney kapısında. Harita ve çizim aynı halkalardan üretilir (`COLOSSEUM`, `shared/src/dungeons.ts`; çizim `client/src/gfx/decor.ts`).

- Arenada diğer oyuncular düşmandır: kırmızı isim, tıkla ya da Tab ile hedef al. Skill'ler, otomatik saldırı, Girdap ve Buz Halkası oyunculara da işler.
- Oyuncuya verilen hasar %50'dir (skill'ler mob'lara göre ayarlı). Buz Halkası oyuncuları yarı süre (2 sn) dondurur.
- Doğunca 5 sn koruma (yarı saydam): oyuncular sana vuramaz; sen saldırınca koruma biter.
- Ölünce XP kaybı yok, arenada rastgele bir köşede yeniden doğarsın.
- **PvP puanı:** Elo benzeri, 1000'den başlar; güçlü birini yenmek daha çok kazandırır. Aynı kişiyi 2 dakika içinde tekrar öldürmek puan getirmez.
- **L**: sıralama tablosu (çevrimiçi oyuncuların değerleri canlı). 5, 10, … seri öldürmeler tüm sunucuya duyurulur.
- **Arenanın kralı:** arenada bulunanlar arasında PvP puanı en yüksek olanın (eşitlikte öldürmesi çok olanın) başında **parlayan altın bir taç** durur; puanlar değiştikçe taç el değiştirir. Hiç dövüşmemiş (puanı başlangıçta olan) oyuncular sayılmaz.

### Sohbet

**Enter** ile yaz, **Enter** ile gönder, **Esc** ile vazgeç. Mesajlar tüm sunucuya (mağaradakiler dahil) gider; aynı bölgedekiler karakterinin üstünde konuşma balonu da görür.

- Fısıltı: `/f İsim mesaj` (sohbetteki bir isme tıklamak fısıltıyı başlatır).
- GM hesaplarının isminin üstünde kırmızı parıltılı, zıplayan bir **GM** yazısı durur (herkes görür).
- GM mesajları [GM] etiketiyle görünür; +7 ve üstü item basmaları sistem mesajı olarak düşer.
- Flood koruması: 5 saniyede en fazla 5 mesaj.

### Kontroller

Tuşlar **Esc → Menü → Tuş Atamaları** sayfasından değiştirilebilir: 10 skill slotu, 2 iksir slotu, hareket, saldırı, etkileşim, şehir portalı ve pencereler. Bir eyleme tıkla, istediğin tuşa bas (ör. dash'in olduğu slota **Space**). Tuş başka bir eylemdeyse oradan alınır; Esc (menü) ve Enter (sohbet) değiştirilemez. Atamalar hemen geçerli olur, hotbar'daki tuş etiketleri de değişir; bu tarayıcıda saklanır, "Varsayılana dön" ile sıfırlanır. Aşağıdaki tablo varsayılan tuşlardır.

| Tuş | Eylem |
| --- | --- |
| WASD / oklar | Yürü |
| Mob'a tıkla | Hedef al ve saldır |
| Tab | Sıradaki yakın mob'u hedef al |
| F | Seçili hedefe saldır |
| 1 - 9, 0 | Hotbar (10 skill slotu) |
| Q / R | İksir slotları |
| Sol tık | Yaratık: hedef al ve saldır · Sandık / NPC / portal / tezgâh: yürü ve etkileş |
| Enter | Sohbet |
| J | Görev günlüğü |
| K | Yetenekler (puan ver / geri al) |
| P | Pasif ağaç |
| T | Şehir portalı (bulunduğun yerde açılır) |
| H | Ata bin / attan in (sağ alttaki at düğmesi de aynısını yapar) |
| L | PvP sıralaması |
| M | Büyük harita aç/kapat (bütün bölge; mini haritaya tıklamak da açar). Mini harita sağ üstte hep açık: çevrendeki 10 kare, sen ortada; sarı sen, yeşil grup arkadaşların, beyaz diğer oyuncular, mavi NPC, mor portal. Muhafızın tarif ettiği yer, grup arkadaşların ve pingler görünüm dışındaysa kenarda o yöne bakan bir üçgen çıkar |
| /davet İsim, /p, /ayril | Grup |
| /duello İsim | Yanındaki oyuncuyu düelloya davet et |
| /takas İsim | Yanındaki oyuncuya takas teklif et (ya da hedef çerçevesindeki **Takas**) |
| I veya C | Karakter ve envanter penceresi |
| E | Yakındaki sandığı aç / NPC ile konuş / portal / tezgâha bak |
| Sağ tık (envanterde) | Kuşan, kullan; dükkân açıkken sat |
| Sürükle-bırak | Item'ı taşı, kuşan, çıkar; envanterden pencere dışına bırak: yere at, **Çöp** slotuna bırak: yok et (ikisi de onay sorar; görev eşyası yere atılamaz). Seviyesi yetmeyen item kırmızı görünür |
| Esc | Açık pencereyi kapat, yoksa hedefi bırak, yoksa **menü** (ayarlar, kontroller, karakter değiştir, çıkış) |

### Mobil (telefon / tablet)

Dokunmatik cihazlarda ekrana kontroller gelir (web build'de adrese `?touch=1` ekleyerek ya da Godot'u `--touch` argümanıyla çalıştırarak bilgisayarda denenebilir):

- Sol altta **joystick**: yürü (8 yön).
- Sağ altta **Saldır** (F), **Hedef** (Tab), **E** (konuş / al / portal / tezgâh).
- Üstte **Çanta**, **Görev**, **Pasif**, **Portal**, **At**, **Yetenek**, **Sohbet**, **Menü**.
- Mob'a, NPC'ye, portala ve hotbar slotlarına dokunmak doğrudan çalışır.
- Envanterde bir item'a bir kez dokun: bilgisi çıkar; tekrar dokun: kullan/kuşan (bilgisayardaki sağ tık).

Dokunmatik kontroller `yeni-oyun-projesi/scripts/ui/touch_controls.gd` ve `hud.gd` içindedir; tuşlarla aynı eylemleri tetikler (`World.do_action`).

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
- Başlıklar, isimler ve düğmeler **Cloister Black** ile yazılır (`client/src/assets/licensed/fonts/`, Türkçe harfler eklenmiş kopya; depoda yok, yoksa serif kullanılır); uzun metinler okunaklı bir serif fontla. Pencere yönetimi `yeni-oyun-projesi/scripts/ui/game_window.gd`, tema `yeni-oyun-projesi/scripts/ui/ui_theme.gd`'dedir.

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
| Akşam Yemeği | 3+ | **Ayşe Teyze** (meydanın güneydoğusundaki evinin önü): 5 Kurt Eti + 3 Balçık Jölesi topla, güveci Komutan Baran'a ve Bilge Ozan'a götür; sonra her akşam tekrarlanabilir. Ödül: Ayşe Teyze'nin Güveci (150 can, iksirlerden ayrı bekleme süresi). Metin2'nin meşhur akşam yemeği görevine selam. |

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
| Doğu, **Satir Korusu** | Satir Savaşçı, Satir Mızrakçı | 12-13 |
| Satir Korusu'nun ortası | **Satir Reisi** (elit) | 15 |
| Bataklığın güneyindeki açıklık | **Yosun Golemi** (elit) | 17 |
| Doğu, ayı ini | Boz Ayı (elit) | 18 |
| Haydut kampının kuzeyi | **Haydut Reisi Kara Murat** (saha boss'u, 5 dk'da yeniden doğar) | 20 |

Kara Murat yere vurur (kızıl halka), önündeki şeritte koşar ve %60/%30 canda haydut çağırır. Her zaman Mühür Parçası düşürür; Kabak Jack de öyle.

### Canavar çizimleri ve canavar silahları

Satirlar, golemler, minotorlar ve hortlaklar gerçek sprite çizimleriyle (CraftPix "tiny style" paketleri) oynar: bekler, yürür, saldırırken silahını savurur, vurulunca sarsılır, ölünce yere yığılır.

| Mob | Yer | Çizim |
| --- | --- | --- |
| Satir Savaşçı / Mızrakçı / Reisi, Yosun Golemi | Kara Orman | Satir 1-3, toprak golem |
| Gece Hortlağı | Kara Orman (gece) | turkuaz hortlak |
| Minotor Gözcü (eski Kobold Gözcü), **Ustabaşı Dorak**, **Maden Kralı Gırtlak** | Terk Edilmiş Maden | minotorlar |
| **Kristal Golem** | Terk Edilmiş Maden | taş golem, kristal mavisi |
| Boğulmuş Rahip, **Taş Muhafız** | Batık Tapınak | kapüşonlu hortlak, yosunlu golem |
| Mezar Hortlağı, **Lich Azgor** | Kemik Mahzeni | mor hortlak (Lich büyük) |
| **Lav Devi** | Ejder İni | toprak golem, ateş renginde |

Yeni silahlar bu canavarların kendi silahları; envanterde ve karakterin elinde kendi çizimleriyle görünür:

| Silah | Sv | Kimden düşer |
| --- | --- | --- |
| Minotor Gürzü (Şifacı) | 10 | Ustabaşı Dorak (%25) |
| Minotor Sopası | 11 | Minotor Gözcü (%2) |
| Taş Kılıç | 11 | Kristal Golem (%25) |
| Satir Sopası | 12 | Satir Savaşçı (%1,2) |
| Maden Kralı'nın Çekici (destansı) | 12 | Maden Kralı Gırtlak (%20) |
| Satir Mızrağı | 13 | Satir Mızrakçı (%1,2) |
| Golem Baltası | 13 | Taş Muhafız (%25) |
| Satir Reisi'nin Baltası | 15 | Satir Reisi (%6) |
| Kütük Gürz | 17 | Yosun Golemi (%4) |

Yeni malzemeler: Satir Boynuzu, Golem Çekirdeği (tüccara satılır).

**Çizimleri yeniden üretmek / yeni paket eklemek:** `pip install pillow`, sonra `python tools/build_sprites.py "C:/Users/<sen>/Downloads"`. Araç paketlerin PNG karelerini ortak bir kutuya kırpar, oyun boyutuna küçültür, kenarları piksel-art gibi keskinleştirir ve `client/src/assets/licensed/mobs/<ad>.png/.json` (sprite sheet + ayak noktası + animasyon kareleri) ile `client/src/assets/licensed/items/<ad>.png` (36 px ikon, `_held` el çizimi, `items.json` tutma noktası) üretir. Yeni bir sheet otomatik yüklenir; bir moba `appearance: { type: "image", key: "<ad>" }` (isteğe bağlı `tint`), bir item'a `image: "<ad>"` vermek yeterli. Lisans notu `client/src/assets/CREDITS.md` içinde.

### Item'lar

Knight Online ve Metin2'den esinlenen 88 yeni item (Sv 3-22), çoğu `shared/src/data/gear.ts` içinde formülle üretilir:

- **Yeni slotlar:** Kolye (can), Yüzük (saldırı), Küpe (savunma). Her biri 5 kademe: Bakır → Gümüş/İnci → Yakut/Altın/Zümrüt → Ejder Gözü/Safir/Ay Taşı → Mühürlü Kolye, Kudret Yüzüğü, Kızıl Ejder Küpesi. Bakır ve gümüş takılar **Kuyumcu Selin**'de (demircinin altında) satılır.
- **Silah serileri** (her biri 5 kademe, Sv 9-22): Savaşçı kılıçları (Hilal → Dolunay → Zehirli → Aslan → Ejderha), Savaşçı baltaları (Kemik → Savaş Teberi → Kara Ay → Gök Gürültüsü → Kızıl Ejder Teberi), Şaman/Druid/Nekromant asaları (Kristal → Ateş → Buzul → Yıldırım → Anka), **Okçu yayları** (Boynuz → Bozkır → Akdoğan → Gökkuşağı → Tigin'in Yayı), **Şifacı topuzları** (Kutsal → Şafak → Güneş → Melek → Nur).
- **Sınıf zırh setleri** (baş, gövde, bacak, ayak; 5 kademe, Sv 8-20): Savaşçı/Suikastçı/Okçu plakaları (Tunç, Demir Pul, Kara Çelik, Kartal, Ejder Pulu) ve büyücü sınıfların cübbeleri (Çırak, Bilgin, Mistik, Yıldız, Kadim; daha az savunma, artı büyü gücü).
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

### Yetenekler (K)

Her sınıfın kendine has en az bir **tek hedef**, bir **alan (AoE)**, bir **kitle kontrol (CC)**, bir **atılma (dash)** ve bir **bekleme süreli güçlendirme (buff)** skill'i vardır. Skill'ler seviye geldikçe öğrenilebilir olur (aşağıda Sv).

| Sınıf | Tek hedef | Alan | CC | Atılma | Buff | Diğer |
| --- | --- | --- | --- | --- | --- | --- |
| Savaşçı | Ağır Darbe (1) | Girdap (2) | Sarsıcı Darbe, 2 sn sersemletme (4) | **Sıçrayış**: hedefe sıçrar, inişte çevreye vurur (6) | Savaş Çığlığı, +%25 saldırı (8) | İkinci Nefes (3) |
| Şaman | Gök Kamçısı (1) | Gök Davulu (2) | Ruh Bağı, 3 sn (4) | **Yel Yürüyüşü**: 6 kare (6) | Tengri'nin Lütfu: grup +%15 güç ve hız (8) | Ata Ruhu (3) |
| Suikastçı | Sinsi Darbe (1), İç Parçalama (3) | Bıçak Yelpazesi (2) | Kör Edici Toz, 3 sn (4) | **Gölge Adımı**: hedefin arkasında belirir (6) | Adrenalin: %40 hızlı saldırı (8) | |
| Okçu | Nişanlı Atış (1), Seri Atış (3) | Ok Yağmuru (2) | Çivileyen Ok, 2,5 sn (4) | **Doğan Sıçrayışı**: 5 kare (6) | Kartal Gözü: +%20 güç ve hız (8) | |
| Druid | Diken Kırbacı (1) | Bahar Dalgası: vurur + grubu iyileştirir (8) | Sarmaşık: çevreyi 3,5 sn köklere bağlar (2) | **Bozkurt Hücumu**: hedefe atılır, 1,5 sn sersemletir (6) | Ağaç Kabuğu: %35 az hasar (4) | Yaprak Şifası (3) |
| Şifacı | Kutsal Işık (1) | Kutsal Nova: vurur + grubu iyileştirir (4) | Kutsal Zincir, 3 sn (5) | **Işık Adımı**: süzülür + kalkan (6) | Kutsal Ruh: grup +%15 (8) | Şifa (2), Koruyucu Kalkan (3) |
| Nekromant | Ruh Emme (1) | Kemik Patlaması (2) | Dehşet, 3 sn (4) | **Ruh Göçü**: gölgeden geçer + can (6) | Karanlık Pakt: %10 can → +%35 hasar (8) | İskelet Çağır (3) |

- **Sersemletme:** hedef ne yürüyebilir ne vurabilir (sarı görünür). Boss'lar etkilenmez; oyunculara (PvP) yarı süre.
- **Yetenek puanı:** her seviye 1 puan (toplam seviye + 1). **K** ile açılan **Yetenekler** sayfasında aktif skill'lere (en çok 5 derece; derece 1 öğretir, sonraki her derece etkisini %12 artırır) ve sınıfın 3 **pasif** yeteneğine (5'er derece) puan verilir; **−** ile tek tek geri alınır. Yeni karakterler ve eski karakterler, açık olan her skill'de 1 dereceyle başlar.
- **Hotbar 10 slot** (1-9, 0), sadece skill'ler: başta sınıfın skill'leri sırayla. Yetenekler sayfasından bir skill ikonunu istediğin slota **sürükle**, slotlar arasında sürükleyerek yer değiştir, **sağ tıkla** slotu boşalt. Düzen her karakter için bu tarayıcıda saklanır. İksirler envanterden (sağ tık) içilir. Puan verilmemiş skill gri görünür.
- **Serbest atılmalar** (Yel Yürüyüşü, Doğan Sıçrayışı, Ruh Göçü, Işık Adımı) **farenin olduğu yere doğru** gider (en çok skill'in mesafesi kadar; fare daha yakındaysa orada durur), karakter oraya kısa bir süzülmeyle geçer. Telefonda baktığın yöne gider.
- Her skill'in ne yaptığını anlatan kodla çizilmiş bir **ikonu** var (`client/src/gfx/skillIcons.ts`). Hotbar'da ya da Yetenekler sayfasında üzerine gelince ayrıntılı bir panel açılır: bedel, büyü süresi, bekleme, menzil, karakterin şu anki gücüyle hesaplanmış hasar / iyileştirme / süre değerleri, derece ve sonraki derecenin getirisi.
- Kurallar `shared/src/data/skills.ts` ve `shared/src/data/talents.ts`, sunucu tarafı `server/src/game/talents.ts`; dereceler `characters.skill_ranks` kolonunda saklanır.

### Sol tık ile etkileşim

Sandığa, NPC'ye, portala, şehir portalına ya da tezgâha **sol tıklayınca** karakter oraya yürür ve varınca etkileşir (eşyayı alır, konuşur, portala girer). Yakın dövüş sınıfları tıkladıkları yaratığa da yürür. Bir tuşa basmak yürümeyi iptal eder; duvara takılırsa "Oraya yol yok" der. **E** tuşu da çalışmaya devam eder.

İmleç oyunun kendi orta çağ çizimidir (`client/src/gfx/cursors.ts`): normalde demir ve altın işlemeli bir ok, tıklanabilir arayüzde işaret eden zırhlı eldiven; üzerine gelinen şeye göre şekil değiştirir: düşman (yaratık, PvP/düello rakibi) üzerinde **kılıç**, ganimet üzerinde **altın paraları kavrayan eldiven**, NPC üzerinde **mühürlü parşömen**, portal üzerinde **rünlü taş halka**, pazar tezgâhı üzerinde **terazi**.

### Can ve kaynak küreleri

Ekranın sol altında **can**, sağ altında **öfke / mana / enerji** küresi durur: pencerelerle aynı ahşap ve altından süslü çerçeveli cam küreler (arkada ahşap plaka ve kıvrık altın kanat, önde perçinli altın halka, tepede taş, altta değerin yazdığı kaide; `client/src/ui/globeFrame.ts`); içlerindeki sıvı yeni değere yumuşakça iner-çıkar ve yüzeyi sürekli dalgalanır. Can %35'in altındayken kırmızı sıvı kararıp atar; o sırada bir boss yeteneği ekranı sallarsa sıvı çalkalanır. Rahip kalkanı can küresinin etrafında mavi bir parıltı olarak görünür.

- **İksir slotları:** can küresinin sağında 2 slot (**Q** ve **R**, ya da tıkla). Varsayılan olarak sınıfın iksirleri; envanterden bir iksiri ya da yemeği slota sürükleyerek değiştirilir, sağ tık boşaltır. Adet ve bekleme süresi slotta görünür.
- **Buff / debuff çubuğu:** hotbar'ın hemen üstünde, solda üzerindeki güçlendirmeler (buff skill'leri, Kalkan Duvarı, Koruyucu Kalkan, doğuş koruması, iyi fal), sağda zayıflatmalar (sersemleme, donma). Kalan süre ikonun üstünde geri sayar; üzerine gelince ne olduğu yazar.

### Meslekler: Madencilik ve Botanik

Şehirdeki **Zanaatkâr Murat** (kuyumcunun yanında) meslekleri öğretir: ilk görevi **Madenci Kazması** ile **Bitki Orağı** verir (dükkânından da alınır). Alet envanterde durduğu sürece vadide ve Kara Orman'da **maden damarlarına** ve **bitkilere** tıklayınca karakter yanına yürür ve 2,2 sn toplar (kazma / orak imleci çıkar; yürümek ya da hasar almak toplamayı bozar). Her toplama meslek XP'si verir; seviye yükseldikçe daha zor damarlar açılır ve bazen fazladan çıkar. Toplanan damar bir süre sonra aynı yerde yeniden belirir.

| Meslek | Sv 1 | Sv 12 | Sv 25 | Sv 40 |
| --- | --- | --- | --- | --- |
| Madencilik | Bakır (vadi) | Demir (goblinler, haydut kampı) | Gümüş (ork oyuğu, kurtlar) | Mithril (ayı ini) |
| Botanik | Şifalı Ot (vadi) | Lavanta (kurtlar) | Gece Sefası (bataklık, **sadece gece**) | Ejder Dikeni (mezarlık) |

Zanaatkâr'ın "Meslekler" görev zinciri her cevher ve bitki için bir görev verir (ödül: altın, XP, parşömen, yüzük, Koruma Tılsımı); "Zanaatkârın Siparişi" tekrarlanabilir. Seviyeler Yetenekler (K) sayfasının **Meslekler** bölümünde görünür. Kod: `shared/src/data/gathering.ts`, `server/src/game/gathering.ts`.

### Ping (Alt + tık)

Dünyada bir yere **Alt + tık**: imlecin yanında bir ping çarkı açılır: **Dikkat!**, **Saldır!**, **Yardım lazım!**, **Buraya gel!**. Bir düşmana Alt + tık doğrudan "Saldır!" pingi atar. Grup arkadaşların aynı bölgedeyse noktada dalgalanan bir işaret, mini haritada turuncu bir nokta ve grup sohbetinde bir satır görür; başka bölgedeyseler grup sohbetine düşer. Grupsuzken ping sadece sana görünür. 5 saniyede en çok 4 ping.

### Envanteri düzenle

Envanter penceresindeki **Düzenle** düğmesi eşyaları türüne göre (ekipman slot ve nadirliğe göre, mücevherler, iksirler, görev eşyaları, materyaller) boşluksuz dizer ve yarım kalan yığınları birleştirir.

### Ayşe Teyze'nin falı

Ayşe Teyze ile konuşunca görevlerin yanında **Falıma bak** seçeneği çıkar. Fal günde bir kez bakılır (Türkiye saatiyle gün); aynı gün tekrar sorarsan aynı şeyi söyler, oyundan çıkıp girmek falı değiştirmez. **İyi fal** (%45) çıkarsa o gün bütün +N yükseltmelerin başarı şansı **%10 artar** (demirci penceresinde "(+%10 fal)" yazar); **kötü fal** çıkarsa hiçbir şey değişmez. Kod: `shared/src/data/fortune.ts`, `server/src/game/fortune.ts`.

### Pasif ağaç (P)

Sabit düğümleri yok: **20 büyük boş slot** var, seviye 2'den 21'e kadar her seviyede bir tanesi açılır. Her büyük slotun altında **5 küçük slot** vardır.

Ekran bir çemberdir (dolum animasyonsuzdur; seçim değişince altın renk yumuşakça yeni yuvaya geçer): 20 büyük yuva çemberin etrafında durur ve her birinden merkeze boş bir çubuk uzanır; seçili olmayanlar sönük durur. Seçilen yuva en üste gelir; içine yukarıdan sıvı altın dökülür (dalgalı yüzeyle, kesik kesik), altın çubuktan aşağı akar ve ortadaki küçük yuvaları sırayla yukarıdan doldurur (Kadim Yuvalarda kırmızı elmaslar da altına döner). Bir yuvaya tıklayınca çember döner, yuva en üste gelir ve sarı bir çizgiyle ortadaki küçük çembere bağlanır; 5 küçük yuva orada (dördü çemberin üstünde, biri ortasında) görünür. **1, 6, 11 ve 16. yuvalar Kadim Yuva'dır** (kırmızı halka ve dört elmas işareti; seçili yuva sadece büyür ve sarı halkayla belirtilir, Kadim Yuva seçiliyken küçük yuvalara inen çizgi kırmızıdır): Büyük Mücevher'in yanı sıra **Kadim Mücevher** de alır.

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

### At (H)

Sağ altta, mana/öfke küresinin solundaki **at düğmesine** bas (ya da **H**): atın gelir ve binersin; tekrar basınca inersin. Herkesin kendi atı vardır, satın almak gerekmez.

- At üstünde **%60 daha hızlı** gidersin. Hız sunucuda hesaplanır ve hareket tahmini aynı fonksiyonu kullanır, yani at üstünde de takılma olmaz.
- **Binilebilen yerler:** Ana Merkez, Başlangıç Vadisi, Kara Orman, Liman. Zindanlarda ve Kan Arenası'nda binilmez; savaştayken (son 5 saniyede vurduysan ya da vurulduysan) binilmez.
- **Attan inersin:** saldırınca ya da skill kullanınca, balık tutmaya başlayınca, pazar kurunca, ölünce. Bölge değiştirince at geride kalır, varınca yeniden binersin.
- Binip inmek arasında 1,5 saniye bekleme var. Binince ve inince ayaklarının dibinde toz kalkar.
- At kodla çizilir (`client/src/gfx/horse.ts`): yandan yürürken bacakları adım atar, önden atın başı, arkadan sağrısı ve kuyruğu görünür; herkes seni atlı görür. Mantık `server/src/game/mount.ts`.

### Pet

Şehirde, at çiftliği kapısının birkaç adım batısında **Petçi Nuri** evcil hayvan satar. Şimdilik tek pet var: **Tavşan**, **1.000.000 altın**.

- Satın aldığın pet hemen yanına gelir ve peşinden zıplar. Yakınında (8 kare) **senin alabileceğin** bir ganimet varsa (kendi kestiğin, grubunun ya da artık herkese açık olanlar) ona koşar, alır, altın ve eşyalar çantana girer. Bu sırada sen dövüşmeye devam edersin.
- Senin yere attığın eşyalara ve başkasının ganimetine dokunmaz. Çantan doluysa sığmayanı yerde bırakır.
- Sahada **`/pet`** yazarak peti eve gönderir, tekrar yazarak geri çağırırsın (Petçi Nuri'nin penceresinden de olur). Peti olan herkes görür; çok geride kalırsa (bölge değiştirince, dörtnala koşunca) yanına ışınlanır.
- Pet duvarların ve suyun üstünden zıplar, takılmaz. Kurallar `shared/src/data/pets.ts`, sunucu `server/src/game/pets.ts`, çizim `yeni-oyun-projesi/scripts/gfx/sprites.gd` (`RABBIT_FRAMES`). Petler `characters.pets` sütununda saklanır.

### Şehir portalı (T)

**T**'ye basınca bulunduğun yerde (zindan dahil, şehir hariç) Ana Merkez'e bir portal açılır. Şehirde de seni tam bıraktığın yere geri götüren bir portal durur; ikisine **E** ya da tıklamayla girilir. Portal sen başka bir haritaya girene ya da oyundan çıkana kadar (20 sn tolerans) durur; yeni bir T eskisinin yerini alır. Portal açık olduğu sürece zindan kopyası kapanmaz, döndüğünde her şey bıraktığın gibidir. Portalını yalnızca sen ve grup arkadaşların görürsün, sadece sahibi kullanabilir. Kod: `server/src/game/townPortal.ts`.

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

Bulutların üstünde **uçan bir adada** kurulu kale şehri; mob yok, PvP yok. Adanın kenarları yuvarlak ve düzensizdir; güneye bakan kenarların altında kayalık, adanın güneybatısındaki göletten akan derenin döküldüğü yerde şelale var, altında bulutlar süzülür (gökyüzü `Tile.Sky`, yürünemez). Şehri iki kat kalın, mazgallı, **yuvarlağa yakın ve dalgalı** bir sur çevirir (`CASTLE`, `shared/src/town.ts`); surun üstünde bayraklı burçlar, **doğu** ve **batı** kapılarında ikişer kule var. Doğu kapısından çıkan yol adanın doğu burnundaki Başlangıç Vadisi kapısına gider; ondan güneye ayrılan Arnavut kaldırımı yol surun dışından dolanıp güney burnundaki Liman kapısına iner. Sur içi eski şehrin iki katından büyüktür. Kuzeyde **İç Kale** (kapısında iki muhafız), ortada çeşmeli oval meydan ve bankları, güneydoğuda **at çiftliği** (Seyis Yusuf, sur içinde), kuzeybatıda Kan Arenası'nın kumlu avlusu var. Dükkânlar kıvrılan sokaklara dağılmıştır: silahçı ve kışla doğu kapısında, demirci batı kapısında, iksirci kuzeybatıda, parşömenci İç Kale'nin yanında, kuyumcu ve zanaatkâr güneybatıda, depo güneydoğuda. Ayrı bir pazar meydanı yok: **tezgâh şehrin her yerinde açılır** (kapı ağızlarında ve bir NPC'nin dibinde açılmaz). Sur dışı büyük, gölgeli ağaçlarla kaplı çayırlıktır. Kale avlusunun köşesinde antrenman kuklaları durur.

Şehrin çizimleri kodla piksel piksel boyanır (`client/src/gfx/sprites.ts`, `pixelArt.ts`): ahşap karkaslı, kiremit çatılı evler (mahya yatay ya da önden arkaya: çatılar farklı yönlere bakar; derin evler iki katlı), kümeli taçlı büyük ağaçlar, çalılar, kuyu, kukla, fıçı, sandık ve saman; ışık sol üstten gelir, gölgeler sağ alta düşer, her şeyin koyu bir dış hattı vardır. Çimen karelerinin konuma göre seçilen varyantları vardır. Kaldırım ve meydan taşları kare kare değil, birkaç karelik dikişsiz bir taş deseninden kesilir (her taş ayrı biçimde, kare sınırlarını aşar). Çimen, kaldırım/meydan/toprak yol kenarlarında taşın üstüne düzensiz dillerle taşar (`grassFringe`, `client/src/gfx/ground.ts`). Kaldırımın meydana değdiği kenarda düzgün bir bordür (kenar taşı sırası) vardır. İç Kale masalsı, çok kuleli bir saraydır: arkada yüksek bir ana kule ve yanında iki kule, ortada mavi çatılı kale bloğu ve köşe kuleleri, önde mazgallı sur, kapı kuleleri ve büyük köşe kuleleri; hepsinin mavi sivri külahı ve bayrağı, kapıda fenerler, surda sancaklar vardır. Atlar (çiftlikte ve binekte) aynı tarzda piksel piksel boyanır.

**Işıklar:** Fenerler, meşaleler ve evlerin pencereleri açık havada saate bağlıdır: 18:00'de yumuşakça yanmaya başlar (18:45'te tam), sabaha doğru söner, 06:00'da kapalıdır (`lampLevel`, `shared/src/daynight.ts`). Kapalı mekânlarda hep yanar, kamp ateşleri hep yanar. Gece bir fenerin yakınındaki karakterlere sıcak ışık düşer ve fenerin tersine uzanan bir gölgeleri olur (`lightAt`, `client/src/fx/nightLights.ts`).

| NPC | Satar / yapar |
| --- | --- |
| **Silahçı Kerem** | Demir Kılıç, Savaş Baltası, Çelik Kılıç, Meşe Asa, Dişbudak Asa |
| **Zırhçı Leyla** | Deri başlık/yelek/pantolon, Eski Çizme, Pullu Yelek, Demir Çizme |
| **Parşömenci Nuri** | Düşük Sınıf (30) ve Orta Sınıf (450) Yükseltme Parşömeni |
| **İksirci Zehra** | Can ve mana iksirleri |
| **Demirci Hasan** | Ekipman yükseltme (aşağıya bakın) |
| **Kuyumcu Selin** | Bakır ve gümüş yüzük, kolye, küpe |
| **Depocu Hatice** (güneydoğudaki ambar) | Depo: eşya ve altın saklama (aşağıya bakın) |
| **Komutan Baran** (doğu kapısının içi, kışlanın önü) | Görevler |
| **Bilge Ozan** (çeşmenin batısı) | Görevler, hikaye |

- Her NPC'ye satış yapılabilir (dükkân açıkken envanterde sağ tık).
- Kapı ve İç Kale nöbetçileriyle konuşabilirsin (sadece laf atarlar).
- Kale kapısından çıkan yolun sonunda **ışınlanma kapısı** var: içine yürüyünce Başlangıç Vadisi'ne ışınlanırsın (E'ye basmana gerek yok). Vadideki kavşakta da şehre dönüş kapısı var.
- Kan Arenası portalı şehrin kuzeydoğusunda, kumlu arena meydanında.
- Şehirde ölünemez; vadide ölürsen şehir kapısının yanında doğarsın.

### Liman ve balık tutma

Kale kapısından çıkan yolda, hendeğin hemen doğusunda **LİMAN** tabelalı bir patika güneye iner; sonundaki ışınlanma kapısı **Liman**'a götürür (içine yürümek yeter). Liman'da taş rıhtım, kumsal, üç ahşap iskele, demirli bir gemi, meyhane, ambar ve kayalıkların üstünde dönen ışıklı bir deniz feneri var. Mob ve PvP yok; Liman'da çıkış yaparsan Liman'da girersin.

- **Balıkçı Rıfat** (orta iskelenin başı) **Olta** satar (250 altın). Balıklar her tüccara satılabilir.
- Olta çantandayken suyun kenarına ya da bir iskeleye git: ekranda **Balık Tut** düğmesi belirir (ya da oltaya sağ tıkla). Şamandıra suya düşer ve her **6-12 saniyede** bir av gelir. **Yürüyene kadar devam eder**, yani AFK bırakılabilir. Yürümek, saldırmak ya da skill kullanmak, takas, pazar, ölüm, çantanın dolması oltayı toplar. **Oltayı Topla** ile de bırakırsın.
- Av tablosu (`shared/src/data/fishing.ts`):

| Av | Şans | Satış |
| --- | --- | --- |
| Hamsi | %37,19 | 2 |
| İstavrit | %25 | 3 |
| Levrek | %14 | 7 |
| Çipura | %9 | 10 |
| Deniz Kabuğu | %8,65 | 1 |
| Lüfer | %4,5 | 18 |
| Düşük Sınıf Yükseltme Parşömeni | %1 | |
| **Altın Balık** | %0,5 | 300 |
| **Orta Sınıf Yükseltme Parşömeni** | %0,1 | |
| **Koruma Tılsımı** | %0,04 | |
| **Yüksek Sınıf Yükseltme Parşömeni** | %0,02 | |

Kalın olanlar çıkınca tüm sunucuya duyurulur. Başkalarının oltasını, şamandırasını ve av sıçramalarını da görürsün. Kod: `server/src/game/fishing.ts`, harita `shared/src/harbor.ts`.

### Pazar (oyuncudan oyuncuya satış)

Knight Online tarzı tezgâh. Ana Merkez'in **istediğin yerinde** (kapı ağızlarında ve bir NPC'nin dibinde değil) ekranda çıkan **Pazar Kur** düğmesine bas.

1. Tezgâha bir ad ver (boş bırakırsan "İsim'in Tezgâhı" olur).
2. Envanterde item'a sağ tıkla ya da pencereye sürükle (en fazla 8 item), her birine **birim fiyat** yaz.
3. **Pazarı Aç**: karakterin tentenin altına oturur, başının üstünde tezgâh adı görünür.

- Pazar açıkken yerinden kalkamaz ve envanterine dokunamazsın. Satılan her şey sohbete yazılır; her şey satılınca pazar kendiliğinden kapanır. Kapatmak için **Pazarım → Pazarı Kapat**.
- Başkasının tezgâhına bakmak için oyuncuya/tabelaya tıkla ya da yanındayken **E**'ye bas. Yığılan item'larda adet seçilir.
- Satışlar sunucuda kontrol edilir (mesafe, altın, yer, fiyat değişmiş mi) ve iki karakter **tek veritabanı işleminde** hemen kaydedilir; item kopyalanamaz ya da kaybolmaz. Tek parça item'lar (+N dahil) aynı kimlikle el değiştirir.
- Tezgâhlar birbirine çok yakın kurulamaz. Pazar ayarları `shared/src/constants.ts` içindedir, pazar kodu `server/src/game/market.ts`.

### Depo (Depocu Hatice)

Knight Online tarzı depo. Pazarın doğusundaki ambarın önünde **Depocu Hatice**'ye tıkla ya da yanındayken **E**'ye bas; depo penceresi envanterle birlikte açılır.

- 48 kutu ve ayrı bir **altın kasası** vardır. Depo bu karaktere aittir; içindekiler sadece Depocu'nun yanındayken alınıp konabilir.
- Envanterde sağ tık: depoya koy. Depoda sağ tık: envantere al. İki pencere arasında sürükle-bırak da çalışır (yığılan item'lar birleşir).
- Altın: miktarı yaz, **Koy** ya da **Al**'a bas.
- Kuşanılmış item doğrudan depolanamaz, önce çıkarılır. Pazar tezgâhı ya da takas açıkken depo kullanılamaz.
- Depo, karakterin geri kalanıyla aynı kayıtta saklanır (`items.container = 'storage'`, `characters.storage_gold`); bir item'ın yarısı depoda yarısı çantada kalamaz. Kod: `server/src/game/storage.ts`, `yeni-oyun-projesi/scripts/ui/storage_window.gd`.

### Takas (oyuncudan oyuncuya)

Yanındaki bir oyuncuya tıklayıp hedef çerçevesindeki **Takas**'a bas ya da sohbete `/takas İsim` yaz (en fazla 5 kare uzaktaki oyuncuya). Karşı tarafa Kabul/Reddet kutusu çıkar; kabul edince ikinize de takas penceresi açılır.

1. Envanterde sağ tıkla ya da item'ı takas penceresine sürükle (en fazla 8 item, yığınlar bütün olarak gider); istersen altın yaz. Kendi teklifindeki bir item'a tıklarsan geri alırsın.
2. **Teklifi Kilitle**: teklifin artık değişmez.
3. İki taraf da kilitleyince **Takası Tamamla** belirir; ikiniz de onaylayınca takas olur.

- Takas açıkken iki tarafın da envanteri kilitlidir (item kullanamaz, taşıyamaz, satamazsın). Böylece karşı tarafın gördüğü teklif değiştirilemez.
- Takas sunucuda tekrar kontrol edilir (item'lar hâlâ orada mı, altın yetiyor mu, iki tarafta da yer var mı) ve iki karakter **tek veritabanı işleminde** kaydedilir. Yer yoksa hiçbir şey değişmez ve takas iptal olur. +N ve statlar korunur: item aynı kimlikle el değiştirir.
- 8 kareden fazla uzaklaşırsanız, biriniz ölürse ya da bölgeden çıkarsa takas iptal olur. Görev eşyaları takas edilemez. Kod: `server/src/game/trade.ts`, `yeni-oyun-projesi/scripts/ui/trade_window.gd`.

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

### Harita editörü

`http://localhost:5173/editor.html` (GM panelindeki **Harita Editörü** bağlantısı). Bölgenin kodda üretilen haritası altta çizilir; editörde konan objeler üç katmanda üstüne serilir: **Zemin** (çimen, yol, kaldırım…), **Engel** (duvar, ağaç, kaya, su, görünmez engel) ve **Doğuş** (oyuncu doğuşu, yaratık doğuşu: yaratık, adet, yarıçap).

- Paletten sürükle-bırak ya da paletten seçip haritada sürükleyerek boya; 16/32/64 px ızgaraya oturur. `Q` farenin altındaki kareyi/objeyi paletten seçer (pipet). Tıkla seç, sürükle taşı; `Delete` sil, `R` döndür, `Ctrl+Z` geri al, `Ctrl+D` kopyala, oklar kaydır, `Ctrl+S` kaydet. Katmanlar gizlenebilir/kilitlenebilir; JSON olarak indirilip yüklenebilir.
- Editör haritayı bake'in kullandığı çizim koduyla (`client/src/gfx/ground.ts`) ve düzenlemeler uygulanmış haliyle çizer: kale, kuleler ve binalar oyundaki gibi ayakta görünür. `Engeller` kutusu hareketi engelleyen kareleri tarar. Boyanan kare, tamamen örttüğü eski düzenlemelerin yerini alır.
- **Kale:** Kale Duvarı kareleri birbirine bağlanır; köşe, mazgal ve ön yüz komşulara göre oyunda kendiliğinden çizilir. Köşelere 4×4 **Kule** konabilir. Boyamak hiçbir süsü silmez; bina, kule, çeşme gibi bir süsü kaldırmak için **Süs Kaldır** (`K`) alanı çizilir (kaldırılan kulenin yerinde kale duvarı kalır).
- Kaydedince açık odalar haritayı hemen değiştirir (`Msg.MapChanged`); içerdekiler yeni zemini görür, duvarın içinde kalan doğuş noktasına alınır. Yaratık alanları bölge yeniden açılınca değişir.
- **Süsler (level design):** "Süs" katmanında evler (3 boy; çatı rengi, mahya yönü, baca, ölçü ayarlanır), büyük ağaç, çalı, otlar ve çiçekler, fener, meşale, sancak, fıçı, sandık, çuval, saman, kuyu, kukla, araba, örs ve kamp ateşi konur, taşınır, silinir. Haritanın kendi süsleri (kodda tanımlı evler, otlar, fenerler...) tıklanınca seçilir: `Delete` ile kaldırılır, sürüklenince taşınır (aslı gizlenir, kopyası yeni yerine konur; eski yerindeki engel kalkar, zemin çevresine göre dolar). Ev, fener, ağaç gibi süslerin altı kendiliğinden engel olur; ot, çalı ve tabelanın içinden geçilir. Sunucu süs verisini sıkı doğrular (`sanitizeDecor`).
- **Engeller:** Görünmez Engel (`B`) bütün kareyi, Yarım Engel (`H`) karenin farenin yakın olduğu kenardaki yarısını (üst, alt, sol ya da sağ; `R` ile döner), Küçük Engel (`V`) farenin olduğu çeyreği (8×8 px) kapatır; Engel Kaldır (`X`) görünmez engelleri açar (duvar, ağaç ve suya dokunmaz). Bunlar süsleri silmez. Çeyrekler `WorldMap.blockMask` ile tutulur ve sunucu ile istemci aynı `collides` fonksiyonunu kullanır.
- **Harita boyutu:** sağ ve alt kenardan büyür/küçülür (kenarı sürükle ya da sağ paneldeki Harita boyutu); sol üst köşe sabit kalır, böylece koddaki NPC, portal ve yaratık konumları değişmez. Yeni alan seçilen dolguyla dolar. NPC, portal ya da toplama alanı dışarıda kalacaksa sunucu reddeder.
- **Kare görselleri:** kodla çizilen karelerin yerine PNG yüklenebilir (sol panel, Kare görselleri). Zemin kareleri 16×16; kale parçaları kendi şeklinde: duvar üstü 16×16, duvar ön yüzü 16×24, kule 64×110 (hepsinin 2-4 katı da olur), en fazla 256 KB. Bir satırın üstüne gelince o parçanın haritada nerede çizildiği yanar; `tile_art` tablosunda tutulur, `/api/tiles` ile sunulur. Büyük görsel varsa tileset o çözünürlükte kurulur ve harita ölçeklenir. Oyunda sayfa yenilenince görünür. Her kare için şu anki görsel ve kodla çizilen orijinal indirilebilir; her yeni yüklemede öncekisi `tile_art_history`'de saklanır (kare başına son 20) ve geri yüklenebilir.
- Güvenlik sunucudadır: `/api/admin/maps` her istekte oturum token'ını ve GM yetkisini kontrol eder (`requireAuth` + `requireAdmin`), gelen her obje `validateMapEdits` ile sıkı doğrulanır (tür, katman, harita sınırı, boyut, dönüş, tek oyuncu doğuşu, boss olmayan yaratık). Sayfanın kendini GM olmayanlara gizlemesi sadece görünüştür.
- Kayıt `map_edits` tablosuna yazılır (bölge başına bir JSON). Aynı `applyMapEdits` sunucuda ve istemcide çalışır, böylece çarpışma iki tarafta aynıdır. Yeni kayıt, bölgede o andan sonra açılan odalara ve bölgeye yeniden giren oyunculara uygulanır.

```json
{
  "version": 1,
  "zone": "town",
  "grid": 32,
  "objects": [
    { "id": "o1", "type": "wall", "layer": "collider", "x": 10, "y": 10, "z": 1, "w": 2, "h": 2, "rotation": 90 },
    { "id": "o2", "type": "mob_spawn", "layer": "spawn", "x": 20, "y": 20, "z": 1, "w": 1, "h": 1, "rotation": 0,
      "props": { "mob": "slime", "count": 3, "radius": 3 } }
  ]
}
```

## Sunucuya kurulum (Hetzner)

Tek VPS üzerinde Docker Compose: Postgres + oyun sunucusu + Caddy (otomatik HTTPS). Dosyalar: `docker-compose.yml`, `deploy/`.

- İlk kurulum (bir kez): `ssh root@IP 'bash -s' < deploy/server-setup.sh`, sonra `/opt/mmo/.env` içinde `DOMAIN` ayarlanır (domain yoksa `1-2-3-4.sslip.io`). `REDIRECT_DOMAINS` (boşlukla ayrılmış) eski adresleri ana domain'e yönlendirir; `www.` her zaman yönlenir.
- Güncelleme: `main`e her push GitHub Actions ile typecheck edilip otomatik deploy edilir (`.github/workflows/deploy.yml`). Elle (commitlenmemiş değişikliklerle): `deploy/deploy.sh root@IP` (Git Bash); bu, `client/src/assets/licensed/` klasörünü de sunucudaki `/opt/mmo/licensed` içine eşitler.
- Oyun (Godot web build): `yeni-oyun-projesi`'nden Web preset'iyle dışa aktar (sunucudaki kodla aynı veriden bake edilmiş olmalı), sonra `deploy/deploy-godot.sh root@IP <build klasörü>`. Build sunucuda `/opt/mmo/godot-web`'de durur; `update.sh` her deploy'da onu `client/public/`'e kopyalar ve site kökünde sunulur. `/oyun` adresi köke yönlenir.
- GM yetkisi: `ssh root@IP 'docker exec mmo-app-1 npm run make-admin -w server -- <kullanıcı-adı>'`
- Loglar: `ssh root@IP 'docker logs -f mmo-app-1'`

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
yeni-oyun-projesi/  Oyun istemcisi (Godot 4.7, GDScript): Colyseus bağlantısı, dünya, arayüz, dokunmatik kontroller
client/
  src/admin/       GM paneli; src/editor/: harita editörü
  src/bake/        Godot bake sayfası (tools/godot/bake.mjs onu headless Chrome'da açar)
  src/gfx/         Kodla çizilen pixel art: harita, karakterler, item ikonları (editör ve bake kullanır)
```

### Temel kurallar

- **Sunucu otoriterdir.** İstemci sadece "şu yöne basıyorum" bilgisini gönderir. Konum, hasar, drop ve item basma sonucu yalnızca sunucuda hesaplanır.
- **Ortak kod `shared/` içinde durur.** Hareket fonksiyonu (`stepMovement`) iki tarafta da aynıdır. İstemci bu sayede kendi hareketini anında tahmin eder (*client-side prediction*). Sunucudan cevap gelince henüz işlenmemiş girdileri yeniden oynatarak düzeltir (*reconciliation*).
- **Diğer oyuncular 100 ms geriden çizilir.** Bu gecikme *snapshot interpolation* içindir ve kayan, kesintisiz bir hareket sağlar.
- **Girdiler eylem katmanından geçer** (`yeni-oyun-projesi/scripts/autoload/keys.gd`). Oyun kodu tuşları değil eylemleri sorar; mobil dokunmatik kontroller (`yeni-oyun-projesi/scripts/ui/touch_controls.gd`) de aynı eylemleri tetikler.
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
| 7.9 | Depo (Depocu), oyuncular arası takas, kale şehri: hendek, mazgallı surlar, burçlar, kale kapısı, İç Kale, dağınık sokaklar | ✅ |
| 7.10 | Grupça zindana giriş daveti, gruptan çıkanın zindandan atılması, Liman bölgesi ve AFK balık tutma | ✅ |
| 7.11 | Karakter yaratma (cinsiyet, saç modeli/rengi, ten, kıyafet rengi), iç kale önünde Metin2 tarzı karakter seçme, karakter silme, oyun süresi | ✅ |
| 7.12 | CraftPix canavar çizimleri (satir, golem, minotor, hortlak), Satir Korusu ve Yosun Golemleri, 9 canavar silahı, sprite dönüştürme aracı | ✅ |
| 7.13 | At: sağ alttaki at düğmesi / H ile binip inme, %60 hız, açık dünyada | ✅ |
| 7.14 | Arenada en yüksek puanlıya parlayan taç, GM'lerin üstünde zıplayan GM yazısı | ✅ |
| 7.15 | Kan Arenası kolezyum oldu: tribünler, seyirciler, imparator locası, kemerli cephe, sütunlar | ✅ |
| 7.16 | Gece fenerlerin ışık havuzları, atta Shift ile dörtnala, Liman yolu, iki sütunlu yetenek sayfası, arkadaş sistemi (O) | ✅ |
| 7.17 | İç Kale'ye girilebilir: ahşap büyük salon, ateş başında oturan 6 sınıf ustası (öğüt verir), muhafızlara yol sorma (yön oku + harita işareti) | ✅ |
| 7.18 | Acemi başlangıç + Ustaların Ateşi görevi, 7 usta (Alp, Kam, Börü, Tigin, Erşek, Ak Ana, Erlik Ruh Eğitmeni), yeni sınıflar Şaman, Okçu, Druid (Büyücü ve Muhafız kalktı), onaylı sınıf seçimi, Ayşe Teyze'de altınla yol sıfırlama | ✅ |
| 7.19 | Boss müziği: Kadim Ejder Azhdar'ın savaşında kendi şarkısı çalar (Esc → Ayarlar → Boss müziği); müzik `yeni-oyun-projesi/art/licensed/music/<mob id>.ogg`, kod `yeni-oyun-projesi/scripts/world/boss_music.gd` | ✅ |
| 7.20 | Telifli varlıklar (şarkı, CraftPix ve Kabak Jack çizimleri, Cloister Black) depodan çıktı; `client/src/assets/licensed/` yalnızca yerelde, yoksa oyun kodla çizilen benzerlerini kullanır | ✅ |
| 7.21 | At çiftliği ve Seyis Yusuf (doğu kapısının dışında): Bozkır Atı 25.000, Arap Atı 75.000, Ahal-Teke 200.000, Kara Yel 500.000 altın (%10-40 daha hızlı); bindiğin atın donu, yelesi, örtüsü ve eyeri 1.000.000 altına düzenlenir | ✅ |
| 7.22 | Çeşmenin etrafında 4 bank (8 koltuk): banka tıkla, karakter yürüyüp çeşmeye dönük oturur; yürüyünce ya da ata binince kalkar, herkes oturduğunu görür | ✅ |
| 7.23 | Metin2'nin ünlü **Akşam Yemeği** görevi: Zırhçı Leyla, İksirci Zehra'nın akşam yemeğinde ne istediğini öğrenmeni ister; Leyla'ya dönünce her seferinde karışan a/b/c/d şıklarından doğrusunu seçersin, yanlışsa gidip tekrar sorarsın (1000 XP, 1500 altın). Ayşe Teyze'nin zinciri artık "Ayşe Teyze'nin Mutfağı" | ✅ |
| 7.24 | Vadiden batıya **Kızıl Kanyon** (Sv 20+: sırtlan, çakal, çöl akıncıları, kumtaşı golemi, minotor; alan bossu Akıncı Beyi Kara Toygar) doğuya **Ayaz Dağları** (Sv 30+: ayaz kurdu, yeti, buz golemi, hortlaklar; alan bossu Buz Devi Ayazhan) ve güneye **Kor Toprakları** (Sv 40+: lav nehri ve köprüleri, kor kurdu, kül tapıcıları, ateş elementali, lav golemi; alan bossu Kor Devi Ateşhan). 6 yeni zindan: Kızıl Mağaralar (22), Gömülü Kervansaray (26), Buz Mağarası (31), Ayaz Kalesi (35), Magma Ocakları (42), Kül Tapınağı (46). Zindanlar temalı: mağara, sütunlu salon, havuzlu, haç, sekizgen odalar; meşaleler, çadırlar, mezarlar, raflar. Yeni zemin: kum, kızıl kaya, kar, buz, karlı çam, lav, kül. Silah/zırh kademeleri Sv 45'e kadar; yaylar artık yaratıklardan düşüyor. `npm run check-zones -w server` her bölgenin oynanabilirliğini denetler | ✅ |
| 7.25 | Moblar CraftPix çizimleriyle: goblin, ork, ogre, iskelet, zombi köylü, kara kâhin ve şövalye paketleri 26 moba, gnol/yeti/devler satir, minotor ve golem çizimlerine geçti (`tools/build_sprites.py`, dosyalar `client/src/assets/licensed/`). Kor Toprakları'nın güneyinde yeni bölge **Kurgan Ovası** (Sv 50+): kuru ağaçlı bozkır, yaşlı kamın yurt kampı, veba köylülerinin terk edilmiş köyü, kurgan tarlası ve balbal sıraları, çitli mezarlık, bataklıkta kara kâhinlerin balbal halkası, düşmüş şövalyelerin yıkık kalesi; alan bossu Düşkün Başbuğ Karaçor, gece Gece Yürüyenleri ve Kurgan Hortlakları. Yeni zindan **Han Kurganı** (55): Kemik Bey Sökmen, Kara Kâhin Albastı, Ölü Han Tolun. Yeni zemin: kurak bozkır, kuru ağaç, bataklık; yeni dekor: kurgan, balbal, terk edilmiş ev. Silah/zırh kademeleri Sv 57'ye kadar, yeni malzemeler Lanetli Kemik ve Kurgan Altını | ✅ |
| 7.26 | Çizim dekorları: CraftPix ölümsüzler, zindan ve laboratuvar piksel paketleri ile çöl ve tropik paketlerinden 129 parça (`tools/build_decor.py`, katalog `shared/src/data/decorArt.ts`, dosyalar `client/src/assets/licensed/decor/`, yoksa kodla çizilen yedek). Kurgan Ovası'nda harabeler, kuru ağaçlar, mezar taşları, kemikler, dev iskelet han ve Han Kurganı'nın kafatası kapısı; zindanlarda temaya göre sancaklar, zırh heykelleri, silah rafları, erzak, simya rafları, canavar kavanozları, kökler ve kemikler; Kızıl Kanyon'da kayalık tepeler, kaktüsler, kervan arabası, gözcü kulesi; Liman'da palmiyeler ve taş yüz heykeli | ✅ |
| 7.27 | Pet: Petçi Nuri (şehirde, at çiftliği kapısının batısında) **Tavşan** satar (1.000.000 altın). Yanındaki pet, kestiğin yaratıkların ganimetini toplayıp getirir; sahada `/pet` ile çağrılır / eve gönderilir | ✅ |
| 8 | Optimizasyon, anti-cheat, yedekleme, alfa testi | ⏳ |

Faz 2 bitince oyun oynanabilir hale gelir. Sonraki fazlar bunun üzerine eklenir.

## Teknoloji

- İstemci: Godot 4.7 (GDScript, GL Compatibility, web export)
- GM paneli / harita editörü / bake: TypeScript, Phaser 3, Vite
- Sunucu: Node.js, TypeScript, Colyseus 0.16
- Veritabanı (Faz 1'den itibaren): PostgreSQL
- Haritalar: şimdilik kodla üretiliyor (`shared/src/map.ts`), ileride Tiled editörüne geçilecek
