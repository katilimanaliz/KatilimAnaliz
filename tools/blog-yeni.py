#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/blog-yeni.py

Uygulamaya son eklenen araçlara karşılık gelen blog yazılarını üretir:
    public/blog/<slug>/index.html  (mevcut yazı şablonuyla aynı görünüm)
    public/blog/index.html          ("Güncel Konular" bölümüne kartlar)
    public/sitemap.xml              (yeni adresler + blog dizin tarihi)
Tekrar çalıştırılabilir (idempotent). Örnek sayılar kodda hesaplanır; sabit oran/stopaj iddiası içermez.
"""
import os, re, json
from datetime import date
from html import escape as E

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(KOK, "public")
SITE = "https://www.katilimplus.com"
BUGUN = date.today()
AY = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
TARIH_YAZI = f"{AY[BUGUN.month]} {BUGUN.year}"


def tl(v):
    return f"{v:,.0f}".replace(",", ".")


def yz(v, n=2):
    return f"{v:.{n}f}".replace(".", ",")


def taksit(P, aylik, n):
    i = aylik / 100.0
    return P * i * (1 + i) ** n / ((1 + i) ** n - 1)


def pv_taksitler(t, aylik, n):
    i = aylik / 100.0
    return t * (1 - (1 + i) ** -n) / i


def irr_aylik(net, t, n):
    lo, hi = 0.0001, 0.5
    for _ in range(200):
        m = (lo + hi) / 2
        if pv_taksitler(t, m * 100, n) > net:
            lo = m
        else:
            hi = m
    return m * 100


# ── Örnek hesaplar ───────────────────────────────────────────────────────────
# 1) Erken kapama
EK_T, EK_N, EK_R = 30_000, 24, 3.0
EK_PV = pv_taksitler(EK_T, EK_R, EK_N)
EK_KAPAMA = 480_000
EK_UCRET = EK_KAPAMA * 0.01
EK_TOP = EK_KAPAMA + EK_UCRET
EK_FARK = EK_PV - EK_TOP

# 4) Teklif karşılaştırma
TA_P, TA_N = 500_000, 36
TA_A_R = 3.00
TA_B_R, TA_B_MASRAF = 2.90, 0.02
TA_A_T = taksit(TA_P, TA_A_R, TA_N)
TA_B_T = taksit(TA_P, TA_B_R, TA_N)
TA_B_NET = TA_P * (1 - TA_B_MASRAF)
TA_A_TOP, TA_B_TOP = TA_A_T * TA_N, TA_B_T * TA_N
TA_B_GERCEK = irr_aylik(TA_B_NET, TA_B_T, TA_N)

# 6) Vade farkı
VF_PESIN, VF_VADELI, VF_AY = 100_000, 118_000, 6
VF_AYLIK = ((VF_VADELI / VF_PESIN) ** (1 / VF_AY) - 1) * 100
VF_YILLIK = ((VF_VADELI / VF_PESIN) ** (12 / VF_AY) - 1) * 100

# ── Yazılar ──────────────────────────────────────────────────────────────────
YAZILAR = [
    dict(
        slug="krediyi-erken-kapatmak-mantikli-mi", etiket="Finansman", okuma=6,
        baslik="Krediyi Erken Kapatmak Mantıklı mı? Bugünkü Değerle Hesaplama",
        kisa_baslik="Krediyi Erken Kapatmak Mantıklı mı?",
        desc="Finansmanı erken kapatmak mı, parayı değerlendirmek mi avantajlı? Erken kapama ücreti ve ödemelerin bugünkü değeriyle örnekli hesaplama.",
        kart="Erken kapama ücreti, bugünkü değer mantığı ve refinansman kararı, örnek hesapla.",
        arac=("/erken-kapama-karari", "Krediyi Erken Kapatmalı mıyım? Aracını Aç →", "Kalan taksitlerinizi ve elinizdeki parayı girin; erken kapamanın size ne kazandırdığını görün."),
        govde=f"""
  <p>Elinize bir miktar para geçti ve devam eden bir finansmanınız var. Borcu erken kapatmak mı, parayı katılma hesabı gibi bir yerde değerlendirip taksite devam etmek mi daha kârlı? Cevap, <strong>kalan taksitlerin bugünkü değeri</strong> ile <strong>bugün ödeyeceğiniz kapama tutarını</strong> karşılaştırmaktan geçer.</p>

  <h2>Temel mantık: Bugünkü değer</h2>
  <p>Gelecekte ödeyeceğiniz taksitlerin her biri, bugünkü parayla daha az değerlidir; çünkü o parayı bugün başka bir yerde değerlendirebilirsiniz. Kalan taksitleri, <em>alternatif olarak kazanabileceğiniz (ya da yeni borçlanmanın maliyeti olan) aylık oranla</em> bugüne indirgeyin:</p>
  <ul>
    <li>Bugünkü değer, kapama tutarınızdan <strong>yüksekse</strong> erken kapamak avantajlıdır; çünkü taksitlerin gerçek yükü ödeyeceğiniz paradan fazladır.</li>
    <li>Bugünkü değer kapama tutarınızdan <strong>düşükse</strong> taksitlere devam edip parayı değerlendirmek daha mantıklıdır.</li>
  </ul>

  <h2>Örnek hesap</h2>
  <div class="ornek">
    Kalan <strong>{EK_N} taksitiniz</strong> var, aylık taksit <strong>{tl(EK_T)} TL</strong>. Aynı parayı aylık <strong>%{yz(EK_R,1)}</strong> getiriyle değerlendirebildiğinizi varsayalım.<br><br>
    Kalan taksitlerin bugünkü değeri ≈ <strong>{tl(EK_PV)} TL</strong>.<br>
    Banka kapama tutarını {tl(EK_KAPAMA)} TL olarak bildirdi ve %1 erken kapama ücreti ({tl(EK_UCRET)} TL) alıyor; toplam <strong>{tl(EK_TOP)} TL</strong>.<br><br>
    Fark: {tl(EK_PV)} − {tl(EK_TOP)} ≈ <strong>{tl(EK_FARK)} TL</strong> lehinize. Bu varsayımlarla erken kapamak avantajlı.
  </div>
  <p>Aynı örnekte alternatif getiriniz çok daha yüksek olsaydı bugünkü değer düşer, fark kapanır ve hatta tersine dönerdi. Bu yüzden sonuç, sizin için gerçekçi olan aylık oran varsayımına bağlıdır.</p>

  <h2>Erken kapama ücreti</h2>
  <p>Konut finansmanında mevzuat, erken kapama ücretine bir üst sınır koyar: kalan vade <strong>36 ay ve altındaysa %1</strong>, daha uzunsa <strong>%2</strong> (kalan anapara üzerinden). Bankanız daha düşük uygulayabilir. Taşıt, ihtiyaç ve ticari finansmanda ücret hükmü ürüne ve sözleşmeye göre değişir; sözleşmenizdeki ilgili maddeye bakın.</p>
  <div class="uyari">Murabahada satış bedeli ve kâr payı baştan kesinleşir; erken ödemede kalan kâr payından indirim yapılması çoğu zaman bankanın takdirindedir. Kapama tutarını mutlaka bankanızdan yazılı olarak isteyin.</div>

  <h2>Refinansman: Başka bankayla kapatmak</h2>
  <p>Daha düşük oranlı yeni bir finansmanla eskisini kapatmayı düşünüyorsanız, yeni finansmanın tahsis, sigorta ve ekspertiz gibi masraflarını da eklemelisiniz. Karşılaştırmayı yeni finansmanın <em>gerçek aylık maliyeti</em> (masraflar dahil) üzerinden yapın. Bunun nasıl hesaplandığını <a href="/blog/banka-finansman-teklifleri-nasil-karsilastirilir/">teklif karşılaştırma yazımızda</a> anlatıyoruz.</p>
