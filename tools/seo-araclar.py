#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/seo-araclar.py

Katılım Plus araçları için ARAMA MOTORLARININ okuyabileceği statik açılış sayfaları üretir:
    public/arac/index.html              (araç merkezi)
    public/arac/<slug>/index.html       (her araç için ayrı sayfa)
ve ana sayfa (index.html) için ilk-HTML içeriği + yapısal veri (JSON-LD) ekler.

NEDEN: Uygulama tek sayfalı (SPA); vercel.json tüm adresleri index.html'e yönlendirdiği için
Google'a her araç aynı başlık/açıklama/kanonik adresle görünüyordu. Bu sayfalar her araca kendi
adresini, başlığını ve açıklamasını verir; "Uygulamada aç" bağlantısı gerçek ekrana gider.

Yol adı bilinçli olarak /arac/ (SPA'da /araclar zaten Araçlar menüsü).
Bu betik tekrar çalıştırılabilir (idempotent): sayfaları baştan üretir, index.html'i işaretçiyle günceller.

KULLANIM:  python3 tools/seo-araclar.py
"""
import json, os, re, sys
from datetime import date
from html import escape as E

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(KOK, "public")
SITE = "https://www.katilimplus.com"
BUGUN = date.today().isoformat()
AYLAR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
APPSTORE = "https://apps.apple.com/tr/app/id6788268835"
PLAY = "https://play.google.com/store/apps/details?id=com.katilimplus.app"


def tl(v):
    return f"{v:,.0f}".replace(",", ".")


def taksit(anapara, aylik_yuzde, ay):
    i = aylik_yuzde / 100.0
    return anapara * i * (1 + i) ** ay / ((1 + i) ** ay - 1)


# Bilgi: blog yazıları (başlık kısa tutulur)
B = {
    "kar-payi": ("Kâr payı nedir, nasıl hesaplanır?", "kar-payi-nedir-nasil-hesaplanir"),
    "getiri": ("Katılma hesabı getirisi: adım adım hesaplama", "katilma-hesabi-getirisi-adim-adim-hesaplama"),
    "stopaj": ("Katılma hesabında stopaj nasıl hesaplanır?", "katilim-hesabi-stopaj-hesaplama"),
    "konut": ("Konut finansmanında murabaha nasıl işler?", "konut-finansmani-murabaha"),
    "tasit": ("Taşıt finansmanı nasıl hesaplanır?", "tasit-finansmani-nasil-hesaplanir"),
    "murabaha": ("Murabaha nedir, nasıl işler?", "murabaha-nedir"),
    "tlref": ("TLREF nedir, nasıl hesaplanır?", "tlref-nedir-nasil-hesaplanir"),
    "enflasyon": ("Enflasyon korumalı katılma hesabı nedir?", "enflasyon-korumali-katilma-hesabi-nedir"),
    "komisyon": ("Kredi kullandırım komisyonu nedir?", "kredi-kullandirim-komisyonu-nedir"),
    "pos": ("POS komisyonu nedir, nasıl hesaplanır?", "pos-komisyonu-nedir"),
    "teminat": ("Teminat mektubu nedir, komisyonu nasıl hesaplanır?", "teminat-mektubu-nedir"),
    "zekat": ("Hisse senedinde zekât nasıl hesaplanır?", "hisse-senedi-zekati-nasil-hesaplanir"),
    "likidite": ("Likidite fonu ve kısa vadeli kira sertifikası fonları", "likidite-fonu-kisa-vadeli-sukuk-fonlari"),
    "sukuk": ("Sukuk (kira sertifikası) nedir?", "sukuk-kira-sertifikasi-nedir"),
    "kredi-verir": ("Katılım bankası kredi verir mi?", "katilim-bankasi-kredi-verir-mi"),
    "guvence": ("Katılım hesabında güvence: TMSF limiti", "katilim-hesabi-guvence-tmsf"),
    "erken": ("Krediyi erken kapatmak mantıklı mı?", "krediyi-erken-kapatmak-mantikli-mi"),
    "kur-gosterge": ("TCMB gösterge kuru nedir, ne zaman açıklanır?", "tcmb-gosterge-kuru-nedir"),
    "zk": ("Zorunlu karşılık nedir?", "zorunlu-karsilik-nedir-bankalari-nasil-etkiler"),
    "teklif": ("Finansman teklifleri nasıl karşılaştırılır?", "banka-finansman-teklifleri-nasil-karsilastirilir"),
    "khz": ("Kamu haznedarlığı getiri oranı nedir?", "kamu-haznedarligi-getiri-orani-nedir"),
    "vade-farki": ("Vade farkı nedir? Peşin mi vadeli mi?", "vade-farki-nedir-pesin-mi-vadeli-mi"),
    "leasing": ("Finansal kiralama (leasing) nedir?", "finansal-kiralama-leasing-nedir"),
}

K = taksit(1_000_000, 2.90, 120)
T = taksit(500_000, 3.40, 24)
I = taksit(200_000, 3.90, 12)
KATILMA_BRUT = 100_000 * 0.40 * 32 / 365

# ── Araç sayfaları ───────────────────────────────────────────────────────────
SAYFALAR = [
    dict(
        slug="tcmb-kur-izleme", yol="/tcmb-kur-izleme", ad="TCMB Kur İzleme", kisa="TCMB gösterge kurları, pariteler, gram altın",
        title="TCMB Döviz Kurları: Alış-Satış, Parite, Gram Altın | Katılım Plus",
        desc="TCMB gösterge döviz kurlarını (USD, EUR, GBP, CHF) alış-satış olarak izleyin; EUR/USD ve GBP/USD paritesi, gram altın ve gümüş, geçmiş gün kuru ve hedef kur alarmı.",
        h1="TCMB Döviz Kurları ve Kur İzleme",
        intro="Merkez Bankası'nın gösterge döviz kurlarını tek ekranda izleyin: dolar, euro, sterlin ve İsviçre frangı alış-satış kurları, pariteler, gram altın ve gümüş. İstediğiniz geçmiş günün kurunu seçip değişimi görebilir, hedef kura ulaşınca bildirim alabilirsiniz.",
        ozellik=[
            "USD, EUR, GBP ve CHF için TCMB alış ve satış kurları",
            "EUR/USD ve GBP/USD pariteleri (TCMB çapraz kuru)",
            "Gram altın ve gram gümüş (TL/gram)",
            "Tarih seçerek geçmiş günün kurunu ve bir önceki güne göre değişimi görme",
            "Hedef kur alarmı: kur belirlediğiniz seviyeye gelince bildirim",
        ],
        nasil=[
            "Ekranı açın; en güncel TCMB kuru listelenir.",
            "Tarih alanından geçmiş bir iş gününü seçin.",
            "Zil simgesinden hedef kur alarmı kurun.",
        ],
        notu="TCMB gösterge kurları iş günlerinde saat 15:30'da açıklanır ve ertesi iş günü için geçerli olur. Bu yüzden akşam saatlerinde açıklanan kur, ertesi günün kuru olarak görünür.",
        sss=[
            ("TCMB döviz kurları ne zaman açıklanır?", "Gösterge niteliğindeki döviz alış ve satış kurları iş günlerinde saat 15:30'da açıklanır ve bir sonraki iş günü için geçerli olur."),
            ("Alış ve satış kuru arasındaki fark nedir?", "Alış kuru bankanın sizden döviz alırken, satış kuru size döviz satarken kullandığı kurdur. İkisi arasındaki farka makas denir."),
            ("Bu kurlar bankaların işlem kuruyla aynı mı?", "Hayır. TCMB gösterge kurları referanstır; bankalar işlemde kendi kurlarını uygulayabilir."),
        ],
        blog=["kur-gosterge", "tlref", "enflasyon"],
    ),
    dict(
        slug="krediyi-erken-kapatmali-miyim", yol="/erken-kapama-karari", ad="Krediyi Erken Kapatmalı mıyım?", kisa="Erken kapama ve refinansman kararı",
        title="Krediyi Erken Kapatmalı mıyım? Erken Kapama Hesaplama | Katılım Plus",
        desc="Finansmanı erken kapatmak mı, birikimi değerlendirip taksite devam etmek mi, yoksa refinansmanla kapatmak mı avantajlı? Erken kapama ücreti ve bugünkü değerle hesaplayın.",
        h1="Krediyi Erken Kapatmalı mıyım?",
        intro="Elinizde birikim varsa finansmanı erken kapatmak mı, parayı katılma hesabında tutup taksite devam etmek mi daha kârlı? Ya da yeni bir finansmanla (refinansman) kapatmak mı? Hesaplayıcı, erken kapama ücretini de hesaba katarak iki yolu karşılaştırır.",
        ozellik=[
            "Konut, taşıt/ihtiyaç ve ticari finansman türlerine göre erken kapama ücreti",
            "Elinizdeki parayla kapama: vade sonundaki net varlık karşılaştırması",
            "Refinansman: yeni finansman teklifinin oranı ya da taksitiyle, ödemelerin bugünkü değeri üzerinden karşılaştırma",
            "Başabaş noktası: hangi oranın altında kapamak kârlı hale gelir",
            "Yeni finansmanın tahsis, sigorta, ekspertiz gibi masraflarını hesaba katma",
        ],
        nasil=[
            "Kalan anapara, aylık taksit ve kalan vadeyi girin.",
            "\"Elimdeki para\" ya da \"Refinansman\" seçeneğini seçin.",
            "Sonuç kartı hangi yolun avantajlı olduğunu ve farkı gösterir.",
        ],
        notu="Konut finansmanında erken kapama ücreti için mevzuattaki azami oranlar kullanılır (kalan vade 36 ay ve altındaysa %1, üzerindeyse %2). Bankanız daha düşük uygulayabilir; sözleşmenizi kontrol edin.",
        sss=[
            ("Erken kapama ücreti ne kadar?", "Tür ve vadeye göre değişir. Konut finansmanında azami oranlar kalan vadeye bağlıdır; ticari finansmanda ise ayrı bir formül uygulanır. Hesaplayıcı bunları sizin için hesaplar. Nihai tutar için bankanızla teyit edin."),
            ("Refinansman her zaman avantajlı mı?", "Hayır. Yeni finansmanın oranı, vadesi ve masrafları eski finansmanın kalan ödemelerinin bugünkü değerinden düşükse avantajlıdır. Vade uzadıkça taksit düşer ama toplam ödeme artabilir."),
            ("Elimdeki parayı kapatmaya mı harcamalıyım?", "Kapama ücretini ve o parayı katılma hesabında değerlendirseydiniz kazanacağınız net getiriyi karşılaştırmak gerekir. Hesaplayıcı vade sonundaki net varlığı iki yol için de gösterir."),
        ],
        blog=["erken", "teklif", "komisyon"],
    ),
    dict(
        slug="banka-finansman-karsilastirma", yol="/taksit-karsilastirma", ad="Banka Finansman Karşılaştırma", kisa="Katılım bankalarının taksitleri yan yana",
        title="Katılım Bankası Finansman Karşılaştırma: Taksit ve Oran | Katılım Plus",
        desc="Konut, taşıt ve ihtiyaç finansmanında katılım bankalarının taksitlerini aynı tutar ve vadede yan yana karşılaştırın; en uygun teklifi toplam maliyete göre bulun.",
        h1="Banka Finansman Karşılaştırma",
        intro="Aynı tutar ve vade için katılım bankalarının aylık taksitini ve toplam ödemesini yan yana görün. Oran farkı küçük görünse de vade boyunca toplam maliyette büyük fark yaratabilir.",
        ozellik=[
            "Katılım bankalarının güncel gösterge kâr payı oranlarıyla taksit hesabı",
            "Konut, taşıt ve ihtiyaç finansmanı için vade seçimi",
            "Aylık taksit ve toplam geri ödeme karşılaştırması",
            "En uygun bankayı işaretleme ve bankaya başvuru bağlantısı",
        ],
        nasil=["Finansman türünü ve tutarı seçin.", "Vadeyi belirleyin.", "Bankaları taksit ve toplam ödemeye göre karşılaştırın."],
        notu="Oranlar bankaların kamuya açıkladığı gösterge oranlardır; size sunulacak nihai oran ve masraflar farklı olabilir.",
        sss=[
            ("Hangi katılım bankasının finansman oranı daha düşük?", "Oranlar sık değişir. Güncel sıralamayı kâr payı oranları sayfamızdan ve uygulamadaki karşılaştırma ekranından görebilirsiniz."),
            ("Taksit karşılaştırırken sadece oran yeterli mi?", "Hayır. Tahsis ücreti, sigorta ve ekspertiz gibi masraflar da toplam maliyeti etkiler. Teklifleri toplam geri ödeme üzerinden kıyaslamak daha doğrudur."),
        ],
        blog=["teklif", "zk", "konut", "tasit"], ek_link=[("/kar-payi-oranlari/", "Güncel kâr payı oranları tablosu")],
    ),
    dict(
        slug="katilma-hesabi-getiri-hesaplama", yol="/katilim-hesabi-getiri", ad="Katılma Hesabı Getiri Hesaplama", kisa="Vade sonu kâr payı ve net getiri",
        title="Katılma Hesabı Getiri Hesaplama: Brüt, Net, Stopaj | Katılım Plus",
        desc="Katılma hesabında tutar, vade ve kâr payı oranına göre vade sonu getirinizi hesaplayın. Stopaj sonrası net getiriyi ve toplam bakiyeyi görün.",
        h1="Katılma Hesabı Getiri Hesaplama",
        intro="Katılma hesabına yatıracağınız tutarın belirli bir vade ve kâr payı oranıyla ne kadar getiri sağlayacağını hesaplayın. Stopaj öncesi (brüt) ve sonrası (net) getiriyi birlikte görürsünüz.",
        ozellik=["Tutar, gün sayısı ve yıllık kâr payı oranıyla hesap", "Brüt ve net (stopaj sonrası) getiri", "Vade sonu toplam bakiye", "Farklı vadelerin karşılaştırılması"],
        nasil=["Tutarı ve vadeyi (gün) girin.", "Bankanın yıllık kâr payı oranını yazın.", "Brüt, net getiri ve vade sonu bakiyeyi görün."],
        ornek=f"Örnek: 100.000 TL, 32 gün, yıllık %40 kâr payı oranı → stopaj öncesi yaklaşık {tl(KATILMA_BRUT)} TL (100.000 × %40 × 32 ÷ 365). Stopaj bunun üzerinden vade ve para birimine göre kesilir.",
        notu="Kâr payı oranları ileriye yönelik bir taahhüt değildir; gösterge niteliğindedir. Stopaj oranları mevzuata göre değişebilir.",
        sss=[
            ("Katılma hesabı getirisi nasıl hesaplanır?", "Tutar × yıllık kâr payı oranı × gün sayısı ÷ 365 formülüyle brüt getiri bulunur. Stopaj düşüldükten sonra net getiri elde edilir."),
            ("Kâr payı oranı sabit mi?", "Hayır. Katılma hesabında oran, vade başında beklenen kâr payı oranı olarak açıklanır; gerçekleşen kâr payı farklı olabilir. Bu nedenle hesaplama gösterge niteliğindedir."),
            ("Vadeyi uzatmak her zaman daha kârlı mı?", "Oran vade dilimine göre değişir; ayrıca stopaj oranı da vadeye bağlı olabilir. Farklı vadeleri hesaplayıcıda deneyerek karşılaştırın."),
        ],
        blog=["getiri", "stopaj", "kar-payi"], ek_link=[("/kar-payi-oranlari/", "Katılım bankalarının güncel oranları")],
    ),
    dict(
        slug="kamu-haznedarligi-getiri", yol="/kamu-haznedarligi-getiri", ad="Kamu Haznedarlığı Getiri İzleme", kisa="AOMF'ye göre tahmini getiri oranı",
        title="Kamu Haznedarlığı Getiri Oranı: AOMF'ye Göre Hesaplama | Katılım Plus",
        desc="Kamu kurumlarının mevduat getirisini belirleyen TCMB AOMF oranlarını ve vade dilimine göre tahmini getiri oranını izleyin; gün sayısına göre hesaplayın.",
        h1="Kamu Haznedarlığı Getiri İzleme",
        intro="Kamu haznedarlığı mevduatında tahmini getiri oranı, TCMB'nin açıkladığı ağırlıklı ortalama faiz (AOMF) oranlarına vade dilimine göre belirli bir katsayı uygulanarak bulunur. Ekran, güncel oranları ve gün sayısına göre tahmini getiriyi gösterir.",
        ozellik=["Gecelikten uzun vadeye tüm vade dilimleri için tahmini getiri oranı", "Gün sayınızı yazarak hangi vade dilimine girdiğinizi ve oranı görme", "Bir önceki döneme göre puan değişimi", "Oran güncellenince bildirim"],
        nasil=["Gün sayınızı yazın.", "Vade dilimi ve hesaplama otomatik gösterilir.", "Tablodan diğer vadelerin oranlarını karşılaştırın."],
        notu="Getiri oranları gösterge niteliğindedir; kesin oran için ilgili kurumun duyurusuna bakınız. Veriler genellikle haftalık güncellenir.",
        sss=[
            ("Kamu haznedarlığı getirisi nasıl belirlenir?", "Vade dilimine göre, TCMB'nin AOMF oranlarının belirli bir yüzdesi (katsayı) alınır. Örneğin gecelik için 1 aylık AOMF'nin %55'i uygulanır."),
            ("AOMF nedir?", "Mevduat ağırlıklı ortalama faizi; TCMB'nin haftalık yayımladığı, mevduat faizlerinin ağırlıklı ortalamasını gösteren orandır."),
            ("Oranlar ne sıklıkla güncellenir?", "Genellikle haftada bir güncellenir; ekranda son güncelleme tarihi gösterilir."),
        ],
        blog=["khz", "tlref", "likidite"],
    ),
    dict(
        slug="konut-finansmani-hesaplama", yol="/konut-finansmani", ad="Konut Finansmanı Hesaplama", kisa="Aylık taksit ve toplam ödeme",
        title="Katılım Bankası Konut Finansmanı Hesaplama | Katılım Plus",
        desc="Katılım bankası konut finansmanında aylık taksit, toplam geri ödeme, kâr payı tutarı ve masrafları hesaplayın; ödeme planını görün.",
        h1="Konut Finansmanı Hesaplama",
        intro="Katılım bankalarında murabaha yöntemiyle konut finansmanı kullanırken aylık taksitinizi, toplam geri ödemenizi ve vergi-masraf kalemlerini hesaplayın. Ödeme planını tablo olarak görebilir, farklı vadeleri karşılaştırabilirsiniz.",
        ozellik=["Tutar, vade ve aylık kâr payı oranıyla taksit hesabı", "Toplam geri ödeme ve toplam kâr payı", "Vergi ve masrafların hesaba katılması", "Ödeme planı ve erken kapama için kolay geçiş"],
        nasil=["Finansman tutarını ve vadeyi girin.", "Aylık kâr payı oranını yazın.", "Taksit ve toplam ödemeyi görün."],
        ornek=f"Örnek (varsayımsal oranla): 1.000.000 TL, 120 ay, aylık %2,90 → eşit taksitle yaklaşık {tl(K)} TL/ay, toplam yaklaşık {tl(K*120)} TL. Gerçek teklifler bankaya, tutara ve vadeye göre değişir.",
        notu="Hesaplama bilgilendirme amaçlıdır; sigorta, ekspertiz ve tahsis gibi kalemler bankaya göre farklılık gösterebilir.",
        sss=[
            ("Katılım bankasında konut finansmanı nasıl işler?", "Banka konutu satın alıp size vadeli olarak sattığı murabaha yöntemi kullanılır; toplam bedel baştan bellidir."),
            ("Taksit sabit mi?", "Murabahada toplam bedel ve taksitler sözleşmede baştan belirlendiği için taksit sabittir."),
            ("En düşük oranı hangi banka veriyor?", "Oranlar sık değişir. Güncel tabloya kâr payı oranları sayfamızdan bakabilirsiniz."),
        ],
        blog=["konut", "murabaha", "komisyon"], ek_link=[("/kar-payi-oranlari/", "Güncel konut finansmanı oranları")],
    ),
    dict(
        slug="tasit-finansmani-hesaplama", yol="/tasit-finansmani", ad="Taşıt Finansmanı Hesaplama", kisa="Araç finansmanı taksit hesabı",
        title="Katılım Bankası Taşıt (Araç) Finansmanı Hesaplama | Katılım Plus",
        desc="Katılım bankasıyla araç almak için taşıt finansmanı taksitini, toplam geri ödemeyi ve masrafları hesaplayın; vadeleri karşılaştırın.",
        h1="Taşıt Finansmanı Hesaplama",
        intro="Katılım bankasıyla araç finansmanı kullanmadan önce aylık taksitinizi ve toplam geri ödemenizi hesaplayın. Farklı vade ve peşinat seçeneklerini deneyerek bütçenize uygun planı bulun.",
        ozellik=["Araç bedeli, peşinat, vade ve kâr payı oranıyla taksit hesabı", "Toplam geri ödeme ve toplam maliyet", "Vergi ve masrafların hesaba katılması", "Banka oranlarıyla karşılaştırma"],
        nasil=["Finanse edilecek tutarı ve vadeyi girin.", "Aylık kâr payı oranını yazın.", "Aylık taksiti ve toplam ödemeyi görün."],
        ornek=f"Örnek (varsayımsal oranla): 500.000 TL, 24 ay, aylık %3,40 → eşit taksitle yaklaşık {tl(T)} TL/ay, toplam yaklaşık {tl(T*24)} TL. Gerçek teklifler bankaya göre değişir.",
        notu="Hesaplama bilgilendirme amaçlıdır; nihai şartlar bankanın teklifine bağlıdır.",
        sss=[
            ("Taşıt finansmanı vadesi ne kadar olabilir?", "Azami vade ve finanse edilebilecek oran mevzuata ve araç türüne göre sınırlanır. Güncel şartlar için bankanıza danışın."),
            ("Peşinat vermek taksiti nasıl etkiler?", "Peşinat finanse edilen tutarı düşürür; böylece aylık taksit ve toplam kâr payı azalır."),
        ],
        blog=["tasit", "murabaha"], ek_link=[("/kar-payi-oranlari/", "Güncel taşıt finansmanı oranları")],
    ),
    dict(
        slug="ihtiyac-finansmani-hesaplama", yol="/ihtiyac-finansmani", ad="İhtiyaç Finansmanı Hesaplama", kisa="İhtiyaç finansmanı taksit hesabı",
        title="Katılım Bankası İhtiyaç Finansmanı Hesaplama | Katılım Plus",
        desc="Katılım bankasından ihtiyaç finansmanı kullanırken aylık taksiti, toplam geri ödemeyi ve masrafları hesaplayın.",
        h1="İhtiyaç Finansmanı Hesaplama",
        intro="İhtiyaç finansmanı kullanmadan önce aylık taksit ve toplam geri ödemeyi hesaplayın. Vade ve oran değiştikçe toplam maliyetin nasıl değiştiğini görün.",
        ozellik=["Tutar, vade ve aylık kâr payı oranıyla taksit hesabı", "Toplam geri ödeme ve kâr payı toplamı", "Vergi ve masrafların hesaba katılması", "Farklı bankaların oranlarıyla karşılaştırma"],
        nasil=["Tutarı ve vadeyi girin.", "Aylık kâr payı oranını yazın.", "Taksiti ve toplam ödemeyi görün."],
        ornek=f"Örnek (varsayımsal oranla): 200.000 TL, 12 ay, aylık %3,90 → eşit taksitle yaklaşık {tl(I)} TL/ay, toplam yaklaşık {tl(I*12)} TL. Gerçek teklifler bankaya göre değişir.",
        notu="Hesaplama bilgilendirme amaçlıdır; nihai şartlar bankanın teklifine bağlıdır.",
        sss=[
            ("İhtiyaç finansmanı katılım bankasında nasıl çalışır?", "Katılım bankaları ihtiyaç finansmanını da faiz yerine murabaha benzeri bir alım-satım yapısıyla sunar; toplam bedel baştan bellidir."),
            ("Erken kapatırsam ne olur?", "Erken kapama kararını, ücret ve alternatif getiriyi karşılaştırarak vermek gerekir. 'Krediyi Erken Kapatmalı mıyım?' aracı bunu hesaplar."),
        ],
        blog=["kredi-verir", "murabaha"], ek_link=[("/arac/krediyi-erken-kapatmali-miyim/", "Krediyi erken kapatmalı mıyım?")],
    ),
    dict(
        slug="kobi-finans-asistani", yol="/isletmem-finans-asistanim", ad="KOBİ Finans Asistanı", kisa="90 günlük nakit akış radarı",
        title="KOBİ Nakit Akış Planı: 90 Günlük Nakit Radarı | Katılım Plus",
        desc="İşletmenizin tahsilat, ödeme ve çek/senetlerini girin; 90 günlük nakit akışını, finansman ihtiyacını ve işletme sağlık skorunu görün.",
        h1="KOBİ Finans Asistanı: 90 Günlük Nakit Radarı",
        intro="Nakit sıkışması çoğu zaman beklenmedik bir günde değil, önceden görülebilen bir tarihte başlar. KOBİ Finans Asistanı tahsilat, ödeme ve çek/senetlerinizi birleştirerek önümüzdeki 90 günün nakit akışını gösterir.",
        ozellik=["Tahsilat ve ödeme takibi; kasa ve banka bakiyesi", "Çek ve senet vadeleri", "90 günlük nakit akış radarı ve uyarılar", "Finansman ihtiyacı analizi ve senaryolar (tahsilat gecikirse ne olur?)", "İşletme sağlık skoru ve paylaşılabilir rapor"],
        nasil=["İşletme bilgilerinizi ve kasa bakiyenizi girin.", "Tahsilat, ödeme ve çek/senetlerinizi ekleyin.", "Radar, uyarılar ve sağlık skoru otomatik güncellenir."],
        notu="Uygulama planlama ve bilgilendirme aracıdır; alacakların tahsil edileceği garanti edilemez, bu nedenle tüm tahsilatlar \"beklenen\" olarak planlanır. Verileriniz üyeliğinize bağlı olarak saklanır.",
        sss=[
            ("Nakit akış planı neden gerekli?", "Gelir ve giderlerin tarihleri farklı olduğu için kârlı bir işletme bile belirli günlerde nakit sıkışması yaşayabilir. Plan, bu günleri önceden gösterir."),
            ("Çek ve senetler hesaba nasıl katılıyor?", "Vade tarihlerine göre nakit akışına işlenir; gecikme riski olan kalemler için senaryo analizi yapılabilir."),
            ("Üyelik gerekli mi?", "Veriler hesabınıza bağlı saklandığı için üye girişi gerekir."),
        ],
        blog=["pos", "teminat", "leasing"],
    ),
    dict(
        slug="tl-mi-doviz-mi-borclanmali", yol="/tl-yp-karari", ad="TL mi, Döviz mi Borçlanmalıyım?", kisa="TL ve döviz finansman karşılaştırması",
        title="TL mi Döviz mi Borçlanmalıyım? Kur Riski Hesaplama | Katılım Plus",
        desc="TL ve döviz cinsi finansman tekliflerini kur beklentisiyle karşılaştırın; döviz borcunun TL'ye göre ne zaman avantajlı olduğunu hesaplayın.",
        h1="TL mi, Döviz mi Borçlanmalıyım?",
        intro="Döviz cinsi finansmanın oranı düşük görünse de kur artışı toplam maliyeti yükseltir. Araç, TL ve döviz teklifini kur varsayımınızla aynı para biriminde karşılaştırır ve başabaş kurunu gösterir.",
        ozellik=["TL ve döviz teklifinin toplam maliyet karşılaştırması", "Vade sonu kur varsayımına göre sonuç", "Başabaş kuru: bu kurun üstünde döviz borcu pahalı hale gelir", "Kur senaryoları"],
        nasil=["TL ve döviz tekliflerinin tutar, vade ve oranlarını girin.", "Vade sonu kur beklentinizi yazın.", "Hangi seçeneğin daha ucuz olduğunu ve başabaş kurunu görün."],
        notu="Kur tahmini yapılmaz; sonuçlar sizin girdiğiniz varsayımlara göre hesaplanır. Yatırım ya da finansal tavsiye değildir.",
        sss=[
            ("Döviz borcu ne zaman avantajlıdır?", "Vade boyunca kur artışı, TL ve döviz oranları arasındaki farkı aşmıyorsa. Başabaş kuru bu eşiği gösterir."),
            ("Gelirim döviz ise?", "Gelirleriniz döviz cinsindeyse kur riski doğal olarak azalır; yine de teklifleri karşılaştırmak faydalıdır."),
        ],
        blog=["murabaha", "likidite"],
    ),
    dict(
        slug="vade-farki-pesin-odeme", yol="/vade-farki-karari", ad="Vade Farklı mı, Peşin Ödeme mi?", kisa="Vadeli fiyat ile peşin fiyat",
        title="Vade Farklı mı Peşin mi? Vade Farkı Hesaplama | Katılım Plus",
        desc="Satıcının vadeli fiyatı ile peşin fiyatı arasındaki farkın gerçek aylık maliyetini hesaplayın; peşin ödemek mi vadeli almak mı daha avantajlı?",
        h1="Vade Farklı mı, Peşin Ödeme mi?",
        intro="Bir mal ya da hizmette vadeli fiyat peşin fiyattan yüksekse aradaki fark aslında bir finansman maliyetidir. Araç, bu farkın aylık ve yıllık karşılığını bulur ve parayı başka yerde değerlendirmenin daha kârlı olup olmadığını gösterir.",
        ozellik=["Peşin ve vadeli fiyattan örtük aylık oran", "Yıllık bileşik karşılığı", "Peşin ödemenin alternatif getiriyle karşılaştırılması"],
        nasil=["Peşin fiyatı ve vadeli fiyatı girin.", "Vade süresini yazın.", "Vade farkının gerçek maliyetini görün."],
        notu="Hesap bilgilendirme amaçlıdır; alternatif getiri varsayımlarınıza göre sonuç değişir.",
        sss=[
            ("Vade farkı nedir?", "Vadeli satışta peşin fiyatın üzerine eklenen tutardır; fiilen bir finansman maliyetidir."),
            ("Peşin ödemek her zaman mantıklı mı?", "Vade farkının aylık oranı, parayı değerlendirebileceğiniz getiriden yüksekse peşin ödemek avantajlıdır."),
        ],
        blog=["vade-farki", "murabaha", "getiri"],
    ),
    dict(
        slug="zekat-hesaplayici", yol="/zekat-hesaplayici", ad="Zekât Hesaplayıcı", kisa="Güncel altın fiyatıyla nisap ve zekât",
        title="Zekât Hesaplama: Güncel Altın Fiyatıyla Nisap | Katılım Plus",
        desc="Nakit, altın, döviz ve yatırımlarınız için zekât tutarını güncel altın fiyatıyla ve Diyanet ölçütüne göre hesaplayın.",
        h1="Zekât Hesaplayıcı",
        intro="Zekâta tabi malvarlığınızı girin; nisap miktarı güncel altın fiyatıyla Diyanet ölçütüne göre hesaplanır, zekât tutarınız otomatik görünür.",
        ozellik=["Güncel altın fiyatıyla nisap hesabı", "Nakit, altın, döviz ve yatırımların toplanması", "Borçların düşülmesi", "Zekât tutarı (kırkta bir)"],
        nasil=["Malvarlığı kalemlerinizi girin.", "Varsa borçlarınızı yazın.", "Nisabı aşıyorsa zekât tutarı gösterilir."],
        notu="Hesaplama genel bir yardımcıdır; özel durumlar için bir din görevlisine danışın.",
        sss=[
            ("Nisap miktarı nedir?", "Diyanet ölçütüne göre 80,18 gram altının değeridir; güncel altın fiyatıyla hesaplanır."),
            ("Zekât oranı nedir?", "Nisabı aşan malvarlığının kırkta biri (%2,5) zekât olarak verilir."),
        ],
        blog=["zekat"],
    ),
]

# ── Ortak HTML ───────────────────────────────────────────────────────────────
CSS = """
  :root { --mavi:#1A4F9C; --yesil:#189656; --metin:#16222E; --soluk:#5A6B7C; --cizgi:#E3E9EF; --zemin:#F5F8FB; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
         color:var(--metin); background:var(--zemin); line-height:1.6; }
  .sar { max-width:860px; margin:0 auto; padding:20px 16px 60px; }
  header a { color:var(--mavi); text-decoration:none; font-weight:700; font-size:15px; }
  nav.ek { font-size:13px; color:var(--soluk); margin-top:6px; }
  nav.ek a { color:var(--soluk); font-weight:600; text-decoration:none; }
  h1 { font-size:27px; line-height:1.25; margin:16px 0 8px; }
  h2 { font-size:19px; margin:30px 0 8px; }
  .giris { color:var(--soluk); font-size:16px; margin:8px 0 0; }
  .kutu { background:#fff; border:1px solid var(--cizgi); border-radius:12px; padding:16px 18px; margin-top:14px; }
  .vurgu { border-color:#CFE0F5; background:#F7FAFF; }
  ul.l { margin:6px 0 0; padding-left:20px; } ul.l li { margin:5px 0; }
  ol.l { margin:6px 0 0; padding-left:22px; } ol.l li { margin:5px 0; }
  .cta { display:block; text-align:center; background:var(--mavi); color:#fff; text-decoration:none; font-weight:700;
         padding:14px; border-radius:12px; margin-top:22px; }
  .cta2 { display:inline-block; margin:8px 10px 0 0; font-size:14px; color:var(--mavi); font-weight:700; text-decoration:none; }
  details { background:#fff; border:1px solid var(--cizgi); border-radius:10px; padding:12px 14px; margin-top:8px; }
  summary { font-weight:700; cursor:pointer; font-size:15px; }
  details p { margin:8px 0 0; font-size:14.5px; color:var(--soluk); }
  .minik { font-size:12.5px; color:var(--soluk); margin-top:8px; }
  .ilgili { list-style:none; padding:0; margin:0; } .ilgili li { padding:9px 0; border-bottom:1px solid var(--cizgi); }
  .ilgili li:last-child { border-bottom:none; } .ilgili a { color:var(--mavi); text-decoration:none; font-weight:600; font-size:15px; }
  .izgara { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:12px; margin-top:12px; }
  .kart { display:block; background:#fff; border:1px solid var(--cizgi); border-radius:12px; padding:14px 16px; text-decoration:none; color:var(--metin); }
  .kart strong { display:block; font-size:16px; color:var(--mavi); } .kart span { font-size:13.5px; color:var(--soluk); }
  footer { margin-top:34px; font-size:12.5px; color:var(--soluk); } footer a { color:var(--mavi); }
"""


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False) + "</script>"


def head(title, desc, url, extra=""):
    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc, quote=True)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="{E(title, quote=True)}">
<meta property="og:description" content="{E(desc, quote=True)}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Katılım Plus">
<meta property="og:locale" content="tr_TR">
<meta property="og:image" content="{SITE}/icon-512x512.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{E(title, quote=True)}">
<meta name="twitter:description" content="{E(desc, quote=True)}">
<link rel="icon" href="/favicon.ico">
{extra}
<style>{CSS}</style>
</head>
<body>
<div class="sar">
<header><a href="{SITE}/">← Katılım Plus</a></header>
"""


FOOT = f"""
<footer>
  <p>Bu sayfadaki bilgiler ve hesaplamalar bilgilendirme amaçlıdır; yatırım tavsiyesi, kesin teklif ya da hukuki taahhüt niteliği taşımaz.
  Nihai oran ve koşullar için ilgili kurumla iletişime geçiniz.</p>
  <p><a href="{SITE}/">Katılım Plus</a> · <a href="{SITE}/arac/">Tüm araçlar</a> · <a href="{SITE}/blog/">Blog</a> · <a href="{SITE}/sozluk/">Sözlük</a> ·
  <a href="{APPSTORE}">App Store</a> · <a href="{PLAY}">Google Play</a></p>
</footer>
</div>
</body>
</html>
"""


def crumb(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}


def arac_sayfasi(p):
    url = f"{SITE}/arac/{p['slug']}/"
    diger = [s for s in SAYFALAR if s["slug"] != p["slug"]]
    # ilgili araçlar: sıradaki 4 sayfa (döngüsel) — her sayfa farklı komşular alır
    idx = [s["slug"] for s in SAYFALAR].index(p["slug"])
    komsu = [SAYFALAR[(idx + k) % len(SAYFALAR)] for k in (1, 2, 3, 4)]
    schema = [
        {"@context": "https://schema.org", "@type": "WebPage", "name": p["title"], "description": p["desc"], "url": url,
         "inLanguage": "tr", "isPartOf": {"@type": "WebSite", "name": "Katılım Plus", "url": SITE + "/"},
         "dateModified": BUGUN},
        crumb([("Katılım Plus", SITE + "/"), ("Araçlar", SITE + "/arac/"), (p["ad"], url)]),
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in p["sss"]]},
    ]
    h = head(p["title"], p["desc"], url, "\n".join(ld(s) for s in schema))
    h += f'<nav class="ek"><a href="{SITE}/">Ana sayfa</a> › <a href="{SITE}/arac/">Araçlar</a> › {E(p["ad"])}</nav>\n'
    h += f"<h1>{E(p['h1'])}</h1>\n<p class=\"giris\">{E(p['intro'])}</p>\n"
    h += f'<a class="cta" href="{SITE}{p["yol"]}">Uygulamada aç — ücretsiz hesapla →</a>\n'
    h += '<section class="kutu"><h2 style="margin-top:0">Neler yapabilirsiniz?</h2><ul class="l">' + "".join(f"<li>{E(x)}</li>" for x in p["ozellik"]) + "</ul></section>\n"
    h += '<section class="kutu"><h2 style="margin-top:0">Nasıl kullanılır?</h2><ol class="l">' + "".join(f"<li>{E(x)}</li>" for x in p["nasil"]) + "</ol></section>\n"
    if p.get("ornek"):
        h += f'<section class="kutu vurgu"><h2 style="margin-top:0">Örnek hesap</h2><p>{E(p["ornek"])}</p></section>\n'
    h += f'<p class="minik">{E(p["notu"])}</p>\n'
    h += "<h2>Sık sorulan sorular</h2>\n" + "".join(f"<details><summary>{E(q)}</summary><p>{E(a)}</p></details>\n" for q, a in p["sss"])
    if p.get("ek_link") or p.get("blog"):
        h += '<h2>İlgili sayfalar</h2><div class="kutu"><ul class="ilgili">'
        for yol, ad in p.get("ek_link", []):
            h += f'<li><a href="{SITE}{yol}">{E(ad)}</a></li>'
        for k in p.get("blog", []):
            ad, sl = B[k]
            h += f'<li><a href="{SITE}/blog/{sl}/">{E(ad)}</a></li>'
        h += "</ul></div>\n"
    h += '<h2>Diğer araçlar</h2><div class="izgara">' + "".join(
        f'<a class="kart" href="{SITE}/arac/{s["slug"]}/"><strong>{E(s["ad"])}</strong><span>{E(s["kisa"])}</span></a>' for s in komsu) + "</div>\n"
    h += f'<a class="cta" href="{SITE}{p["yol"]}">{E(p["ad"])} aracını aç →</a>\n'
    h += f'<p class="minik">Uygulamayı indirin: <a href="{APPSTORE}">App Store</a> · <a href="{PLAY}">Google Play</a></p>\n'
    return url, h + FOOT


def merkez_sayfasi():
    url = f"{SITE}/arac/"
    title = "Katılım Finansı Hesaplama Araçları | Katılım Plus"
    desc = "Katılım bankacılığı için ücretsiz hesaplama araçları: finansman, erken kapama, katılma hesabı getirisi, TCMB kurları, kamu haznedarlığı, KOBİ nakit akışı ve daha fazlası."
    schema = [
        {"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": desc, "url": url, "inLanguage": "tr",
         "mainEntity": {"@type": "ItemList", "itemListElement": [
             {"@type": "ListItem", "position": i + 1, "name": s["ad"], "url": f"{SITE}/arac/{s['slug']}/"} for i, s in enumerate(SAYFALAR)]}},
        crumb([("Katılım Plus", SITE + "/"), ("Araçlar", url)]),
    ]
    h = head(title, desc, url, "\n".join(ld(s) for s in schema))
    h += f'<nav class="ek"><a href="{SITE}/">Ana sayfa</a> › Araçlar</nav>\n<h1>Katılım Finansı Hesaplama Araçları</h1>\n'
    h += '<p class="giris">Katılım bankacılığında karar vermeyi kolaylaştıran hesaplayıcılar ve takip araçları. Hepsi Katılım Plus uygulamasında.</p>\n'
    h += '<div class="izgara">' + "".join(
        f'<a class="kart" href="{SITE}/arac/{s["slug"]}/"><strong>{E(s["ad"])}</strong><span>{E(s["kisa"])}</span></a>' for s in SAYFALAR) + "</div>\n"
    h += '<h2>Güncel veriler</h2><div class="kutu"><ul class="ilgili">'
    h += f'<li><a href="{SITE}/kar-payi-oranlari/">Katılım bankaları kâr payı ve finansman oranları</a></li>'
    h += f'<li><a href="{SITE}/blog/">Katılım finansı blog yazıları</a></li><li><a href="{SITE}/sozluk/">Finans sözlüğü</a></li>'
    h += f'<li><a href="{SITE}/katilim-bankaciligi-sektoru.html">Katılım bankacılığı sektörü</a></li></ul></div>\n'
    h += f'<a class="cta" href="{SITE}/">Katılım Plus\'ı aç →</a>\n'
    return url, h + FOOT


# ── Ana sayfa (index.html) ───────────────────────────────────────────────────
ISARET_BAS, ISARET_SON = "<!--SEO-ICERIK-BASLA-->", "<!--SEO-ICERIK-BITTI-->"
LD_BAS, LD_SON = "<!--SEO-LD-BASLA-->", "<!--SEO-LD-BITTI-->"


def ana_sayfa_ld():
    org = {"@context": "https://schema.org", "@type": "Organization", "name": "Katılım Plus", "url": SITE + "/",
           "logo": SITE + "/icon-512x512.png", "description": "Katılım finansı hesaplama ve piyasa takibi uygulaması."}
    site = {"@context": "https://schema.org", "@type": "WebSite", "name": "Katılım Plus", "url": SITE + "/", "inLanguage": "tr"}
    app = {"@context": "https://schema.org", "@type": "MobileApplication", "name": "Katılım Plus",
           "operatingSystem": "iOS, Android", "applicationCategory": "FinanceApplication",
           "description": "Katılım bankacılığı için finansman hesaplama, kâr payı oranları karşılaştırma, kur ve fon takibi.",
           "url": SITE + "/", "downloadUrl": [APPSTORE, PLAY]}
    return LD_BAS + "\n" + "\n".join(ld(x) for x in (org, site, app)) + "\n" + LD_SON


def ana_sayfa_icerik():
    s = ISARET_BAS + '\n<main id="seo-icerik" style="max-width:860px;margin:0 auto;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#EAF1FA;line-height:1.6;position:relative;z-index:0">\n'
    s += "<h1>Katılım Plus — Katılım Finansı Hesaplama ve Piyasa Takibi</h1>\n"
    s += "<p>Katılım bankacılığı için finansman hesaplama araçları, katılım bankalarının kâr payı oranları, TCMB döviz kurları, fon fiyatları ve AI asistan tek uygulamada.</p>\n"
    s += "<h2>Hesaplama ve takip araçları</h2>\n<ul>\n"
    for p in SAYFALAR:
        s += f'<li><a href="{SITE}/arac/{p["slug"]}/" style="color:#9FC1EA">{E(p["ad"])}</a> — {E(p["kisa"])}</li>\n'
    s += f'<li><a href="{SITE}/kar-payi-oranlari/" style="color:#9FC1EA">Katılım bankaları kâr payı ve finansman oranları</a></li>\n</ul>\n'
    s += f'<p><a href="{SITE}/arac/" style="color:#9FC1EA">Tüm araçlar</a> · <a href="{SITE}/blog/" style="color:#9FC1EA">Blog</a> · <a href="{SITE}/sozluk/" style="color:#9FC1EA">Sözlük</a> · '
    s += f'<a href="{APPSTORE}" style="color:#9FC1EA">App Store</a> · <a href="{PLAY}" style="color:#9FC1EA">Google Play</a></p>\n</main>\n' + ISARET_SON
    return s


def index_guncelle():
    yol = os.path.join(KOK, "index.html")
    t = open(yol, encoding="utf-8").read()
    # JSON-LD (head sonuna)
    t = re.sub(r"[ \t]*" + re.escape(LD_BAS) + r".*?" + re.escape(LD_SON) + r"\n?", "", t, flags=re.S)
    t = t.replace("    <style>\n      html, body", "    " + ana_sayfa_ld().replace("\n", "\n    ") + "\n    <style>\n      html, body", 1)
    assert LD_BAS in t, "index.html: JSON-LD yerlestirilemedi (beklenen <style> baslangici yok)"
    # Gövde içeriği (#root içinde; React bağlanınca yerini alır)
    t = re.sub(r"\n?" + re.escape(ISARET_BAS) + r".*?" + re.escape(ISARET_SON), "", t, flags=re.S)
    kapanis = '        <div class="spinner"></div>\n      </div>\n'
    assert t.count(kapanis) == 1, "index.html: #app-loader kapanisi bulunamadi"
    t = t.replace(kapanis, kapanis + ana_sayfa_icerik() + "\n", 1)
    # Açıklama metni (kısa ve net)
    open(yol, "w", encoding="utf-8", newline="\n").write(t)


def main():
    os.makedirs(os.path.join(PUBLIC, "arac"), exist_ok=True)
    slugs = set()
    for p in SAYFALAR:
        assert p["slug"] not in slugs, p["slug"]; slugs.add(p["slug"])
        assert len(p["desc"]) <= 175, (p["slug"], len(p["desc"]))
        assert len(p["title"]) <= 70, (p["slug"], len(p["title"]))
        for k in p.get("blog", []):
            assert k in B, (p["slug"], k)
        url, h = arac_sayfasi(p)
        klasor = os.path.join(PUBLIC, "arac", p["slug"]); os.makedirs(klasor, exist_ok=True)
        open(os.path.join(klasor, "index.html"), "w", encoding="utf-8", newline="\n").write(h)
    url, h = merkez_sayfasi()
    open(os.path.join(PUBLIC, "arac", "index.html"), "w", encoding="utf-8", newline="\n").write(h)
    index_guncelle()
    print(f"{len(SAYFALAR)} arac sayfasi + merkez + index.html guncellendi")


if __name__ == "__main__":
    main()
