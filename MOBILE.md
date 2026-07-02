# Yarn Loop — Mobil

Oyun iki şekilde mobil olarak oynanır: **PWA** (kurulum gerektirmez, hemen)
ve **Capacitor** ile native **APK / IPA**.

## 1) PWA — en hızlı yol

Oyun tam bir PWA: manifest, service worker (çevrimdışı çalışır), tam ekran
portre mod, safe-area desteği ve uygulama ikonları hazır.

1. `yarn-loop/` klasörünü herhangi bir **HTTPS** statik host'a koyun
   (GitHub Pages, Vercel, Netlify, Cloudflare Pages…).
2. Telefonda tarayıcıyla açın.
3. **Android/Chrome**: "Ana ekrana ekle" istemi çıkar (ya da menü → Uygulamayı yükle).
   **iOS/Safari**: Paylaş → "Ana Ekrana Ekle".
4. Ana ekrandaki Yarn Loop ikonu tam ekran, çevrimdışı çalışan bir oyun açar.

> Not: Service worker HTTPS (veya `localhost`) ister; `file://` ile
> açıldığında oyun yine çalışır ama kurulabilirlik/çevrimdışı özellikleri devreye girmez.

## 2) Capacitor — APK / IPA

Gerekli config bu klasörde hazır (`capacitor.config.json`, `package.json`).

**Önkoşullar:** [Git](https://git-scm.com), [Node.js](https://nodejs.org) ve
[Android Studio](https://developer.android.com/studio) (Android SDK'yı kurar).

**Windows (PowerShell)** — eski PowerShell `&&` desteklemediği için komutlar
tek tek (repo'yu daha önce klonladıysanız ilk üç satırı atlayın):

```powershell
git clone https://github.com/onurand/Futbool-test.git
cd Futbool-test
git checkout claude/yarn-loop-oyunu-clone-cpkm33
cd yarn-loop
npm install
npx cap add android
npm run apk
# çıktı: android\app\build\outputs\apk\debug\app-debug.apk
```

**macOS / Linux:**

```bash
git clone https://github.com/onurand/Futbool-test.git
cd Futbool-test && git checkout claude/yarn-loop-oyunu-clone-cpkm33
cd yarn-loop
npm install
npx cap add android
npm run apk
# çıktı: android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run apk` her platformda çalışır: doğru gradle wrapper'ını seçer ve
Android SDK'yı (`ANDROID_HOME` ya da Android Studio'nun varsayılan kurulum
yolundan) bulup `local.properties`'e yazar. APK'yı telefona atıp
kurabilirsiniz ("bilinmeyen kaynaklara izin ver" gerekir).

Android Studio ile açmak için: `npm run android`.

iOS için (macOS + Xcode):

```bash
npx cap add ios
npm run sync
npx cap open ios       # Xcode'dan imzalayıp çalıştırın
```

- Uygulama kimliği: `com.madbyte.yarnloop` (capacitor.config.json'dan değiştirilebilir)
- `www/`, `android/`, `ios/` üretilen çıktılar oldukları için gitignore'da;
  kaynak dosyalar klasör kökünde yaşar, `npm run build` kopyalar.

> Bu repo'nun çalıştığı bulut ortamında `dl.google.com` ağ politikasınca
> kapalı olduğundan APK burada derlenemiyor; Android SDK'lı herhangi bir
> makinede `npm run apk` yeterli.

## Mobil için yapılmış işler

- `viewport-fit=cover` + `env(safe-area-inset-*)` — çentikli ekranlarda taşma yok
- `overscroll-behavior: none`, `position: fixed` — iOS lastik kaydırma / pull-to-refresh kapalı
- `touch-action` ayarları — çift dokunuş zoom'u yok, dokunuş gecikmesi yok
- Pointer Events — dokunma ve fare aynı kod yolu
- Responsive canvas + devicePixelRatio — her ekranda keskin çizim
- Ses, ilk dokunuşta başlatılan WebAudio (mobil autoplay kısıtına uyumlu)