""",
        sss=[
            ("Krediyi erken kapatmak her zaman kârlı mı?", "Hayır. Kalan taksitlerin bugünkü değeri, ödeyeceğiniz kapama tutarından ve ücretten yüksekse kârlıdır. Parayı daha yüksek getiriyle değerlendirebiliyorsanız taksite devam etmek avantajlı olabilir."),
            ("Konut finansmanında erken kapama ücreti ne kadar?", "Mevzuattaki üst sınır, kalan vade 36 ay ve altındaysa %1, daha uzunsa %2'dir. Bankanız daha düşük bir oran uygulayabilir."),
            ("Hangi oranla bugüne indirgemeliyim?", "Parayı gerçekçi olarak değerlendirebileceğiniz (örneğin katılma hesabı net getirisi) ya da yeni borçlanmanın maliyeti olan aylık oranı kullanın."),
        ],
        ilgili=["murabaha-nedir", "kredi-kullandirim-komisyonu-nedir", "katilma-hesabi-getirisi-adim-adim-hesaplama"],
    ),
    dict(
        slug="tcmb-gosterge-kuru-nedir", etiket="Piyasa Göstergesi", okuma=4,
        baslik="TCMB Gösterge Kuru Nedir, Ne Zaman Açıklanır, Hangi Gün Geçerli?",
        kisa_baslik="TCMB Gösterge Kuru Nedir?",
        desc="TCMB döviz kurları ne zaman açıklanır, hangi gün için geçerli? Alış-satış kuru, makas ve parite kavramlarını örneklerle anlatıyoruz.",
        kart="Kurlar saat kaçta açıklanır, hangi güne geçerli? Alış-satış ve parite kavramları.",
        arac=("/tcmb-kur-izleme", "TCMB Kur İzleme Ekranını Aç →", "Güncel TCMB kurlarını, paritelerini ve geçmiş günlerin kurlarını tek ekranda izleyin."),
        govde="""
  <p>Faturalarda, değerlemelerde ve sözleşmelerde sık sık "TCMB kuru" ifadesiyle karşılaşırsınız. Bu kurun ne zaman açıklandığı ve <strong>hangi gün için geçerli olduğu</strong> ise çoğu zaman karıştırılır.</p>

  <h2>Gösterge kuru nedir?</h2>
  <p>Türkiye Cumhuriyet Merkez Bankası (TCMB), belirli para birimleri için <strong>gösterge niteliğinde</strong> alış ve satış kurlarını her iş günü yayımlar. Bunlar bankaların işlemde uygulayacağı kurlar değil, referans niteliğindeki kurlardır.</p>

  <h2>Saat kaçta açıklanır, hangi gün geçerli?</h2>
  <ul>
    <li>Kurlar iş günlerinde <strong>saat 15:30'da</strong> açıklanır.</li>
    <li>Açıklanan kur, <strong>bir sonraki iş günü</strong> için geçerli olur.</li>
    <li>Bu yüzden cuma günü açıklanan kur, pazartesi günü için geçerlidir; hafta sonu yeni kur yayımlanmaz.</li>
  </ul>
  <div class="ornek">
    Perşembe günü 15:30'da yayımlanan kurlar <strong>cuma günü</strong> için geçerlidir. Perşembe akşamı "bugünün kuru" diye baktığınız değer, aslında ertesi günün kurudur.
  </div>

  <h2>Alış, satış ve makas</h2>
  <p><strong>Alış kuru</strong> bankanın sizden döviz alırken, <strong>satış kuru</strong> size döviz satarken kullandığı kurdur. İkisi arasındaki farka <strong>makas</strong> denir. TCMB gösterge kuru referanstır; bankalar işlemde kendi kurlarını ve makaslarını uygulayabilir. Efektif (banknot) kurları döviz kurlarından ayrı yayımlanır.</p>

  <h2>Parite nedir?</h2>
  <p>Parite, iki yabancı para biriminin birbirine oranıdır; örneğin EUR/USD. TCMB, kurlardan hesaplanan çapraz kurları da yayımlar. Dolar ve euro cinsinden çalışan işletmeler için bu oran, hangi para biriminde borçlanmanın ya da tahsilatın avantajlı olduğunu görmeye yardımcı olur.</p>

  <h2>Neden önemli?</h2>
  <ul>
    <li>Döviz cinsi alacak ve borçların TL değerlemesinde referans olarak kullanılabilir.</li>
    <li>İhracat, ithalat ve döviz cinsi finansman kararlarında kur varsayımının başlangıç noktasıdır.</li>
    <li>Hedef kur alarmıyla, belirlediğiniz seviyeye gelen kuru kaçırmazsınız.</li>
  </ul>
  <p>Kurun nasıl oluştuğuna dair temel kavramlar için <a href="/sozluk/doviz-kuru.html">Döviz Kuru</a> ve <a href="/sozluk/kur.html">Kur</a> sözlük sayfalarına bakabilirsiniz.</p>
