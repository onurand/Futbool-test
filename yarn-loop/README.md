# Yarn Loop 🧶

Sıfırdan yazılmış, bağımlılıksız (vanilla JS + Canvas) hyper-casual **Yarn Loop**
klonu. Tek yapmanız gereken `index.html`'i tarayıcıda açmak.

## Nasıl oynanır

- Tahtada örgü ilmeklerinden (V dikişler) oluşan renkli bir desen var.
  Bir ilmek ancak **üstündeki hücre boşsa** sökülebilir — örgü yukarıdan
  aşağı sökülür.
- Alttaki **konveyörde** renkli, kapasiteli bobinler sırada bekler. Bir
  bobine dokununca kendi rengindeki açık ilmekleri tek tek toplar; her
  ilmek kapasitesini 1 azaltır.
- Kapasitesi **dolan bobin tamamlanır** ve uçar gider. Toplayacak ilmeği
  kalmayan ama kapasitesi artan bobin **askıya** (3 slot) alınır; sonra
  tekrar dokunup devam ettirebilirsiniz.
- Askı taşarsa ya da hiçbir bobin ilerleyemezse seviye **tıkanır** —
  sökme sırasını değiştirip yeniden denersiniz.
- Deseni tamamen sökünce seviye biter; askıyı ne kadar az kullanırsanız
  o kadar çok yıldız (≤1: 3★, 2: 2★, 3: 1★).

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
  seviye herkes için aynıdır. Desen kalıpları (kalp, yıldız, kelebek…)
  arasından seçilir; seviye ilerledikçe renk sayısı (3→7) artar ve
  bobin kapasiteleri değişkenleşir.
- **Her seviye çözülebilir** — bobinler, desen sanal olarak sökülerek
  üretilir: konveyör sırasını izleyen oyuncu her bobini tam doldurur.
  Kapasitelerin toplamı ilmek sayısına birebir eşittir; askı, sıradan
  sapanların emniyet alanıdır.
- Renk dağılımı, rastgele atamanın üzerine iki geçiş komşu-çoğunluğu
  yumuşatmasıyla kümeleştirilir (örgüdeki renk blokları gibi).
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
