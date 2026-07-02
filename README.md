# Yarn Loop 🧶

Sıfırdan yazılmış, bağımlılıksız (vanilla JS + Canvas) hyper-casual **Yarn Loop**
klonu. Tek yapmanız gereken `index.html`'i tarayıcıda açmak.

## Nasıl oynanır

- Renkli ip halkaları pinlere dolanmış ve üst üste binmiş durumda.
- Bir ipe dokununca, **üzerinden geçen ya da aynı pinde üstünde duran başka
  ip yoksa** çözülür ve alttaki yumağa sarılır.
- Engellenen bir ipe dokunursanız ip titrer, engelleyen ipler parlar ve
  hatalı dokunuş sayılır (yıldız puanınızı düşürür).
- Bütün ipleri sökünce seviye biter: 0 hata = 3 yıldız, ≤2 hata = 2 yıldız.

## Çalıştırma

```bash
# herhangi bir statik sunucu yeterli, ör:
npx serve yarn-loop
# veya dosyayı doğrudan açın:
open yarn-loop/index.html
```

## Mobil

Oyun kurulabilir bir **PWA**'dır (çevrimdışı çalışır, tam ekran) ve
**Capacitor** ile APK/IPA'ya paketlenebilir — ayrıntılar için
[`MOBILE.md`](MOBILE.md).

## Teknik notlar

- **Prosedürel seviyeler** — seed'li RNG (mulberry32) ile üretilir; N.
  seviye herkes için aynıdır. Seviye ilerledikçe pin (5→11) ve ip
  (2→11) sayısı artar.
- **Her seviye çözülebilir** — engelleme kuralı toplam bir z-sırasına
  dayandığı için en üstteki ip her zaman sökülebilir.
- İp geometrisi: seçilen pinlerin dışbükey zarfı, pin başına yığın
  indeksine göre artan köşe yarıçapıyla yuvarlatılır (aynı pindeki ipler
  gerçekteki gibi dıştan dışa istiflenir), sonra yoğun bir poliline
  örneklenir. Kesişim ve dokunma testleri bu örneklenmiş hat üzerinde yapılır.
- Ses: asset yok, ufak bir WebAudio synth (pop / sarma / hata / zafer).
- İlerleme `localStorage`'da tutulur.

## Dosyalar

| Dosya | İçerik |
| --- | --- |
| `index.html` | HUD, sahne, kazanma overlay'i |
| `style.css` | Görünüm |
| `game.js` | Seviye üretimi, geometri, çizim, animasyon, giriş, ses |

`game.js` Node altında da yüklenebilir (canvas gerektirmeyen mantık
fonksiyonlarını export eder) — böylece seviye üretimi ve çözülebilirlik
headless test edilebilir.