""",
        sss=[
            ("TCMB kurları saat kaçta açıklanır?", "Gösterge niteliğindeki döviz kurları iş günlerinde saat 15:30'da açıklanır."),
            ("Açıklanan kur hangi gün için geçerli?", "Bir sonraki iş günü için. Cuma günü açıklanan kur pazartesi için geçerlidir."),
            ("TCMB kuru ile bankanın kuru aynı mı?", "Hayır. TCMB kuru referanstır; bankalar işlemde kendi alış-satış kurlarını uygulayabilir."),
        ],
        ilgili=["tlref-nedir-nasil-hesaplanir", "enflasyon-korumali-katilma-hesabi-nedir"],
    ),
    dict(
        slug="zorunlu-karsilik-nedir-bankalari-nasil-etkiler", etiket="Piyasa Göstergesi", okuma=5,
        baslik="Zorunlu Karşılık Nedir? Bankaları ve Finansman Maliyetini Nasıl Etkiler?",
        kisa_baslik="Zorunlu Karşılık Nedir?",
        desc="Zorunlu karşılık nedir, TCMB neden değiştirir? Bankaların kullandırabileceği fonu ve finansman maliyetini nasıl etkilediğini örnekle anlatıyoruz.",
        kart="TCMB'nin bu aracı bankaların fon maliyetini ve kullandırımını nasıl etkiler?",
        arac=("/arac/banka-finansman-karsilastirma/", "Banka Finansman Karşılaştırmayı Aç →", "Katılım bankalarının finansman oranlarını aynı tutar ve vadede yan yana görün."),
        govde="""
  <p>Merkez Bankası'nın para politikası araçları arasında en çok duyulanlardan biri <strong>zorunlu karşılık</strong>tır. Bankaların topladığı fonu ne kadar kullandırabileceğini doğrudan etkilediği için, dolaylı olarak finansman maliyetlerine de yansır.</p>

  <h2>Zorunlu karşılık nedir?</h2>
  <p>Bankalar, topladıkları mevduat ve katılma hesabı gibi yükümlülüklerin belirli bir yüzdesini Merkez Bankası'nda tutmak zorundadır. Bu yüzdeye <strong>zorunlu karşılık oranı</strong> denir. Tutulan kısım bankanın kullanımına açık değildir.</p>
  <div class="ornek">
    <strong>Varsayımsal örnek:</strong> Bir banka 100 TL fon topluyor ve zorunlu karşılık oranı %10 olsun. Banka 10 TL'yi Merkez Bankası'nda tutar; kredi ya da finansman olarak kullandırabileceği tutar 90 TL ile sınırlı kalır. Oran %20'ye çıkarsa kullandırılabilir tutar 80 TL'ye düşer.
  </div>

  <h2>Merkez Bankası bu aracı neden kullanır?</h2>
  <ul>
    <li><strong>Kredi büyümesini yavaşlatmak:</strong> Oran artırılınca bankaların kullandırabileceği fon azalır.</li>
    <li><strong>Likiditeyi yönetmek:</strong> Piyasada fazla likidite varsa bir kısmı karşılık olarak çekilebilir.</li>
    <li><strong>Para birimi tercihini yönlendirmek:</strong> Oranlar vadeye ve para birimine (TL, döviz) göre farklılaştırılabilir; böylece belirli hesap türleri teşvik edilir ya da caydırılır.</li>
  </ul>

  <h2>Finansman maliyetine etkisi</h2>
  <p>Bankanın topladığı fonun bir kısmı atıl kaldığında, o kısmın maliyetini de kullandırdığı fonun fiyatına yansıtması gerekir. Bu nedenle zorunlu karşılık oranlarındaki artış, diğer koşullar sabitken finansman oranlarını yukarı çekme eğilimindedir. Etki doğrudan ve anlık değildir; bankanın fon yapısına, rekabete ve piyasa koşullarına bağlıdır.</p>

  <h2>Katılım bankaları açısından</h2>
  <p>Katılım bankaları da katılma hesaplarını ve topladıkları fonları belirli oranlarda karşılık olarak tutar. Bu nedenle karşılık oranlarındaki değişiklik katılım bankalarının kullandırabileceği fon miktarını ve dolayısıyla kâr payı oranlarını etkileyebilir.</p>

  <div class="uyari">Zorunlu karşılık oranları sık değişir ve vade, para birimi ve hesap türüne göre kademelidir. Güncel oranlar için Merkez Bankası duyurularına bakın.</div>
  <p>Kavramın kısa tanımı için <a href="/sozluk/zorunlu-karsilik.html">sözlükteki zorunlu karşılık sayfasına</a> bakabilirsiniz.</p>
