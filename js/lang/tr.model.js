/* Turkish language pack: model content. */
(function (r) {
  var L = r.LANGS = r.LANGS || {}; var l = L.tr = L.tr || {};
  l.name = 'Türkçe';
  l.model = {
    cats: { deal: 'Çözüm tasarımı', diplomatic: 'Diplomasi', legal: 'Hukuk', economic: 'Ekonomi', energy: 'Enerji', security: 'Güvenlik', societal: 'Toplum', wait: 'Bekleme' },
    outcomes: {
      reunified: { name: 'Doğrulanmış yeniden birleşme', desc: 'Tek devlet; yabancı askerlerin büyük bölümü gitmiş, düzenlemeler işliyor.' },
      convergence: { name: 'Yakınlaşma', desc: 'Taraflar üzerinde anlaşılmış bir çözüme doğru ilerliyor, güven artıyor.' },
      stalemate: { name: 'Yönetilen tıkanıklık', desc: 'Bölünmüşlük kriz çıkmadan sürüyor; zaman onu sessizce kalıcılaştırıyor.' },
      confrontation: { name: 'Karşı karşıya geliş', desc: 'Yüksek baskı ve yıpranan sükûnet: kazanım da mümkün, yanlış hesap da.' },
      partition: { name: 'Kalıcılaşmış bölünme', desc: 'Fiiliyatta iki ayrı yapı; yeniden birleşme erişilmez hâle geliyor.' },
      crisis: { name: 'Silahlı kriz', desc: 'Askerî olaylar veya abluka; geri kalan her şey askıda.' }
    },
    lens: { Political: 'Siyasi', Security: 'Güvenlik', Economic: 'Ekonomik', Energy: 'Enerji', Legal: 'Hukuki', Social: 'Toplumsal' },
    hold: { name: 'Mevcut konumu koru', desc: 'Bu turda yeni bir hamle yapma; mevcut politikayı sürdür ve diğerlerinin harekete geçmesini bekle.' },
    srcs: {
      'Blueprint: Strategy to Reclaim the North (2025)': 'Plan: Kuzeyi Geri Kazanma Stratejisi (2025)',
      'Blueprint: Cyprus–U.S. Strategic Leverage (2025)': 'Plan: Kıbrıs–ABD Stratejik Kaldıracı (2025)',
      'Blueprint: Unified Cyprus (2025)': 'Plan: Birleşik Kıbrıs (2025)',
      'Blueprint: Holistic Strategy to Prevent Aggression (2025)': 'Plan: Saldırganlığı Önlemeye Yönelik Bütüncül Strateji (2025)',
      'Proposal: A Vision for Peace and Prosperity (2024)': 'Öneri: Barış ve Refah Vizyonu (2024)',
      'Proposal: Bridging Divides (2024)': 'Öneri: Ayrılıkları Aşmak (2024)'
    },
    dims: {
      settle: {
        name: 'Çözüm süreci',
        short: 'Çözüm',
        lo: 'İki ayrı devlet',
        hi: 'Yeniden birleşmiş tek devlet',
        desc: 'Siyasi sürecin hangi yöne gittiği.',
        basis: 'BM öncülüğündeki görüşmeler Crans-Montana\'dan (Temmuz 2017) beri tıkanmış durumda. Gayriresmî BM toplantıları 2025\'te yeniden başladı ve Kıbrıslı Türkler Ekim 2025\'te federasyon yanlısı Tufan Erhürman\'ı seçti; Ankara ise iki devletli tutumunu dile getirmeyi sürdürüyor.'
      },
      troops: {
        name: 'Askerden arındırma',
        short: 'Asker',
        lo: 'Takviye edilmiş garnizon',
        hi: 'Doğrulanmış tam çekilme',
        desc: 'İngiliz üsleri dışında adadaki yabancı askerî varlık.',
        basis: 'Türkiye kuzeyde tahminen 30.000–40.000 asker bulunduruyor. 1960 tarihli Garanti Antlaşması resmen yürürlükte. UNFICYP (BM Barış Gücü, yaklaşık 800 asker) 1964\'ten beri ara bölgede devriye geziyor.'
      },
      econ: {
        name: 'Adanın ekonomik bütünleşmesi',
        short: 'Ekonomi',
        lo: 'Birbirine kapalı ekonomiler',
        hi: 'Ada çapında tek pazar',
        desc: 'İki ekonominin ne ölçüde tek ekonomi gibi işlediği.',
        basis: 'Yeşil Hat ticareti (866/2004 sayılı AB Tüzüğü) yılda yalnızca 15–16 milyon avro civarında. Kuzey, Türk lirası kullanıyor ve Ankara\'nın bütçe desteğine bağımlı. Dokuz geçiş kapısı faaliyette.'
      },
      energy: {
        name: 'Doğu Akdeniz enerjisi',
        short: 'Enerji',
        lo: 'Güç kullanılarak çekişilen',
        hi: 'Paylaşılan ve gelire dönüşen',
        desc: 'Açık deniz doğal gazının ve enterkonneksiyonun iş birliği içinde gelişip gelişmediği.',
        basis: 'Keşifler arasında Afrodit, Calypso, Glaucus ve Cronos var; hiçbirinde henüz üretim yok. Mısır üzerinden ihracat müzakere ediliyor. Türkiye, Cumhuriyet\'in MEB\'inin (münhasır ekonomik bölge) bazı bölümlerine itiraz ediyor ve 2018–2020\'de sondajı engelledi. Great Sea Interconnector projesinde gecikmeler yaşanıyor.'
      },
      pressure: {
        name: 'Statükonun Ankara\'ya maliyeti',
        short: 'Baskı',
        lo: 'Yok',
        hi: 'Ağır',
        desc: 'Türkiye\'nin mevcut durum nedeniyle katlandığı hukuki, ekonomik ve diplomatik maliyetler.',
        basis: 'BM Güvenlik Konseyi\'nin 541 ve 550 sayılı kararları kuzeyin tanınmamasını sürdürüyor. Kıbrıs/Türkiye davasında (2014) hükmedilen 90 milyon avro ödenmedi. AB\'ye katılım müzakereleri dondurulmuş durumda; sondajlara ilişkin 2019 tarihli AB yaptırım çerçevesinde iki kişi listelendi.'
      },
      trust: {
        name: 'Toplumlar arası güven',
        short: 'Güven',
        lo: 'Düşmanca',
        hi: 'Güven dolu',
        desc: 'Kıbrıslı Rumların ve Kıbrıslı Türklerin bir devleti paylaşmaya hazır olma düzeyi.',
        basis: '2004 referandumlarında Kıbrıslı Türklerin %65\'i evet, Kıbrıslı Rumların %76\'sı hayır oyu verdi. İki toplumlu çalışmalar sürüyor: Kayıp Şahıslar Komitesi 2.002 kayıptan 1.000\'den fazlasının kimliğini belirledi.'
      },
      stability: {
        name: 'İstikrar',
        short: 'İstikrar',
        lo: 'Silahlı kriz',
        hi: 'Sakin',
        desc: 'Askerî olayların ve uçurumun kenarı siyasetinin bulunmaması.',
        basis: '1974\'ten beri devletler arası çatışma yok, ancak sürtüşmeler yineleniyor: 2020\'deki deniz gerginliği, Ağustos 2023\'te Pile\'deki gibi ara bölge olayları ve hava sahası ihlalleri.'
      },
      trwest: {
        name: 'Türkiye–Batı bağı',
        short: 'Türkiye–Batı',
        lo: 'Kopuk',
        hi: 'Bütünleşmiş',
        desc: 'Türkiye\'nin AB ve Amerika Birleşik Devletleri ile bağlarının derinliği.',
        basis: 'AB–Türkiye gümrük birliği 1995\'e dayanıyor; güncellenmesi engellenmiş durumda. Türkiye 2019\'da F-35 programından çıkarıldı ve 2020\'de CAATSA kapsamında yaptırıma uğradı; F-16 satışı Ocak 2024\'te onaylandı.'
      },
      tcstatus: {
        name: 'Kıbrıslı Türklerin konumu',
        short: 'KT konumu',
        lo: 'Yalıtılmış, bağımlı',
        hi: 'Eşit, dünyayla bağlantılı',
        desc: 'Kıbrıslı Türkler için siyasi eşitlik, refah ve dünyaya erişim.',
        basis: 'AB müktesebatı kuzeyde askıya alınmış durumda (10 No\'lu Protokol). Türkiye üzerinden olanlar dışında doğrudan uçuş yok; doğrudan ticaret tüzüğü de yok. Kıbrıslı Türkler Kıbrıs Cumhuriyeti (AB) pasaportu alabiliyor.'
      },
      rocstand: {
        name: 'Cumhuriyet\'in konumu ve caydırıcılığı',
        short: 'KC konumu',
        lo: 'Yalıtılmış, korumasız',
        hi: 'Sağlam bağlı, korunaklı',
        desc: 'İttifaklar, hukuki konum ve zorlamayı caydırma kapasitesi.',
        basis: '2004\'ten beri AB üyesi, 2008\'den beri avro bölgesinde; 2026\'nın ilk yarısında AB Konseyi dönem başkanlığını yürüttü. ABD silah kısıtlamalarını 2022\'de kaldırdı. NATO üyesi değil; Millî Muhafız Ordusu küçük.'
      }
    },
    players: {
      ROC: {
        name: 'Kıbrıs Cumhuriyeti',
        short: 'KC',
        role: 'Kıbrıslı Rum toplumunun yönettiği, uluslararası alanda tanınan hükûmet. Konsey\'de veto hakkı bulunan AB üyesi.',
        interests: ['İşgalin sona ermesi, toprağın ve mülklerin iadesi', 'Tek egemenlik, tek vatandaşlık ve tek uluslararası kişilik', 'Açık deniz enerji kaynaklarını geliştirme serbestisi', 'Yabancı garantörlük hakları olmadan güvenlik'],
        redlines: ['İki devletli sonuca veya ikinci bir devletin tanınmasına hayır', 'Kalıcı Türk askerine veya tek taraflı müdahale hakkına hayır'],
        leverage: ['AB üyeliği: oybirliği kuralı, AB–Türkiye ilişkilerindeki her ilerlemede söz hakkı veriyor', 'Uluslararası hukuk ve BM kararları ondan yana', 'Açık deniz doğal gazı ve ortakların ihtiyaç duyduğu bir konum', 'AB\'nin sağladığı imkânları Kıbrıslı Türklere açabilme gücü'],
        vuln: ['Küçük silahlı kuvvetler; ittifak güvencesi yok', 'Kıbrıslı Rum seçmen 2004 planını reddetti; her anlaşmanın referandumdan geçmesi gerekiyor', 'AB ortakları, Ankara ile işlerine mal olan vetolardan yoruluyor', 'Enerji projeleri denizde tacize açık']
      },
      TC: {
        name: 'Kıbrıslı Türkler',
        short: 'KT',
        role: 'Kıbrıs Türk toplumu ve kuzeydeki liderliği. Her çözüm onların ayrı rızasını gerektiriyor.',
        interests: ['Siyasi eşitlik ve yönetime etkin katılım', 'Yalıtılmışlığın sona ermesi: ticaret, seyahat, spor, üniversiteler', '1963–74 şiddetine dönülmesine karşı güvenlik', 'Ankara karşısında da ayrı bir kimliğin korunması'],
        redlines: ['Çoğunluk yönetimi altında azınlığa indirgenmemek', 'Kendilerini inandırıcı bir güvenlikten yoksun bırakan çözüme hayır'],
        leverage: ['Ayrı referandum: onların eveti şart', 'İki tarafın da ihtiyaç duyduğu, dengeyi belirleyen aktör', 'Birçoğu Cumhuriyet üzerinden AB vatandaşı'],
        vuln: ['Türkiye\'ye ve liraya ekonomik ve bütçesel bağımlılık', 'Nüfus yerleştirilmesinden kaynaklanan demografik değişim', 'Ankara karşı çıktığında liderliğin hareket alanı dar']
      },
      TR: {
        name: 'Türkiye',
        short: 'TR',
        role: 'Kuzeyde askeri bulunan garantör güç; "KKTC"yi tanıyan tek devlet. NATO üyesi ve AB adayı.',
        interests: ['Stratejik derinlik ve Anadolu\'nun güneyinde askerî dayanak', 'Doğu Akdeniz enerjisinden ve deniz yetki alanlarından pay', 'Kıbrıslı Türklerin güvenliği ve statüsü', 'Avrupa\'ya kendi koşullarıyla ekonomik erişim'],
        redlines: ['Yenilgi veya zorla çekilme olarak sunulan sonuca hayır', 'Doğu Akdeniz enerjisinden dışlanmaya hayır'],
        leverage: ['Yerel düzeyde ezici askerî üstünlük', 'NATO üyeliği ve NATO–AB iş birliği üzerinde veto', 'AB\'ye yönelen göç akışlarının denetimi', 'Kuzeyin mali can damarı'],
        vuln: ['Liranın zayıflığı, Batı sermayesine ve pazarlarına bağımlılık', 'Savunma sanayisi Batılı bileşenlere bağımlı', 'Kuzeyi sübvanse etmenin maliyeti', 'İşgalci güç sıfatıyla itibar ve hukuki sorumluluk']
      },
      GR: {
        name: 'Yunanistan',
        short: 'YUN',
        role: 'Garantör güç, AB ve NATO üyesi, Kıbrıs Cumhuriyeti\'nin en yakın müttefiki.',
        interests: ['Ege\'de ve Doğu Akdeniz\'de sükûnet', 'BM kararlarıyla uyumlu bir çözüm', 'Kıbrıs ve İsrail ile enerji enterkonneksiyonu'],
        redlines: ['Zor yoluyla yaratılan oldubittilerin meşrulaştırılmasına hayır'],
        leverage: ['AB ve NATO\'da söz hakkı', 'Hava ve deniz gücü', 'Vazgeçmeye hazır olduğu garantörlük statüsü'],
        vuln: ['Ege konusunda Türkiye ile kendi ihtilafları', 'Enterkonnektörün maliyeti']
      },
      EU: {
        name: 'Avrupa Birliği',
        short: 'AB',
        role: 'Kıbrıs\'ın üyesi, Türkiye\'nin adayı olduğu Birlik; başlıca ekonomik teşvikler onun elinde.',
        interests: ['Güneydoğu sınırında istikrar', 'Ticaret, göç ve savunma alanlarında Ankara ile işleyen bir ilişki', 'Enerjide çeşitlendirme', 'AB hukukunun AB toprağında askıda olması anormalliğine son verilmesi'],
        redlines: ['AB hukuku ve değerleriyle bağdaşmayan çözüme hayır'],
        leverage: ['Gümrük birliğinin güncellenmesi, vize serbestisi, savunma fonlarına erişim', 'Kıbrıslı Türklere mali yardım', 'Oybirliğiyle alınan yaptırımlar'],
        vuln: ['Oybirliği: Türkiye konusunda çıkarları farklı 27 başkent', 'Göç konusunda Ankara\'ya bağımlılık']
      },
      US: {
        name: 'Amerika Birleşik Devletleri',
        short: 'ABD',
        role: 'Ankara\'nın güvenlik ve finans ortamı üzerinde en fazla etkiye sahip güç.',
        interests: ['Türkiye\'yi Batı ittifakı içinde tutmak', 'Bölgesel istikrar ve enerji koridorları', 'Doğu Akdeniz\'de güvenilir erişim ve ortaklar'],
        redlines: ['NATO içinde kopuşa hayır', 'Ortaklar arasında silahlı tırmanmaya hayır'],
        leverage: ['Silah satışları ve ihracat kontrolleri', 'Yaptırımlar ve dolar sistemi', 'Tarafları bir araya getirme gücü'],
        vuln: ['Rusya, Karadeniz ve Orta Doğu konularında Ankara\'ya ihtiyaç duyuyor', 'Politika yönetimden yönetime değişiyor']
      },
      UK: {
        name: 'Birleşik Krallık',
        short: 'BK',
        role: 'Garantör güç, Güvenlik Konseyi daimi üyesi, adada iki Egemen Üs Bölgesi\'nin sahibi.',
        interests: ['Ağrotur ve Dikelya\'daki üslerin engelsiz kullanımı', 'Hem Lefkoşa hem Ankara ile iyi ilişkiler', 'Üsler meselesini yeniden açmayan bir çözüm'],
        redlines: ['Egemen Üs Bölgeleri\'nin statüsü'],
        leverage: ['Güvenlik Konseyi\'nde Kıbrıs dosyasının kalem sahibi (penholder)', 'Garantörlük statüsü', 'Geçmiş görüşmelerde üs topraklarının yaklaşık yarısını devretmeyi önerdi'],
        vuln: ['Her iki tarafça yanlı görülüyor', 'Ülkesinde her iki toplumdan büyük bir Kıbrıslı diasporası var']
      },
      UN: {
        name: 'Birleşmiş Milletler',
        short: 'BM',
        role: 'Genel Sekreter\'in iyi niyet misyonu ve barış gücü. Görüşmeleri toplar; çözüm dayatamaz.',
        interests: ['Güvenlik Konseyi parametreleri içinde müzakereyle varılan bir çözüm', 'Ara bölgede sükûnet', '1964\'ten beri konuşlu bir misyon için inandırıcı bir çıkış'],
        redlines: ['Ayrılmanın onaylanmasına hayır'],
        leverage: ['Meşruiyet ve tarafları bir araya getirme rolü', 'Sorumluluğu adıyla belirten raporlar'],
        vuln: ['Tarafların ve beş daimi üyenin rızasına bağımlı']
      },
      RU: {
        name: 'Rusya',
        short: 'RUS',
        role: 'Güvenlik Konseyi daimi üyesi; çıkarı Batı\'nın bölünmüş kalmasında ve doğal gaz pazar payını korumakta.',
        interests: ['Ankara ile Batı arasında mesafe', 'Avrupa\'ya daha az rakip gaz arzı', 'NATO altyapısının genişlememesi'],
        redlines: ['Kıbrıs\'ı NATO\'ya sokan bir çözüm'],
        leverage: ['Güvenlik Konseyi vetosu', 'Türkiye ile enerji ve ticaret bağları'],
        vuln: ['2022\'den beri Lefkoşa\'da azalan itibar', 'Adadaki gelişmeleri şekillendirmek için sınırlı araçlar']
      },
      REG: {
        name: 'Bölgesel ortaklar',
        short: 'BÖL',
        role: 'İsrail, Mısır ve Körfez ülkeleri: Kıbrıs\'ın enerji ortakları; her birinin Ankara ile kendine özgü bir ilişkisi var.',
        interests: ['Doğu Akdeniz gazını gelire dönüştürmek', 'Güvenli deniz yolları ve kablolar', 'Öngörülebilir bir Türkiye'],
        redlines: ['Enerji altyapısının aksatılması'],
        leverage: ['İhracat güzergâhı olarak Mısır\'ın LNG tesisleri', 'Ankara\'nın ihtiyaç duyduğu Körfez yatırımları', 'İsrail\'in savunma ve teknoloji bağları'],
        vuln: ['Ankara ile kendi ihtilafları ve yakınlaşmaları', 'Bölgesel savaşlar Kıbrıs dosyasını geri plana itiyor']
      }
    },
    moves: {
      'roc.talks': {
        name: 'Aşamalı çekilme içeren federal anlaşma öner',
        desc: 'BM öncülüğündeki görüşmelerde siyasi eşitliğe dayalı bir federasyon, Kıbrıslı Türklere gaz gelirinden pay ve tarihleri belli, izlenen bir asker çekilmesi öner. Reddedilirse ret de kayda geçmiş olur.'
      },
      'roc.blueprint': {
        name: 'Birleşik Kıbrıs Planı\'nı sun: tek devlet, güvenceli özyönetim, garantörsüz',
        desc: 'Tek egemenlik ve tek vatandaşlık; anayasal güvence altında, kendi kendini yöneten bir Kıbrıs Türk bölgesi; kilit bakanlıklarda eşitlik; mahkeme denetiminde dar kapsamlı bir veto; her adım doğrulama koşuluna bağlı.'
      },
      'roc.security': {
        name: 'Garantilerin yerine süreli bir güvenlik mutabakatı öner',
        desc: 'BM geçiş misyonu, AB hukuk devleti ve sınır misyonu ile bağımsız izleme; yabancı askerlerin tarihleri belli biçimde azaltılması ve bir adım atlanırsa önceki duruma otomatik dönüş (snap-back).'
      },
      'roc.escrow': {
        name: 'Doğrulanmış aşamalarda serbest bırakılan bir çözüm fonunu önceden finanse et',
        desc: 'Mülkiyet tazminatı, kuzeydeki altyapı ve yeniden konuşlanma maliyetleri için ayrılan para emanet hesabında tutulur ve ancak bağımsız doğrulayıcılar her adımı onayladığında ödenir. İş birliği hemen kazandırır; cayma anında bedel ödetir.'
      },
      'roc.property': {
        name: 'Mülkiyet için bir çözüm seçenekleri paketi sun',
        desc: 'Mümkün olan yerde iade, takas, uzun süreli kiralama veya tazminat tahvilleri; kararı bağımsız bir komisyon belirli bir süre içinde verir.'
      },
      'roc.mediators': {
        name: 'Belirli bir takvimle tarafsız arabulucular devreye sok',
        desc: 'İki tarafın da güvendiği bir devletten, anlaşma için bir son tarih ve uygulama için bir son tarih içeren BM çerçevesindeki görüşmelere arabuluculuk etmesini iste; Birleşik Krallık\'ı garantör sıfatıyla sürece dâhil et.'
      },
      'roc.vetolift': {
        name: 'Doğrulanmış adımlar karşılığında dar bir AB–Türkiye ticaret paketinin önünü açmayı öner',
        desc: 'Üzerinde anlaşılan çekilme adımları onaylandığında Lefkoşa\'nın küçük, önceden tanımlanmış ve geri alınabilir bir gümrük ve vize kolaylığı paketine karşı çıkmayacağı sinyalini ver.'
      },
      'roc.referendum': {
        name: 'Üzerinde anlaşılan paketi eşzamanlı referandumlara sun',
        desc: 'Aynı gün iki toplumda aynı soru, sabit eşik, uluslararası gözlemciler. 2004\'ün dersi: kamuoyu güvenlik ve mülkiyet hükümlerinin işlediğini görmeden oylamaya gitme.',
        mit: 'Önce rızayı inşa et: ulusal diyalog, ilk günden görünür faydalar ve kamuoyunun doğrulayabileceği güvenlik hükümleri.'
      },
      'roc.consensus': {
        name: 'Kıbrıslı Rumlar arasında uzlaşı için ulusal diyalog',
        desc: 'Partileri, mülteci derneklerini ve sendikaları teklifin şekillendirilmesine kat; böylece anlaşma oylanmadan önce sahiplenilmiş olur.'
      },
      'roc.tcbenefits': {
        name: 'AB imkânlarını Kıbrıslı Türklere şimdi aç',
        desc: 'Çözümü beklemeden, vatandaş sıfatıyla Kıbrıslı Türkler için sağlık sistemine erişim, yeterliliklerin tanınması, sporda bütünleşme, emekli aylıklarının taşınabilirliği ve AB programları.'
      },
      'roc.crossings': {
        name: 'Yeni geçiş kapıları aç, kontrol noktalarını rahatlat',
        desc: 'Daha fazla geçiş noktası, daha uzun çalışma saatleri; ambulanslar, okul servisleri ve işe gidip gelenler için hızlı şeritler.'
      },
      'roc.greenline': {
        name: 'Yeşil Hat ticaretini "Kıbrıs menşeli" belgelendirmesiyle genişlet',
        desc: 'AB standartlarını karşılayan kuzeyli üreticilerin, akredite laboratuvarlar ve elektronik mühürlerle ürünlerini belgelendirip Cumhuriyet\'in limanları üzerinden satmasına izin ver.'
      },
      'roc.energyoffer': {
        name: 'Geliri emanet hesabında tutulan ortak bir enerji çerçevesi öner',
        desc: 'Tek bir ulusal hidrokarbon kurumu, çözüme kadar emanet hesabında tutulan bir Kıbrıslı Türk gelir payı ve ihtilaflı parsellerdeki riski azaltacak bir teknik heyet.'
      },
      'roc.gas': {
        name: 'Mısır ve büyük şirketlerle gaz ihracatını hızlandır',
        desc: 'Afrodit ve Cronos gazını işletmeci şirketlerle birlikte Mısır\'ın LNG tesislerine ulaştır; böylece gelir ve denizlerin sakin kalmasında çıkarı olan ortaklar yarat.'
      },
      'roc.energyweb': {
        name: 'Enerji Ağı: bölge genelinde enerji bağlarını çoğalt',
        desc: 'Enterkonneksiyon, depolama ve tedarik anlaşmalarını Mısır, İsrail, Ürdün, Körfez ve AB\'ye yay; böylece hiçbir proje tek başına yalıtılamasın.'
      },
      'roc.uspact': {
        name: 'Bir ortaklıklar dizisiyle Amerika Birleşik Devletleri\'ni bağla',
        desc: 'Savunma iş birliği, dönüşümlü erişim, enerji ve finans anlaşmaları; her biri geri alınabilir ve denetlenir. Kalıcı üsler olmadan Washington\'a Cumhuriyet\'in güvenliğinde somut çıkarlar kazandırır.'
      },
      'roc.congress': {
        name: 'Kuzeyi işgal altındaki toprak olarak tanımlayan ABD yasası için girişimde bulun',
        desc: 'İşgale bağlı tespitler, raporlama yükümlülükleri ve koşullu önlemler konusunda Kongre ile çalış.'
      },
      'roc.veto': {
        name: 'İlerleme sağlanana kadar AB vetosunu sürdür',
        desc: 'Kıbrıs konusunda hareket olmadıkça Türkiye için gümrük birliğinin güncellenmesini, vize serbestisini ve AB savunma fonlarına erişimi engelle.'
      },
      'roc.sanctions': {
        name: 'İşgalle bağlantılı kuruluşlara AB yaptırımı için bastır',
        desc: 'İzinsiz sondaj, Maraş veya nüfus yerleştirme faaliyetlerine karışanların AB çerçevesi kapsamında listelenmesini talep et. Oybirliği gerektirir.'
      },
      'roc.echr': {
        name: 'Mahkeme kararlarının icrası için bastır',
        desc: 'Mülkiyet ve insan hakları davalarını sürdür; 2014\'te hükmedilen ve ödenmeyen tazminat konusunda Avrupa Konseyi\'ne baskı yap.'
      },
      'roc.icj': {
        name: 'Deniz hakları konusunda önceden yargı kararı iste',
        desc: 'Herhangi bir olay yaşanmadan önce, Cumhuriyet\'in deniz yetki alanlarına müdahale konusunda tahkime veya danışma görüşü için başvur. Türkiye BM Deniz Hukuku Sözleşmesi\'ne taraf değil; bu da zorunlu kılınabilecek olanı sınırlıyor.'
      },
      'roc.defence': {
        name: 'Savunmayı modernleştir, ortaklarla tatbikat yap',
        desc: 'Hava savunması, karakol gemileri ve gözetleme; Yunanistan, Fransa, İsrail ve Mısır ile ortak tatbikatlar. Amaç kışkırtmadan caydırmak; 1998 füze krizi riski gösteriyor.'
      },
      'roc.fortress': {
        name: 'Kale Kıbrıs: altyapıyı ve sivil savunmayı tahkim et',
        desc: 'Korunaklı komuta ve ikmal noktaları, sığınaklar, gözetleme ağı, siber savunma, enerji ve su rezervleri: kimseyi tehdit etmeden zorlamayı pahalı hâle getir.'
      },
      'roc.cgsp': {
        name: 'İstekli AB devletleriyle egemenlik ortaklığı',
        desc: 'AB\'nin karşılıklı yardım hükmüne (madde 42.7) bir grup üye devletle birlikte uygulamada içerik kazandır: planlama, mevcudiyet, üzerinde anlaşılmış tepkiler.'
      },
      'roc.trilateral': {
        name: 'İsrail–Yunanistan–Kıbrıs mutabakatını derinleştir',
        desc: 'Üçlü iş birliğini enerjinin ötesine, ortak tedarike, siber alana, deniz güvenliğine ve sanayiye taşı.'
      },
      'roc.msc': {
        name: 'Lefkoşa\'da bir Akdeniz İstikrar Konseyi kur',
        desc: 'Deniz emniyeti, enerji enterkonneksiyonu ve çatışma önleme konularında, kurallarını kabul eden tüm kıyı devletlerine açık daimi bir bölgesel forum.'
      },
      'roc.india': {
        name: 'Hindistan ile teknoloji ve koridor ortaklığı',
        desc: 'Denizcilik, teknoloji ve savunma sanayisi bağlantılarıyla Kıbrıs\'ı Hindistan–Orta Doğu–Avrupa koridorunun Akdeniz\'deki düğüm noktası olarak konumlandır.'
      },
      'roc.diaspora': {
        name: 'Diaspora ağını harekete geçir',
        desc: 'Başta ABD, Birleşik Krallık ve Avustralya\'dakiler olmak üzere yurt dışındaki Kıbrıslıları siyasa, hukuk ve medya çalışmaları etrafında örgütle.'
      },
      'roc.narrative': {
        name: 'Bölünmüşlüğün bedeli üzerine kamu diplomasisi',
        desc: 'Kültürel miras kaybını, yerinden edilmeyi ve kayıp şahısları belgele; yeniden birleşmenin iki topluma sağlayacağı ekonomik kazancı ortaya koy.'
      },
      'roc.gulf': {
        name: 'Körfez ülkeleri üzerinden Ankara\'ya sessiz bir kanal aç',
        desc: 'Ankara\'da güvenilen ortaklar aracılığıyla, kamuoyundan uzakta, itibar kurtaran formülleri araştır.'
      },
      'roc.buffer': {
        name: 'Türkiye ile limanlar ve hava sahasında karşılıklılık merdiveni',
        desc: 'Adım adım karşılıklı açılım: enerji dışı ticaretten başlayarak, Türk taşıyıcılarına pratik kolaylıklar karşılığında Türk limanlarının ve hava sahasının Kıbrıs bayraklı trafiğe açılması.'
      },
      'roc.nato': {
        name: 'NATO ortaklığı için başvur',
        desc: 'Daha yakın bağlara doğru bir adım olarak Barış için Ortaklık\'a başvur. Konsensüs gerektirdiği için Türkiye engelleyebilir.'
      },
      'roc.hardline': {
        name: 'Askerler çekilene kadar temasları askıya al',
        desc: 'Çekilme başlayana kadar görüşmeleri ve güven artırıcı önlemleri reddet.'
      },
      'tr.twostate': {
        name: 'İki devletin tanınması için bastır',
        desc: '"KKTC"nin tanınması için kampanya yürüt ve her türlü görüşmenin temeli olarak egemen eşitlikte ısrar et.'
      },
      'tr.reinforce': {
        name: 'Kuzeydeki garnizonu ve üsleri takviye et',
        desc: 'İHA, deniz ve hava tesisleri ekle, kuvvetleri güçlendir.'
      },
      'tr.gunboat': {
        name: 'Cumhuriyet\'in MEB\'indeki sondajlara denizden baskı',
        desc: '2018–2020\'de olduğu gibi seyir duyuruları yayımla, araştırma gemilerini yakından izle ve refakatçi eşliğinde sondaj gemileri gönder.'
      },
      'tr.varosha': {
        name: 'Maraş\'ın daha fazlasını Kıbrıs Türk yönetimi altında aç',
        desc: 'Güvenlik Konseyi\'nin 550 ve 789 sayılı kararlarına aykırı biçimde, çitle çevrili kentin 2020\'deki yeniden açılışını genişlet.'
      },
      'tr.integrate': {
        name: 'Kuzeyi Türkiye\'ye daha sıkı bağla',
        desc: 'Ankara\'ya bağımlılığı derinleştiren ekonomik protokoller, altyapı ve idari uyum.'
      },
      'tr.retaliate': {
        name: 'Lefkoşa\'nın ortaklarına ve projelerine misilleme yap',
        desc: 'NATO–AB iş birliğini engelle, Cumhuriyet ile çalışan şirketlere ve devletlere baskı yap, göçü koz olarak kullan.'
      },
      'tr.cbm': {
        name: 'Güven artırıcı önlemlere izin ver',
        desc: 'Yeni geçiş kapılarının, cep telefonu şebekeleri arası uyumun, elektrik alışverişinin ve ortak projelerin ilerlemesine izin ver.'
      },
      'tr.talks': {
        name: 'Ön koşulsuz olarak BM görüşmelerine dön',
        desc: 'Egemen eşitliğin önceden tanınması talebinden vazgeç ve Crans-Montana\'nın bittiği yerden devam et.'
      },
      'tr.partial': {
        name: 'Sinyal olarak simgesel asker azaltımı',
        desc: 'Karşı tarafın karşılığında ne önerdiğini sınamak için göze görünür bir birliği geri çek.'
      },
      'tr.energydeal': {
        name: 'Kapsayıcı bir Doğu Akdeniz enerji çerçevesine katıl',
        desc: 'İhtilaflı sulara ilişkin teknik bir düzenlemeyi kabul et ve bölgesel enerji iş birliğinde yer al.'
      },
      'tr.accept': {
        name: 'Koşula bağlı, karşılığı verilen çekilme yol haritasını imzala',
        desc: 'Emanet hesabında tutulan ekonomik ve siyasi kazanımlar karşılığında tarihleri belli, doğrulanan bir azaltmayı kabul et; içeride bunu kendi tercihiyle yeniden konuşlanma olarak sun.'
      },
      'tr.withdraw': {
        name: 'Doğrulanmış çekilmeyi tamamla',
        desc: 'Yol haritasını uygula: birlikler takvime uygun ayrılır, tesisler devredilir, doğrulayıcılar onaylar, kazanımlar serbest bırakılır.',
        commitNote: 'İmzalanan yol haritasıyla bağlı. Yürürlükteki her taahhüt mekanizması sözünden dönmenin bedelini artırır: emanet hesabındaki fonlar, otomatik geri dönüş içeren güvenlik mutabakatı, BM yetkisiyle yürütülen geçiş ve AB dilimleri.'
      },
      'tc.federal': {
        name: 'Siyasi eşitliğe dayalı federal bir öneri sun',
        desc: 'Etkin katılım ve bir takvim içeren iki bölgeli, iki toplumlu bir federasyon önerisi ortaya koy.'
      },
      'tc.cbm': {
        name: 'Geçiş kapıları ve ortak hizmetler aç',
        desc: 'Yeni geçiş noktaları; sağlık, çevre ve acil durumlarda pratik iş birliği.'
      },
      'tc.greenline': {
        name: 'AB standartlarına uyum sağla, Yeşil Hat ticaretini büyüt',
        desc: 'Mal ve hizmetlerin AB pazarına ulaşabilmesi için AB ürün kurallarını ve belgelendirmesini benimse.'
      },
      'tc.civic': {
        name: 'İki toplumlu sivil platformu destekle',
        desc: 'Bölünme hattının iki yanında birlikte çalışan sendikalar, öğretmenler, ticaret ve sanayi odaları ve gençlik grupları.'
      },
      'tc.property': {
        name: 'Taşınmaz Mal Komisyonu\'nu hızlandır',
        desc: 'Kıbrıslı Rum mülk sahipleri için daha hızlı kararlar ve gerçek iade.'
      },
      'tc.recognition': {
        name: 'Dost devletler aracılığıyla tanınma ve doğrudan uçuş için girişimde bulun',
        desc: 'Daha yüksek bir statü ve doğrudan bağlantılar için Türk Devletleri Teşkilatı ve diğerleri nezdinde lobi yap.'
      },
      'tc.align': {
        name: 'Ankara\'nın çizgisiyle tam uyum sağla',
        desc: 'İki devletli tutumu benimse ve Türkiye ile daha sıkı bütünleşmeyi kabul et.'
      },
      'tc.referendum': {
        name: 'Kıbrıs Türk referandumunda evet için kampanya yürüt',
        desc: 'Üzerinde anlaşılan paket için evet kampanyasına öncülük et.'
      },
      'gr.calm': {
        name: 'Atina–Ankara diyaloğunu canlı tut',
        desc: '2023 Atina Bildirgesi ile başlayan "sakin sular" gündemini sürdür.'
      },
      'gr.defence': {
        name: 'Kıbrıs için ortak savunma planlaması ve hava koruması',
        desc: 'Ortak savunma planlamasını ve göze görünür mevcudiyeti yeniden canlandır.'
      },
      'gr.interconnector': {
        name: 'Great Sea Interconnector\'ı inşa et',
        desc: 'Maliyet anlaşmazlıklarına ve Türkiye\'nin itirazlarına rağmen Girit–Kıbrıs elektrik kablosunu finanse et ve döşe.'
      },
      'gr.linkage': {
        name: 'AB–Türkiye ilerlemesini Kıbrıs\'taki ilerlemeye bağla',
        desc: 'Lefkoşa ile birlikte, savunma fonlarına erişimin ve gümrük birliğinin güncellenmesinin Kıbrıs konusunda hareket olmasına bağlı olduğunda ısrar et.'
      },
      'gr.guarantee': {
        name: 'Garantörlük haklarına son vermeyi ve asker azaltımına karşılık vermeyi öner',
        desc: '1960 garantilerini kaldırmaya ve Yunan birliğini Türkiye ile eş adımlı olarak geri çekmeye hazır olduğunu açıkla.'
      },
      'eu.package': {
        name: 'Ankara\'ya koşullu bir teşvik paketi sun',
        desc: 'Gümrük birliğinin güncellenmesi, vize kolaylığı ve savunma fonlarına erişim; Kıbrıs\'ta doğrulanmış adımlar karşılığında dilimler hâlinde serbest bırakılır.'
      },
      'eu.sanctions': {
        name: 'Hedefli yaptırımlar kabul et',
        desc: 'İzinsiz sondaj, Maraş veya nüfus yerleştirme faaliyetleriyle bağlantılı kuruluşları listele.'
      },
      'eu.tcfund': {
        name: 'Kıbrıslı Türklere yardımı ve onlarla doğrudan teması artır',
        desc: 'Yardım programını, bursları, standartlara uyumu ve AB hukukuna hazırlığı genişlet.'
      },
      'eu.envoy': {
        name: 'BM sürecinin arkasına siyasi ağırlık koy',
        desc: 'Birliğin araçları masadayken BM ile yan yana çalışan, yetkilendirilmiş bir AB temsilcisi.'
      },
      'eu.unconditional': {
        name: 'Kıbrıs koşulu olmadan Ankara ile bağları derinleştir',
        desc: 'Lefkoşa\'nın itirazlarının etrafından dolanarak ticaret, göç ve savunma iş birliğinde ilerle.'
      },
      'eu.defence': {
        name: 'Karşılıklı yardım hükmüne uygulamada içerik kazandır',
        desc: 'Tehdit altındaki bir üye devlet için planlama, denizde mevcudiyet ve üzerinde anlaşılmış tepkiler.'
      },
      'eu.energy': {
        name: 'Doğu Akdeniz enerji bağlarını finanse et',
        desc: 'Adanın enerjideki yalıtılmışlığına son veren enterkonneksiyon, LNG ve hidrojen için hibeler ve teminatlar.'
      },
      'us.pact': {
        name: 'Lefkoşa ile stratejik ortaklık',
        desc: 'Savunma iş birliği, güvenlik yardımı, enerji ve finans bağlantıları.'
      },
      'us.condition': {
        name: 'Silah satışlarını Kıbrıs\'taki adımlara bağla',
        desc: 'Uçak teslimatlarını, modernizasyonları ve programlara yeniden kabulü doğrulanabilir adımlara bağla.'
      },
      'us.sanctions': {
        name: 'Hedefli listeye almalar ve ihracat kontrolleri',
        desc: 'İşgali sürdüren yetkililere ve şirketlere yönelik dar kapsamlı, geri alınabilir önlemler; her biri bir çıkış yoluyla birlikte.'
      },
      'us.offramp': {
        name: 'Kazanımları emanet hesabında tutulan aşamalı bir çekilme protokolüne hamilik et',
        desc: 'Yeniden imar fonu ve kademeli hafifletme içeren, BM\'ye tescil edilmiş bir takvimin arkasına Amerikan ağırlığını koy.'
      },
      'us.mediate': {
        name: 'Kıbrıs\'ı bölgesel anlaşmalara bağlayan üst düzey arabuluculuk',
        desc: 'Kıbrıs\'ı Ankara\'nın istediği enerji ve güvenlik düzenlemelerine bağlayan, başkanın desteğine sahip bir özel temsilci.'
      },
      'us.transact': {
        name: 'Kıbrıs bağlantısı kurmadan Ankara\'ya öncelik ver',
        desc: 'Başka alanlardaki iş birliği karşılığında silah satışları ve yaptırımların hafifletilmesi.'
      },
      'us.energy': {
        name: 'ABD şirketlerini ve Kıbrıs üzerinden geçen enerji koridorunu destekle',
        desc: 'MEB\'deki Amerikan işletmecilere ve koridor altyapısına diplomatik ve mali destek.'
      },
      'uk.guarantor': {
        name: 'Garantörlük haklarına son vermeye hazır olduğunu açıkla',
        desc: 'Londra\'nın bir çözüm çerçevesinde 1960\'tan gelen rolünden vazgeçeceğini beyan et.'
      },
      'uk.sba': {
        name: 'Çözümün parçası olarak üs toprağı öner',
        desc: '2004\'te ve sonrasında yapılan, üs bölgelerinin yaklaşık yarısını devretme önerisini yenile.'
      },
      'uk.broker': {
        name: 'Güvenlik başlığında arabuluculuk yap',
        desc: 'Kalem sahibi ve garantör rollerini kullanarak iki tarafın da kabul edebileceği bir güvenlik geçişi taslağı hazırla.'
      },
      'uk.ankara': {
        name: 'Ankara ile savunma ticaretini koşulsuz derinleştir',
        desc: 'Kıbrıs\'a atıf yapılmadan uçak satışları ve sanayi iş birliği.'
      },
      'un.convene': {
        name: 'Genişletilmiş bir toplantı düzenle ve tam yetkili bir temsilci ata',
        desc: 'İki tarafı ve üç garantörü bir araya getir, daimi bir temsilci belirle.'
      },
      'un.cbm': {
        name: 'Pratik iş birliğine aracılık et',
        desc: 'Geçiş kapıları, mayın temizleme, mezarlıklar, çevre ve gençlik komiteleri.'
      },
      'un.security': {
        name: 'Yetkiye dayalı bir güvenlik geçişi tasarla',
        desc: 'Garanti sisteminin yerini alacak doğrulama, kolluk ve bir geçiş misyonu.'
      },
      'un.report': {
        name: 'Genel Sekreter raporunda engelleyeni adıyla belirt',
        desc: 'İlerleme sağlanamamasının sorumluluğunu belirli bir tarafa atfet.'
      },
      'ru.shield': {
        name: 'Güvenlik Konseyi\'nde statükoyu koru',
        desc: 'Son tarihlere, tahkime veya Batı öncülüğündeki her türlü misyona karşı çık.'
      },
      'ru.energy': {
        name: 'Ankara ile enerji bağlarını derinleştir',
        desc: 'Türkiye\'ye Batı\'ya karşı bir alternatif sunan nükleer, gaz merkezi ve ödeme düzenlemeleri.'
      },
      'ru.north': {
        name: 'Kuzeydeki varlığını genişlet',
        desc: 'Kuzeyde yaşayan Ruslar için konsolosluk hizmetleri ve ticari bağlantılar.'
      },
      'ru.support': {
        name: 'Kıbrıs\'ın bağlantısızlığı karşılığında BM parametrelerini destekle',
        desc: 'Adayı NATO dışında tutan bir çözümü destekle.'
      },
      'reg.trilateral': {
        name: 'Üçlü formatları kalıcı hâle getir',
        desc: 'Kıbrıs–Yunanistan–İsrail ve Kıbrıs–Yunanistan–Mısır formatları için daimi sekretaryalar ve güvenlik iş birliği.'
      },
      'reg.gas': {
        name: 'Kıbrıs gazını Mısır üzerinden pazara ulaştır',
        desc: 'Mısır\'daki işleme ve LNG tesislerine uzanan boru hatları.'
      },
      'reg.inclusive': {
        name: 'Türkiye\'yi koşullu olarak gaz forumuna davet et',
        desc: 'Mevcut deniz anlaşmalarına saygı karşılığında bölgesel enerji iş birliğinde bir sandalye.'
      },
      'reg.mediate': {
        name: 'Ankara ile Lefkoşa arasında arka kanal işlet',
        desc: 'Kamuoyunun gözünden uzakta, Körfez\'in veya Mısır\'ın iyi niyet girişimleri.'
      },
      'reg.normalise': {
        name: 'Ankara ile normalleşmeyi öne al',
        desc: 'Türkiye ile ikili ilişkileri onar ve Kıbrıs ortaklığının önceliğini düşür.'
      },
      'reg.corridor': {
        name: 'Koridoru ve veri kablolarını Kıbrıs\'a demirle',
        desc: 'Hindistan–Orta Doğu–Avrupa altyapısını ada üzerinden geçir.'
      },
      'roc.bez': {
        name: 'İki toplumlu bir ekonomik bölge oluştur',
        desc: 'Hattın iki yanına uzanan, AB destekli ortak bir bölge; tek bir hukuki rejim ve yatırımcılar için teşvikler içerir, geliri de hizmetler ve altyapı için iki toplum arasında eşit paylaşılır.'
      },
      'roc.neutral': {
        name: 'Uluslararası güvenceli kalıcı tarafsızlık öner',
        desc: 'Yeniden birleşmiş bir Kıbrıs, yabancı askerin bulunmadığı tarafsız bir devlet olur; güvenliği çok taraflı bir antlaşmayla güvence altına alınır ve geçiş döneminde uluslararası barış gücü askerlerince izlenir.'
      },
      'roc.pact': {
        name: 'Türkiye\'nin AB sürecine bağlı bir saldırmazlık paktı öner',
        desc: 'Kıbrıs ve Türkiye toprak taleplerinden ve güç kullanımından vazgeçer; karşılığında Lefkoşa, yeniden birleşmenin ilerlemesi koşuluyla, Ankara\'nın katılım müzakerelerinin yeniden açılmasını destekler.'
      },
      'roc.culture': {
        name: 'İki toplumlu eğitim ve kültür değişimleri başlat',
        desc: 'AB desteğiyle iki yönlü dil öğrenimi, ortak okul projeleri, ortak miras çalışmaları ve değişim programları; böylece gelecek kuşak diğer toplumu tanıyarak büyür.'
      }
    },
    precedents: {
      annan: {
        name: 'Annan Planı referandumları',
        lesson: 'Kapsamlı bir BM planı, AB\'ye katılımdan bir hafta önce Kıbrıslı Türklerin %65\'i tarafından onaylandı, Kıbrıslı Rumların %76\'sı tarafından reddedildi. Sonucu güvenlik, mülkiyet ve hayır oyu vermenin hiçbir bedelinin olmaması belirledi: bir anlaşma, oylamadan önce iki halk tarafından da sahiplenilmiş olmalı.'
      },
      crans: {
        name: 'Crans-Montana konferansı',
        lesson: 'Tarafların çözüme en çok yaklaştığı an. Garantiler ve askerler yüzünden çöktü: Türkiye ilk günden itibaren sıfır askeri ve müdahale hakkının olmamasını kabul etmedi. Güvenlik, ertelenmesi değil çözülmesi gereken başlıktır.'
      },
      crossings: {
        name: 'Geçiş kapılarının açılması',
        lesson: '29 yıl sonra hat açıldı ve ardından ciddi bir olay yaşanmadan milyonlarca geçiş gerçekleşti. Temas güvenli ve rağbet görüyor; ancak tek başına bir çözüm getirmedi.'
      },
      greenline: {
        name: 'Yeşil Hat Tüzüğü',
        lesson: 'Hat üzerinden yasal ticaret var, ancak standartlar, lojistik ve iki taraftaki siyasi isteksizlik nedeniyle küçük kalıyor. Ekonomik köprüler yalnızca izin değil, etkin yönetim gerektirir.'
      },
      cmp: {
        name: 'Kayıp Şahıslar Komitesi',
        lesson: 'BM başkanlığındaki iki toplumlu bir organ, her iki toplumdan 1.000\'den fazla kayıp kişinin kimliğini belirledi. Siyasetten yalıtılmış insani iş birliği onlarca yıl işleyebilir.'
      },
      loizidou: {
        name: 'Loizidou/Türkiye davası',
        lesson: 'Avrupa İnsan Hakları Mahkemesi (AİHM), Kıbrıslı Rum bir mülk sahibinin mülküne erişiminin engellenmesinden Türkiye\'yi sorumlu tuttu; Ankara 2003\'te ödeme yaptı. Dava yolu sorumluluğu saptar ve bir bedeli olur, ancak mülkü geri getirmedi.'
      },
      cyvtr: {
        name: 'Kıbrıs/Türkiye davası, adil tazmin',
        lesson: 'Mahkeme, kayıplar ve mahsur kalanlar için 90 milyon avroya hükmetti. Bu tutar hâlâ ödenmedi: kararlar maliyeti ve itibar zararını artırır, ancak kararlı bir devlete karşı icra zayıftır.'
      },
      demopoulos: {
        name: 'Demopoulos/Türkiye davası',
        lesson: 'Mahkeme, kuzeydeki Taşınmaz Mal Komisyonu\'nu bir iç hukuk yolu olarak kabul etti. Hukuki strateji, davacının amaçlamadığı sonuçlar doğurabilir.'
      },
      udi: {
        name: 'Tek taraflı bağımsızlık ilanı',
        lesson: 'Güvenlik Konseyi\'nin 541 sayılı kararı bunu hukuken geçersiz ilan etti; kırk yıl sonra onu yalnızca Türkiye tanıyor. Tek taraflı statü değişiklikleri kabul görmedi.'
      },
      ots: {
        name: 'Türk Devletleri Teşkilatı\'nda gözlemci statüsü',
        lesson: 'Simgesel kazanımlar elde edilebiliyor, ancak 2025\'te Orta Asyalı üyeler AB ile ortak bir bildiride BM kararlarını yeniden teyit etti. Tanınma kampanyaları bir tavana çarpıyor.'
      },
      varosha: {
        name: 'Maraş\'ın kısmen yeniden açılması',
        lesson: 'Sahil şeridinin açılması Güvenlik Konseyi\'nin kınamasına yol açtı ve Kıbrıslı Türklerin konumunu iyileştirmeden Kıbrıslı Rum kamuoyunu sertleştirdi.'
      },
      yavuz: {
        name: 'MEB\'de sondaj gemisi gerginliği',
        lesson: 'Türk savaş gemileri 2018\'de bir sondaj gemisini engelledi ve Türk gemileri Kıbrıs\'ın hak iddia ettiği sularda sondaj yaptı. AB yaptırımları asgari düzeyde kaldı; baskı ancak Ankara 2021\'de AB ile gerginliği azaltmayı seçtiğinde hafifledi.'
      },
      eusanc19: {
        name: 'Sondajlara ilişkin AB yaptırım çerçevesi',
        lesson: 'Çerçeve mevcut, ancak yalnızca iki kişi listelendi. Oybirliği, Türkiye\'ye yönelik AB yaptırımlarının alınmasını zor, sulandırılmasını kolay kılıyor.'
      },
      s300: {
        name: 'S-300 füze krizi',
        lesson: 'Kıbrıs, Rus yapımı hava savunma füzeleri sipariş etti; Türkiye bunları vurmakla tehdit etti; füzeler sonunda Girit\'e yerleştirildi. Güçlü tarafın dengede değişiklik olarak okuduğu silah alımları caydırmak yerine kışkırtabilir.'
      },
      itar: {
        name: 'ABD\'nin Kıbrıs\'a yönelik silah kısıtlamalarının kaldırılması',
        lesson: 'Sabırlı bir uyum süreci — liman erişim kuralları, mali reformlar, Kongre\'de yasama — 1987 tarihli bir ambargoya son verdi. Washington nezdinde itibar adım adım inşa edilebilir.'
      },
      embargo75: {
        name: 'ABD\'nin Türkiye\'ye silah ambargosu',
        lesson: 'Kongre, istilanın ardından silah satışlarını kesti. Türkiye ABD üslerini kapattı ve çekilmedi; ambargo üç yıl içinde kaldırıldı. Çıkış rampası sunmayan kaba baskı, tutumları katılaştırdı.'
      },
      helsinki: {
        name: 'Helsinki zirvesi ve deprem diplomasisi',
        lesson: 'İnandırıcı bir AB üyelik perspektifi ve Yunan–Türk yakınlaşması, Türkiye\'nin Kıbrıs konusunda onlarca yılın en esnek tutumunu (2002–2004) doğurdu. Teşvikler, inanıldıklarında Ankara\'yı harekete geçirir.'
      },
      f16: {
        name: 'F-16 satışı ve İsveç\'in NATO\'ya katılımı',
        lesson: 'Ankara İsveç\'in üyeliğini onayladı, Washington da günler sonra F-16 satışına onay verdi. Türkiye ile al-ver esaslı bağlantı kurma, iki taraf da kazanç ilan edebildiğinde işe yarıyor.'
      },
      brunson: {
        name: 'Brunson\'ın tutukluluğu nedeniyle yaptırımlar',
        lesson: 'ABD\'nin iki bakana yönelik yaptırımlarını ve gümrük tarifesi önlemlerini lirada sert bir düşüş izledi; rahip aylar içinde serbest bırakıldı ve yaptırımlar kaldırıldı. Açık bir talep içeren dar kapsamlı, geri alınabilir önlemler sonuç verdi.'
      },
      caatsa: {
        name: 'S-400 alımı nedeniyle CAATSA yaptırımları',
        lesson: 'Türkiye\'nin savunma tedarik kurumuna yönelik yaptırımlar ve F-35 programından çıkarılma gerçek bir maliyet getirdi, ama S-400\'ler yerinde kaldı. Kabul edilebilir bir çıkış yolu sunulmadıkça baskı, egemenlik ve prestije bağlanmış bir kararı geri çevirmez.'
      },
      twoplusfour: {
        name: 'Almanya\'nın yeniden birleşmesi ve Sovyet çekilmesi',
        lesson: 'Yaklaşık 340.000 Sovyet askeri dört yıllık bir takvimle Doğu Almanya\'dan ayrıldı; Almanya konut ve geçiş için milyarlarca mark ödedi. Büyük bir ordu, bir takvim içinde, onurlu ve karşılığı verilen bir çekilmeyle evine dönmeye ikna edildi.'
      },
      baltic: {
        name: 'Rus askerlerinin Baltık devletlerinden çekilmesi',
        lesson: 'Batı\'nın onlarca yıl süren tanımama politikası hukuki konumu korudu; çekilme, daha büyük güç Batı\'nın iş birliğini istediğinde ve konut yardımı ile itibar kurtaran koşullar elde ettiğinde gerçekleşti.'
      },
      camp: {
        name: 'Camp David ve Sina\'dan çekilme',
        lesson: 'İsrail Sina\'dan aşamalar hâlinde çekildi; her aşamaya Mısır\'ın adımları karşılık geldi; ABD güvenceleri ve yardımı ile hâlâ görev yapan çok uluslu bir gözlemci gücü süreci destekledi. Aşamalandırma, doğrulama ve büyük bir gücün hamiliği çekilmeyi kabul edilebilir kıldı.'
      },
      gfa: {
        name: 'Hayırlı Cuma Anlaşması',
        lesson: 'Güç paylaşımı, toplumlar arası rıza ve kuzeyde ve güneyde eşzamanlı referandumlar otuz yıllık bir çatışmaya son verdi. İki halk da evet dedi, çünkü iki hükûmet ve dışarıdan bir hami bunun için kampanya yürüttü.'
      },
      aland: {
        name: 'Åland Adaları özerkliği',
        lesson: 'Egemenlik Finlandiya\'da kaldı; dil, kültür ve özyönetim ise uluslararası güvenceye bağlandı ve adalar askerden arındırıldı. Tek devlet içinde güvence altına alınmış özerklik bir yüzyıldır sürüyor.'
      },
      tyrol: {
        name: 'Güney Tirol özerklik paketi',
        lesson: 'İtalya ayrıntılı bir özerklik paketini önlem önlem uyguladı; Avusturya ihtilafın kapandığını ancak son önlem de tamamlandığında ilan etti. Ölçüt ölçüt uygulama, sözlerin kuramadığı güveni kurdu.'
      },
      lebanon: {
        name: 'İsrail–Lübnan deniz sınırı anlaşması',
        lesson: 'Teknik olarak savaş hâlindeki iki devlet, birbirini tanımadan, ABD arabuluculuğu ve bir gelir düzenlemesiyle bir gaz ihtilafını çözdü. Enerji anlaşmalarına, önce siyasi ihtilaf çözülmeden de varılabilir.'
      },
      minsk: {
        name: 'Minsk anlaşmaları',
        lesson: 'Sıralama muğlaktı, doğrulama zayıftı ve uymamanın hiçbir bedeli olmadı. Otomatik sonuçları olmayan anlaşmalar çürür.'
      },
      dayton: {
        name: 'Dayton Anlaşması',
        lesson: 'Savaş sona erdi, ancak her düzeydeki etnik vetolar herhangi bir karar almakta zorlanan bir devlet ortaya çıkardı. Güç paylaşımı, kilitlenmeyi aşan kurallar gerektirir.'
      }
    },
    topics: {
      talks: 'Çözüm görüşmeleri',
      security: 'Garantiler ve güvenlik düzenlemeleri',
      troops: 'Adadaki Türk kuvvetleri',
      property: 'Mülkiyet ve mülteciler',
      cbm: 'Geçiş kapıları ve güven artırma',
      trade: 'Ticaret ve Kıbrıs Türk ekonomisi',
      gas: 'Açık deniz doğal gazı',
      grid: 'Enerji bağlantıları ve enterkonnektör',
      euturkey: 'AB–Türkiye ilişkileri',
      sanctions: 'Türkiye\'ye yaptırımlar',
      uscyprus: 'Amerika Birleşik Devletleri–Kıbrıs ortaklığı',
      usturkey: 'Amerika Birleşik Devletleri–Türkiye ilişkileri',
      courts: 'Mahkemeler ve hukuki girişimler',
      maritime: 'Deniz yetki alanları ve deniz olayları',
      varosha: 'Maraş',
      recognition: 'İki devlet girişimi ve tanınma',
      defence: 'Cumhuriyet\'in savunması',
      regional: 'Bölgesel ortaklıklar',
      greeceturkey: 'Yunanistan–Türkiye diyaloğu',
      britain: 'Birleşik Krallık ve üsler',
      un: 'Birleşmiş Milletler süreci',
      russia: 'Rusya\'nın rolü',
      society: 'Kamuoyu ve sivil toplum'
    }
  };
})(typeof self !== 'undefined' ? self : this);
