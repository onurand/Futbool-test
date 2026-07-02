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

// AGP en az Java 17 ister; sistem JVM'i eskiyse Android Studio'nun
// beraberinde gelen JDK'yı (jbr) bul ve gradle'a onu kullandır
function javaMajor(javaHome) {
  const bin = javaHome ? path.join(javaHome, 'bin', 'java') : 'java';
  const out = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  const m = ((out.stderr || '') + (out.stdout || '')).match(/version "(\d+)(?:\.(\d+))?/);
  if (!m) return 0;
  return m[1] === '1' ? parseInt(m[2] || '0', 10) : parseInt(m[1], 10);
}

const env = Object.assign({}, process.env);
if (javaMajor(env.JAVA_HOME) < 17) {
  const jdkCandidates = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Android Studio', 'jbr'),
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    process.env.HOME && path.join(process.env.HOME, 'android-studio', 'jbr'),
    '/opt/android-studio/jbr'
  ].filter(Boolean);
  const jdk = jdkCandidates.find(function (p) { return fs.existsSync(p) && javaMajor(p) >= 17; });
  if (jdk) {
    env.JAVA_HOME = jdk;
    env.PATH = path.join(jdk, 'bin') + path.delimiter + env.PATH;
    console.log('Java 17+ olarak Android Studio JDK kullanılıyor:', jdk);
  } else {
    console.error('Sistem Java sürümü 17\'nin altında ve Android Studio JDK\'sı bulunamadı.');
    console.error('Android Studio kurun ya da JAVA_HOME\'u 17+ bir JDK\'ya yöneltin.');
    process.exit(1);
  }
}

const wrapper = isWin ? 'gradlew.bat' : './gradlew';
console.log('Gradle derlemesi başlıyor (ilk sefer bağımlılık indirir, birkaç dakika sürebilir)…');
const res = spawnSync(wrapper, ['assembleDebug'], {
  cwd: ANDROID,
  stdio: 'inherit',
  shell: isWin,
  env: env
});

if (res.status === 0) {
  const apk = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log('\nAPK hazır: ' + apk);
} else {
  process.exit(res.status || 1);
}