""",
        sss=[
            ("Zorunlu karşılık nedir?", "Bankaların topladığı fonun belirli bir yüzdesini Merkez Bankası'nda tutma yükümlülüğüdür."),
            ("Zorunlu karşılık artınca ne olur?", "Bankaların kullandırabileceği fon azalır; bu durum kredi büyümesini yavaşlatır ve diğer koşullar sabitken finansman maliyetini artırma eğilimi taşır."),
            ("Oranlar herkes için aynı mı?", "Hayır. Vadeye, para birimine ve hesap türüne göre farklılaşabilir."),
        ],
        ilgili=["katilim-bankasi-nedir", "tlref-nedir-nasil-hesaplanir"],
        ek_link=[("/kar-payi-oranlari/", "Güncel kâr payı ve finansman oranları")],
    ),
    dict(
        slug="banka-finansman-teklifleri-nasil-karsilastirilir", etiket="Finansman", okuma=6,
        baslik="Banka Finansman Tekliflerini Nasıl Karşılaştırırsınız? Gerçek Maliyet Hesabı",
        kisa_baslik="Finansman Teklifleri Nasıl Karşılaştırılır?",
        desc="İki finansman teklifini oranına bakarak değil, masraflar dahil gerçek aylık maliyetine göre karşılaştırın. Örnekli hesapla adım adım anlatım.",
        kart="Oran düşük olsa da masraf yüksekse teklif pahalı çıkabilir; gerçek maliyet nasıl bulunur?",
        arac=("/taksit-karsilastirma", "Banka Finansman Karşılaştırmayı Aç →", "Aynı tutar ve vadede katılım bankalarının taksitlerini yan yana görün."),
        govde=f"""
  <p>Finansman başvurusunda ilk bakılan şey genellikle aylık kâr payı oranıdır. Ancak oranı düşük görünen teklif, tahsis ücreti, sigorta ve ekspertiz gibi masraflarla birlikte düşünüldüğünde daha pahalı çıkabilir. Doğru karşılaştırma <strong>gerçek aylık maliyet</strong> üzerinden yapılır.</p>

  <h2>Karşılaştırmada bakılacak üç şey</h2>
  <ul>
    <li><strong>Taksit ve toplam ödeme:</strong> Aylık taksiti vadeyle çarpın.</li>
    <li><strong>Peşin masraflar:</strong> Tahsis, ekspertiz, sigorta gibi kalemler eline geçen parayı azaltır.</li>
    <li><strong>Vade:</strong> Vade uzadıkça taksit düşer, ama toplam ödeme artar.</li>
  </ul>

  <h2>Örnek: İki teklif</h2>
  <p>{tl(TA_P)} TL'lik finansmanı {TA_N} ay vadeyle kullanacaksınız.</p>
  <table>
    <tr><th></th><th>Teklif A</th><th>Teklif B</th></tr>
    <tr><td>Aylık oran</td><td>%{yz(TA_A_R)}</td><td>%{yz(TA_B_R)}</td></tr>
    <tr><td>Peşin masraf</td><td>Yok</td><td>%2 ({tl(TA_P*TA_B_MASRAF)} TL)</td></tr>
    <tr><td>Aylık taksit</td><td>{tl(TA_A_T)} TL</td><td>{tl(TA_B_T)} TL</td></tr>
    <tr><td>Toplam ödeme</td><td>{tl(TA_A_TOP)} TL</td><td>{tl(TA_B_TOP)} TL</td></tr>
  </table>
  <p>Yalnızca oran, taksit ve toplam ödemeye bakınca Teklif B daha ucuz görünür. Ancak B'de {tl(TA_P*TA_B_MASRAF)} TL masraf peşin kesildiği için elinize <strong>{tl(TA_B_NET)} TL</strong> geçer; yani daha az para alıp neredeyse aynı taksiti ödersiniz. Gerçek maliyeti bulmak için, elinize geçen tutara karşılık ödediğiniz taksitlerin <em>içsel aylık oranına</em> bakılır:</p>
  <div class="ornek">
    Teklif B için içsel (gerçek) aylık maliyet ≈ <strong>%{yz(TA_B_GERCEK)}</strong>. Duyurulan %{yz(TA_B_R)} oranı masraf nedeniyle fiilen %{yz(TA_B_GERCEK)}'e çıkıyor.<br>
    Teklif A'da masraf olmadığı için gerçek maliyet duyurulan oranla aynı: <strong>%{yz(TA_A_R)}</strong>.
  </div>
  <p>Yani oranı düşük görünen Teklif B, masraf dahil edildiğinde Teklif A'dan <strong>daha pahalıdır</strong>. İki teklifi yalnızca oran ya da taksitle değil, masraflar dahil gerçek maliyetle kıyaslayın. Masraf daha düşük olsaydı sıralama tersine dönerdi.</p>

  <h2>Yıllık bileşik karşılığı</h2>
  <p>Aylık oranı yıllık maliyetle kıyaslamak için bileşik hesaplama yapılır: (1 + aylık oran)<sup>12</sup> − 1. Örneğin aylık %{yz(TA_A_R)} yaklaşık yıllık %{yz(((1+TA_A_R/100)**12-1)*100,1)} bileşik maliyete karşılık gelir. Aylık oran, yıllık oranın 12'ye bölünmesiyle bulunmaz.</p>

  <h2>Karar vermeden önce</h2>
  <ul>
    <li>Teklifleri aynı tutar ve aynı vadede isteyin.</li>
    <li>Bütün peşin masrafları yazılı olarak sorun.</li>
    <li>Sigortanın zorunlu olup olmadığını, başka bir şirketten yaptırıp yaptıramayacağınızı öğrenin.</li>
    <li>Erken kapama ücretini ve koşullarını sorun; ayrıntılar için <a href="/blog/krediyi-erken-kapatmak-mantikli-mi/">erken kapama yazımıza</a> bakın.</li>
  </ul>
