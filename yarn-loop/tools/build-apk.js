/* Cross-platform debug APK build: runs the right gradle wrapper on
 * Windows / macOS / Linux and points gradle at the Android SDK if it
 * can find one (local.properties). */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');

if (!fs.existsSync(ANDROID)) {
  console.error('android/ yok. Önce şunu çalıştırın:  npx cap add android');
  process.exit(1);
}

// gradle, SDK'yı ANDROID_HOME ya da local.properties'ten bulur —
// yaygın kurulum yollarını deneyip local.properties'i kendimiz yazalım
const localProps = path.join(ANDROID, 'local.properties');
if (!fs.existsSync(localProps) && !process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk')
  ].filter(Boolean);
  const sdk = candidates.find(fs.existsSync);
  if (sdk) {
    fs.writeFileSync(localProps, 'sdk.dir=' + sdk.replace(/\\/g, '\\\\') + '\n');
    console.log('Android SDK bulundu:', sdk);
  } else {
    console.error('Android SDK bulunamadı. Android Studio kurun ya da ANDROID_HOME ayarlayın.');
    console.error('Alternatif: "npx cap open android" ile Android Studio üzerinden derleyin.');
    process.exit(1);
  }
}

const isWin = process.platform === 'win32';
const wrapper = isWin ? 'gradlew.bat' : './gradlew';
console.log('Gradle derlemesi başlıyor (ilk sefer bağımlılık indirir, birkaç dakika sürebilir)…');
const res = spawnSync(wrapper, ['assembleDebug'], {
  cwd: ANDROID,
  stdio: 'inherit',
  shell: isWin
});

if (res.status === 0) {
  const apk = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log('\nAPK hazır: ' + apk);
} else {
  process.exit(res.status || 1);
}