""",
        sss=[
            ("Düşük oranlı teklif her zaman daha ucuz mu?", "Hayır. Peşin masraflar elinize geçen tutarı azaltır; bu yüzden masraflar dahil gerçek aylık maliyete bakmak gerekir."),
            ("Gerçek maliyet nasıl bulunur?", "Elinize geçen net tutara karşılık ödediğiniz taksitlerin içsel aylık oranı hesaplanır. Katılım Plus'taki karşılaştırma ekranı bunu sizin için yapar."),
            ("Aylık oranı 12 ile çarpmak yıllık maliyeti verir mi?", "Hayır. Doğru yıllık karşılık bileşik hesaplanır: (1 + aylık oran)^12 − 1."),
        ],
        ilgili=["konut-finansmani-murabaha", "tasit-finansmani-nasil-hesaplanir", "kredi-kullandirim-komisyonu-nedir"],
        ek_link=[("/kar-payi-oranlari/", "Güncel kâr payı ve finansman oranları")],
    ),
    dict(
        slug="kamu-haznedarligi-getiri-orani-nedir", etiket="Piyasa Göstergesi", okuma=4,
        baslik="Kamu Haznedarlığı Getiri Oranı Nedir, Nasıl Hesaplanır?",
        kisa_baslik="Kamu Haznedarlığı Getiri Oranı Nedir?",
        desc="Kamu kurumlarının mevduat getirisi, TCMB'nin haftalık AOMF oranına vade katsayısı uygulanarak bulunur. Hesaplama mantığını örnekle anlatıyoruz.",
        kart="TCMB haftalık oranından vadeye göre tahmini getiri oranı nasıl bulunur?",
        arac=("/kamu-haznedarligi-getiri", "Kamu Haznedarlığı Getiri İzlemeyi Aç →", "Gün sayınızı yazın; vade dilimini ve tahmini getiri oranını görün."),
        govde="""
  <p>Kamu kurumlarının mevduatları için uygulanan tahmini getiri oranı, sabit bir rakam değildir; Merkez Bankası'nın yayımladığı haftalık oran ve vadeye göre değişen bir katsayıyla bulunur. Bu yazıda hesaplamanın mantığını anlatıyoruz.</p>

  <h2>Hesaplama mantığı</h2>
  <p>Tahmini getiri oranı şu şekilde bulunur:</p>
  <div class="ornek">
    <strong>Tahmini getiri oranı = TCMB haftalık mevduat ağırlıklı ortalama faizi (AOMF) × vade katsayısı</strong>
  </div>
  <ul>
    <li><strong>AOMF:</strong> TCMB'nin haftalık yayımladığı, mevduat faizlerinin ağırlıklı ortalamasını gösteren orandır. Vade dilimine göre farklı referans seriler kullanılır.</li>
    <li><strong>Vade katsayısı:</strong> Vade dilimine göre belirlenen yüzdedir. Vade dilimi, mevduatın kaç gün için tutulacağına göre seçilir.</li>
  </ul>

  <h2>Varsayımsal örnek</h2>
  <div class="ornek">
    İlgili referans AOMF'nin %50 olduğunu ve vade katsayısının %60 olduğunu varsayalım (rakamlar yalnızca örnektir).<br>
    Tahmini getiri oranı = %50 × 0,60 = <strong>%30</strong>.<br>
    Aynı AOMF ile katsayı %65 olsaydı oran %32,50 olurdu. Yani vade dilimi değiştikçe oran değişir.
  </div>

  <h2>Oranlar ne zaman güncellenir?</h2>
  <p>AOMF oranları haftalık yayımlanır; yeni oran açıklanana kadar mevcut oran her gün için geçerli kabul edilir. Geçmiş bir günün oranına bakmak için o tarihte geçerli olan haftalık orana bakmak gerekir.</p>

  <h2>Gösterimde yuvarlama</h2>
  <p>Oranlar yayımlanırken küsurat yuvarlanabilir. Örneğin hesaplanan değerin üçüncü ondalığı 5 ya da daha büyükse iki ondalığa yuvarlanarak gösterilebilir. Bu yüzden kendi hesabınızla ilan edilen oran arasında küçük bir fark görebilirsiniz; bu, hata değil gösterim kuralıdır.</p>

  <div class="uyari">Bu yazı genel bir bilgilendirmedir. Kesin oran ve koşullar için ilgili kurumun ve Merkez Bankası'nın duyurularına bakın.</div>
""",
        sss=[
            ("Kamu haznedarlığı getiri oranı nasıl hesaplanır?", "Merkez Bankası'nın haftalık mevduat AOMF oranı, vade dilimine göre belirlenen katsayıyla çarpılır."),
            ("Oran ne sıklıkla değişir?", "AOMF haftalık yayımlanır; yeni oran açıklanana kadar mevcut oran geçerlidir."),
            ("Hesapladığım oranla ilan edilen oran neden farklı olabilir?", "Yayımlanan oranlarda yuvarlama kuralı uygulanabilir; küçük farklar bundan kaynaklanır."),
        ],
        ilgili=["tlref-nedir-nasil-hesaplanir", "likidite-fonu-kisa-vadeli-sukuk-fonlari"],
    ),
    dict(
        slug="vade-farki-nedir-pesin-mi-vadeli-mi", etiket="Finansman", okuma=4,
        baslik="Vade Farkı Nedir? Peşin mi Vadeli mi Almalı?",
        kisa_baslik="Vade Farkı Nedir?",
        desc="Vadeli fiyatın peşin fiyattan farkı gerçekte kaç % aylık maliyet demek? Örnekli hesapla peşin ödeme kararını nasıl vereceğinizi anlatıyoruz.",
        kart="Vadeli fiyat ile peşin fiyat arasındaki farkın gerçek aylık ve yıllık maliyeti.",
        arac=("/vade-farki-karari", "Vade Farkı Aracını Aç →", "Peşin ve vadeli fiyatı girin; farkın gerçek aylık maliyetini görün."),
        govde=f"""
  <p>Bir mal ya da hizmette satıcı peşin fiyat ile vadeli fiyat söylüyorsa, aradaki fark aslında bir <strong>finansman maliyetidir</strong>. Bu fark küçük göründüğünde bile yıllık bazda yüksek bir orana karşılık gelebilir.</p>

  <h2>Vade farkı nedir?</h2>
  <p>Vadeli satışta peşin fiyatın üzerine eklenen tutardır. Satıcı parasını geç aldığı için bu gecikmenin bedelini fiyata yansıtır. Siz de bir bakıma satıcıdan vadeli borçlanmış olursunuz.</p>

  <h2>Gerçek maliyeti bulma</h2>
  <p>Aradaki farkı yüzdeye çevirip vade süresine bölmek yetmez; bileşik hesap gerekir. Mantık şu: Peşin fiyatı bugün ödeyip bugünkü parayı tutabilir, ya da vadeli fiyatı ileride ödeyebilirsiniz. İkisini eşitleyen aylık oran, vade farkının gerçek maliyetidir.</p>
  <div class="ornek">
    Peşin fiyat <strong>{tl(VF_PESIN)} TL</strong>, {VF_AY} ay sonra tek seferde ödenecek vadeli fiyat <strong>{tl(VF_VADELI)} TL</strong>.<br>
    Fark %{yz((VF_VADELI/VF_PESIN-1)*100,0)} görünüyor. Gerçek aylık maliyet = ({tl(VF_VADELI)} ÷ {tl(VF_PESIN)})<sup>1/{VF_AY}</sup> − 1 ≈ <strong>%{yz(VF_AYLIK)}</strong> aylık.<br>
    Yıllık bileşik karşılığı ≈ <strong>%{yz(VF_YILLIK,1)}</strong>.
  </div>

  <h2>Peşin ödemek ne zaman mantıklı?</h2>
  <ul>
    <li>Vade farkının aylık oranı, parayı güvenle değerlendirebileceğiniz aylık getiriden <strong>yüksekse</strong> peşin ödemek avantajlıdır.</li>
    <li>Aylık getiriniz vade farkının aylık oranından <strong>yüksekse</strong>, parayı değerlendirip vadeli almak daha kârlı olabilir.</li>
  </ul>
  <p>Yukarıdaki örnekte aylık %{yz(VF_AYLIK)} maliyet, örneğin katılma hesabında elde edebileceğiniz net getiriyle karşılaştırılmalıdır. Net getirinizi hesaplamak için <a href="/blog/katilma-hesabi-getirisi-adim-adim-hesaplama/">katılma hesabı getirisi yazımıza</a> bakabilirsiniz.</p>

  <h2>Taksitli satışlarda</h2>
  <p>Taksit sayısı arttığında, ödemeler farklı zamanlara dağıldığı için hesap biraz değişir; ancak mantık aynıdır: toplam ödemeyi, ödeme zamanlarına göre bugüne indirgeyerek peşin fiyatla karşılaştırırsınız. Katılım Plus'taki araç bunu sizin için yapar.</p>

  <div class="uyari">Örnek rakamlar yalnızca anlatım içindir. Gerçek kararda kendi getiri ve ödeme koşullarınızı kullanın.</div>
""",
        sss=[
            ("Vade farkı nedir?", "Vadeli satışta peşin fiyatın üzerine eklenen, fiilen finansman maliyeti olan tutardır."),
            ("Vade farkının gerçek oranı nasıl hesaplanır?", "Vadeli fiyatın peşin fiyata oranının vade süresine göre bileşik karşılığı bulunur: (vadeli ÷ peşin)^(1/ay) − 1."),
            ("Peşin ödemek her zaman mantıklı mı?", "Vade farkının aylık oranı, parayı değerlendirebileceğiniz aylık getiriden yüksekse evet."),
        ],
        ilgili=["murabaha-nedir", "katilma-hesabi-getirisi-adim-adim-hesaplama"],
    ),
]

# ── Şablon ───────────────────────────────────────────────────────────────────
CSS = open(os.path.join(PUBLIC, "blog", "murabaha-nedir", "index.html"), encoding="utf-8").read()
CSS = re.search(r"<style>(.*?)</style>", CSS, re.S).group(1)


def baslik_lookup():
    """Mevcut yazıların başlıkları (ilgili yazılar bağlantısı için)."""
    d = {}
    for ad in os.listdir(os.path.join(PUBLIC, "blog")):
        yol = os.path.join(PUBLIC, "blog", ad, "index.html")
        if os.path.isfile(yol):
            m = re.search(r"<h1>(.*?)</h1>", open(yol, encoding="utf-8").read())
            if m:
                d[ad] = re.sub(r"<[^>]+>", "", m.group(1))
    return d


def sayfa(y, basliklar):
    url = f"{SITE}/blog/{y['slug']}/"
    ld_makale = {"@context": "https://schema.org", "@type": "Article", "headline": y["baslik"], "description": y["desc"],
                 "author": {"@type": "Organization", "name": "Katılım Plus"},
                 "publisher": {"@type": "Organization", "name": "Katılım Plus", "logo": {"@type": "ImageObject", "url": f"{SITE}/blog/og-katilimplus.png"}},
                 "datePublished": f"{BUGUN.isoformat()}T09:00:00+03:00", "dateModified": f"{BUGUN.isoformat()}T09:00:00+03:00",
                 "mainEntityOfPage": {"@type": "WebPage", "@id": url}, "image": [f"{SITE}/blog/og-katilimplus.png"], "inLanguage": "tr"}
    ld_sss = {"@context": "https://schema.org", "@type": "FAQPage",
              "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in y["sss"]]}
    ld_yol = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Katılım Plus", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": SITE + "/blog/"},
        {"@type": "ListItem", "position": 3, "name": y["kisa_baslik"], "item": url}]}
    ld = "\n".join('<script type="application/ld+json">' + json.dumps(o, ensure_ascii=False) + "</script>" for o in (ld_makale, ld_sss, ld_yol))
    yol_ara, yol_ad, yol_not = y["arac"]
    arac_url = yol_ara if yol_ara.startswith("/arac/") else yol_ara
    h = f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(y['baslik'])} | Katılım Plus</title>
<meta name="description" content="{E(y['desc'], quote=True)}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{E(y['baslik'], quote=True)}">
<meta property="og:description" content="{E(y['desc'], quote=True)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/blog/og-katilimplus.png">
<meta name="robots" content="index, follow">
{ld}
<style>{CSS}</style>
</head>
<body>
<header><a href="{SITE}/">Katılım <span>Plus</span></a></header>
<main>
  <p class="breadcrumb"><a href="/blog/">Katılım Blog</a> › {E(y['kisa_baslik'])}</p>
  <h1>{E(y['baslik'])}</h1>
  <p class="meta">Güncelleme: {TARIH_YAZI} · Okuma süresi: {y['okuma']} dakika</p>
{y['govde']}
  <h2>Sık Sorulan Sorular</h2>
"""
    for q, a in y["sss"]:
        h += f"  <h3>{E(q)}</h3>\n  <p>{E(a)}</p>\n"
    hedef = SITE + yol_ara if not yol_ara.startswith("/arac/") else SITE + yol_ara
    h += f"""
  <div class="cta">
    <p>{E(yol_not)}</p>
    <a href="{hedef}">{E(yol_ad)}</a>
  </div>
"""
    if y.get("ilgili") or y.get("ek_link"):
        h += "  <h2>İlgili Yazılar</h2>\n  <ul>\n"
        for yol, ad in y.get("ek_link", []):
            h += f'    <li><a href="{yol}">{E(ad)}</a></li>\n'
        for s in y.get("ilgili", []):
            h += f'    <li><a href="/blog/{s}/">{E(basliklar.get(s, s))}</a></li>\n'
        h += "  </ul>\n"
    h += f"""
  <p class="meta" style="margin-top:28px">Bu yazı bilgilendirme amaçlıdır; yatırım tavsiyesi ya da kesin teklif niteliği taşımaz. Örnek rakamlar varsayımsaldır.</p>
</main>
<footer>
  © {BUGUN.year} Katılım Plus · <a href="{SITE}/">Uygulamaya git</a> · <a href="/blog/">Tüm yazılar</a> · <a href="/arac/">Araçlar</a>
</footer>
</body>
</html>
"""
    return h


def blog_dizini():
    yol = os.path.join(PUBLIC, "blog", "index.html")
    t = open(yol, encoding="utf-8").read()
    bas, son = "<!--BLOG-GUNCEL-BASLA-->", "<!--BLOG-GUNCEL-BITTI-->"
    t = re.sub(r"\n?  " + re.escape(bas) + r".*?" + re.escape(son) + r"\n", "\n", t, flags=re.S)
    mevcut = len(re.findall(r'class="kart"', t))
    blok = f'  {bas}\n  <p class="bolum">Güncel Konular</p>\n\n'
    for i, y in enumerate(YAZILAR):
        blok += f'  <a class="kart" href="/blog/{y["slug"]}/"><span class="no">{mevcut + i + 1:02d}</span><span class="etiket">{E(y["etiket"])}</span><h2>{E(y["kisa_baslik"])}</h2><p>{E(y["kart"])}</p></a>\n'
    blok += f"  {son}\n"
    assert t.count("\n</main>") == 1
    t = t.replace("\n</main>", "\n" + blok + "</main>", 1)
    toplam = mevcut + len(YAZILAR)
    t = re.sub(r"en çok merak edilen \d+ konuyu", f"en çok merak edilen {toplam} konuyu", t)
    open(yol, "w", encoding="utf-8", newline="\n").write(t)
    return toplam


def sitemap():
    yol = os.path.join(PUBLIC, "sitemap.xml")
    t = open(yol, encoding="utf-8").read()
    bug = BUGUN.isoformat()
    yeni = ""
    for y in YAZILAR:
        u = f"{SITE}/blog/{y['slug']}/"
        if u not in t:
            yeni += f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{bug}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n"
    t = t.replace("</urlset>", yeni + "</urlset>")
    t = re.sub(r"(<loc>" + re.escape(SITE + "/blog/") + r"</loc>\s*<lastmod>)[^<]*", r"\g<1>" + bug, t)
    open(yol, "w", encoding="utf-8", newline="\n").write(t)


def main():
    basliklar = baslik_lookup()
    for y in YAZILAR:
        basliklar[y["slug"]] = y["baslik"]
    for y in YAZILAR:
        assert len(y["desc"]) <= 165, (y["slug"], len(y["desc"]))
        for s in y.get("ilgili", []):
            assert s in basliklar, (y["slug"], s)
        k = os.path.join(PUBLIC, "blog", y["slug"]); os.makedirs(k, exist_ok=True)
        open(os.path.join(k, "index.html"), "w", encoding="utf-8", newline="\n").write(sayfa(y, basliklar))
    toplam = blog_dizini()
    sitemap()
    print(f"{len(YAZILAR)} blog yazisi uretildi; dizinde toplam {toplam} yazi")


if __name__ == "__main__":
    main()
