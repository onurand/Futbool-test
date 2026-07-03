/*
 * Yarn Loop — oyun mantığı (görselden bağımsız).
 *
 * Tahtada piksel-örgü bir resim var; arka plan dahil her hücre bir ilmek.
 * Resim örüldüğü sıranın tersine sökülür: son ilmekten geriye, satır satır
 * serpantin. Makara kapasiteleri akış sanal oynatılarak üretilir (renk
 * başına tek açık makara) ve tepsiye açılış sırasıyla dağıtılır — her
 * seviyenin konveyör sırasını izleyen garantili bir çözümü vardır.
 *
 * Bu dosya hem tarayıcıda (window.YarnLogic) hem Node'da (module.exports)
 * çalışır; Node tarafı seviye üretimi ve çözülebilirlik testleri içindir.
 */
(function (root) {
  'use strict';

  // canlı şeker paleti (cute görünüm)
  var PALETTE = [
    '#ff5677', '#ff9f2e', '#ffd93d', '#4cd471', '#35c7f4',
    '#5f7cff', '#c168ff', '#ff7ad9', '#fff3e0', '#5a4a52'
  ];

  var PATTERNS = [
    { name: 'kalp', colors: { '.': '#fff3e0', 'A': '#ff5677' }, rows: [
      '..............',
      '...AA....AA...',
      '..AAAA..AAAA..',
      '.AAAAAAAAAAAA.',
      '.AAAAAAAAAAAA.',
      '.AAAAAAAAAAAA.',
      '..AAAAAAAAAA..',
      '...AAAAAAAA...',
      '....AAAAAA....',
      '.....AAAA.....',
      '......AA......',
      '..............'
    ] },
    { name: 'yıldız', colors: { '.': '#5f7cff', 'A': '#ffd93d' }, rows: [
      '..............',
      '......AA......',
      '......AA......',
      '.....AAAA.....',
      '.AAAAAAAAAAAA.',
      '..AAAAAAAAAA..',
      '...AAAAAAAA...',
      '....AAAAAA....',
      '....AAAAAA....',
      '...AAA..AAA...',
      '..AA......AA..',
      '..............'
    ] },
    { name: 'ay', colors: { '.': '#5f7cff', 'A': '#ffd93d', 'B': '#fff3e0' }, rows: [
      '..............',
      '.....AAAA.....',
      '....AAAA...B..',
      '...AAAA.......',
      '...AAA....B...',
      '...AAA........',
      '...AAA....B...',
      '...AAAA.......',
      '....AAAA..B...',
      '.....AAAA.....',
      '..............'
    ] },
    { name: 'balık', colors: { '.': '#6cbdf2', 'A': '#ff9f2e', 'B': '#5a4a52' }, rows: [
      '..............',
      '....AAAAA...A.',
      '..AAAAAAAA.AA.',
      '.AAAABAAAAAAA.',
      '.AAAAAAAAAAAA.',
      '..AAAAAAAA.AA.',
      '....AAAAA...A.',
      '..............'
    ] },
    { name: 'kiraz', colors: { '.': '#fff3e0', 'A': '#ff5677', 'B': '#4cd471' }, rows: [
      '..............',
      '.......BB.....',
      '......BB......',
      '.....BB.B.....',
      '....BB...B....',
      '...AAA...AAA..',
      '..AAAAA.AAAAA.',
      '..AAAAA.AAAAA.',
      '..AAAAA.AAAAA.',
      '...AAA...AAA..',
      '..............'
    ] },
    { name: 'elma', colors: { '.': '#fff3e0', 'A': '#ff5677', 'B': '#4cd471' }, rows: [
      '..............',
      '.......BB.....',
      '......BB......',
      '....AAAAAA....',
      '...AAAAAAAA...',
      '..AAAAAAAAAA..',
      '..AAAAAAAAAA..',
      '..AAAAAAAAAA..',
      '...AAAAAAAA...',
      '....AA..AA....',
      '..............'
    ] },
    { name: 'balon', colors: { '.': '#6cbdf2', 'B': '#ff5677', 'D': '#5a4a52' }, rows: [
      '..............',
      '....BBBBBB....',
      '...BBBBBBBB...',
      '...BBBBBBBB...',
      '...BBBBBBBB...',
      '....BBBBBB....',
      '.....BBBB.....',
      '......BB......',
      '......D.......',
      '.....D........',
      '......D.......',
      '..............'
    ] },
    { name: 'güneş', colors: { '.': '#6cbdf2', 'B': '#ffd93d' }, rows: [
      '..............',
      '..B...BB...B..',
      '.....BBBB.....',
      '..B.BBBBBB.B..',
      '....BBBBBB....',
      '..B.BBBBBB.B..',
      '.....BBBB.....',
      '..B...BB...B..',
      '..............'
    ] },
    { name: 'fiyonk', colors: { '.': '#fff3e0', 'B': '#ff7ad9', 'D': '#c168ff' }, rows: [
      '..............',
      '..BB......BB..',
      '.BBBB....BBBB.',
      '.BBBBB..BBBBB.',
      '.BBBBBDDBBBBB.',
      '.BBBBBDDBBBBB.',
      '.BBBBB..BBBBB.',
      '.BBBB....BBBB.',
      '..BB......BB..',
      '..............'
    ] },
    { name: 'elmas', colors: { '.': '#fff3e0', 'B': '#35c7f4', 'A': '#8fd6f7' }, rows: [
      '..............',
      '....BBBBBB....',
      '...BABBBBAB...',
      '..BBBBBBBBBB..',
      '...BBBBBBBB...',
      '....BBBBBB....',
      '.....BBBB.....',
      '......BB......',
      '..............'
    ] },
    { name: 'futbol topu', colors: { '.': '#4cd471', 'A': '#fff9ee', 'D': '#5a4a52' }, rows: [
      '..............',
      '....AAAAAA....',
      '..AAAADDAAAA..',
      '.AAAAADDAAAAA.',
      '.AADAAAAAADAA.',
      '.AADAAAAAADAA.',
      '.AAAAADDAAAAA.',
      '..AAAADDAAAA..',
      '....AAAAAA....',
      '..............'
    ] },
    { name: 'ev', colors: { '.': '#6cbdf2', 'A': '#fff3e0', 'B': '#ff5677', 'D': '#ff9f2e' }, rows: [
      '..............',
      '......BB......',
      '.....BBBB.....',
      '....BBBBBB....',
      '...BBBBBBBB...',
      '..BBBBBBBBBB..',
      '...AAAAAAAA...',
      '...AAADDAAA...',
      '...AAADDAAA...',
      '...AAAAAAAA...',
      '..............'
    ] },
    { name: 'civciv', colors: { '.': '#6cbdf2', 'A': '#ffd93d', 'B': '#ff9f2e', 'C': '#ff9f2e', 'D': '#5a4a52' }, rows: [
      '..............',
      '......CCC.....',
      '.....CCCCC....',
      '....AAAAAAA...',
      '...AAAADAAA...',
      '...AAAAAAAA...',
      '..AAAAAAAAAA..',
      '..AAABBAAAAA..',
      '...AABBBAAA...',
      '....AAAAAA....',
      '.....CC.CC....',
      '..............'
    ] },
    { name: 'dondurma', colors: { '.': '#fff3e0', 'B': '#ff7ad9', 'D': '#fff9ee', 'A': '#e0a35c' }, rows: [
      '..............',
      '.....BBBB.....',
      '....BBBBBB....',
      '....DDDDDD....',
      '....DDDDDD....',
      '.....AAAA.....',
      '.....AAAA.....',
      '......AA......',
      '......AA......',
      '..............'
    ] },
    { name: 'kuş', colors: { '.': '#8fd6f7', 'A': '#35c7f4', 'B': '#5a4a52', 'D': '#ff9f2e' }, rows: [
      '..............',
      '.....AAAA.....',
      '....AABAAA....',
      '.DDAAAAAAA....',
      '....AAAAAAAA..',
      '....AAAAAA....',
      '.....AAAA.....',
      '......AA......',
      '.....D.D......',
      '..............'
    ] },
    { name: 'tavşan', colors: { '.': '#6cbdf2', 'A': '#fff3e0', 'B': '#5a4a52', 'D': '#ff7ad9' }, rows: [
      '...AA....AA...',
      '...AA....AA...',
      '...AA....AA...',
      '..AAAAAAAAAA..',
      '.AAAAAAAAAAAA.',
      '.AABBAAAABBAA.',
      '.AAAAAAAAAAAA.',
      '.AAAAADDAAAAA.',
      '..AAAAAAAAAA..',
      '...AAAAAAAA...',
      '..............'
    ] },
    { name: 'kedi', colors: { '.': '#6cbdf2', 'A': '#ff9f2e', 'B': '#5a4a52', 'D': '#ff7ad9' }, rows: [
      '..............',
      '..AA......AA..',
      '..AAA....AAA..',
      '..AAAAAAAAAA..',
      '.AAAAAAAAAAAA.',
      '.AABBAAAABBAA.',
      '.AAAAAAAAAAAA.',
      '.AAAADAADAAAA.',
      '..AAAADDAAAA..',
      '...AAAAAAAA...',
      '..............'
    ] },
    { name: 'köpek', colors: { '.': '#6cbdf2', 'A': '#d8a35f', 'B': '#8a5a36', 'D': '#5a4a52' }, rows: [
      '..............',
      '.BB........BB.',
      '.BBB......BBB.',
      '.BBAAAAAAAABB.',
      '..AAAAAAAAAA..',
      '..ADAAAAAADA..',
      '..AAAAAAAAAA..',
      '..AAAADDAAAA..',
      '...AAADDAAA...',
      '....AAAAAA....',
      '..............'
    ] },
    { name: 'kurbağa', colors: { '.': '#6cbdf2', 'A': '#4cd471', 'B': '#5a4a52', 'D': '#5a4a52' }, rows: [
      '..............',
      '..AA......AA..',
      '.AABA....ABAA.',
      '.AAAAAAAAAAAA.',
      '.AAAAAAAAAAAA.',
      '..AADAAAADAA..',
      '..AAADDDDAAA..',
      '...AAAAAAAA...',
      '..............'
    ] },
    { name: 'gül', colors: { '.': '#fff3e0', 'A': '#ff5677', 'B': '#4cd471' }, rows: [
      '..............',
      '.....AAAA.....',
      '....AAAAAA....',
      '...AAAAAAAA...',
      '...AAAAAAAA...',
      '....AAAAAA....',
      '.....AAAA.....',
      '.B....BB....B.',
      '.BB...BB...BB.',
      '..BBBBBBBBBB..',
      '......BB......',
      '..............'
    ] },
    { name: 'mantar', colors: { '.': '#fff3e0', 'B': '#ff5677', 'A': '#fff9ee', 'D': '#f0d9b8' }, rows: [
      '..............',
      '....BBBBBB....',
      '..BBAABBAABB..',
      '.BBAABBBBAABB.',
      '.BBBBBBBBBBBB.',
      '.BBAABBBBAABB.',
      '..BBBBBBBBBB..',
      '...DDDDDDDD...',
      '...DDBDDBDD...',
      '...DDDDDDDD...',
      '..............'
    ] },
    { name: 'cupcake', colors: { '.': '#6cbdf2', 'B': '#ff7ad9', 'D': '#ff5677', 'A': '#e0a35c' }, rows: [
      '..............',
      '......BB......',
      '....BBBBBB....',
      '...BBBBBBBB...',
      '..DDDDDDDDDD..',
      '...AAAAAAAA...',
      '...AAAAAAAA...',
      '...AAAAAAAA...',
      '....AAAAAA....',
      '..............'
    ] },
    { name: 'ördek', colors: { '.': '#6cbdf2', 'B': '#ffd93d', 'A': '#5a4a52', 'D': '#ff9f2e' }, rows: [
      '..............',
      '........BBBB..',
      '.......BBABB..',
      '.....DDBBBB...',
      '.......BBBB...',
      '..BBBBBBBBB...',
      '..BBBBBBBBB...',
      '...BBBBBBB....',
      '....BBBBB.....',
      '..............'
    ] },
    { name: 'uğur böceği', colors: { '.': '#5ecb84', 'A': '#ff5677', 'B': '#5a4a52' }, rows: [
      '..............',
      '.....BBBB.....',
      '....BBBBBB....',
      '..AAAABBAAAA..',
      '.AABAABBAABAA.',
      '.AAAAABBAAAAA.',
      '.AABAABBAABAA.',
      '..AAAABBAAAA..',
      '...AAABBAAA...',
      '..............'
    ] },
    { name: 'penguen', colors: { '.': '#6cbdf2', 'B': '#5a4a52', 'A': '#fff9ee', 'D': '#ff9f2e' }, rows: [
      '..............',
      '....BBBBBB....',
      '...BBBBBBBB...',
      '...BABBBBAB...',
      '...BBBDDBBB...',
      '..BBAAAAAABB..',
      '..BBAAAAAABB..',
      '..BBAAAAAABB..',
      '...BAAAAAAB...',
      '...DD....DD...',
      '..............'
    ] },
    { name: 'panda', colors: { '.': '#5ecb84', 'A': '#fff9ee', 'B': '#5a4a52', 'D': '#5a4a52' }, rows: [
      '..............',
      '..BB......BB..',
      '..AAAAAAAAAA..',
      '.AAAAAAAAAAAA.',
      '.ABBAAAAAABBA.',
      '.ABBAAAAAABBA.',
      '.AAAAADDAAAAA.',
      '..AAAADDAAAA..',
      '...AAAAAAAA...',
      '..............'
    ] },
    { name: 'roket', colors: { '.': '#5f7cff', 'A': '#fff3e0', 'B': '#ff5677', 'D': '#ff9f2e' }, rows: [
      '..............',
      '......AA......',
      '.....AAAA.....',
      '.....ADDA.....',
      '.....ADDA.....',
      '.....AAAA.....',
      '....BAAAAB....',
      '...BBAAAABB...',
      '...BB.AA.BB...',
      '......DD......',
      '..............'
    ] },
    { name: 'taç', colors: { '.': '#b591f2', 'B': '#ffd93d', 'D': '#ff5677' }, rows: [
      '..............',
      '..B...BB...B..',
      '..BB.BBBB.BB..',
      '..BBBBBBBBBB..',
      '..BBDBBBBDBB..',
      '..BBBBBBBBBB..',
      '..............'
    ] },
    { name: 'yumak', colors: { '.': '#fff3e0', 'A': '#ff5677', 'B': '#ff92ac' }, rows: [
      '..............',
      '....AAAAAA....',
      '..AABBBBBBAA..',
      '.AABAAAAAABAA.',
      '.ABAABBBBAABA.',
      '.ABABAAAABABA.',
      '.AABAABBAABAA.',
      '..AABBAABBAA..',
      '....AAAAAA....',
      '..........A...',
      '..............'
    ] },
    { name: 'çiçek', colors: { '.': '#6cbdf2', 'B': '#ff7ad9', 'D': '#ffd93d', 'A': '#4cd471', 'C': '#4cd471' }, rows: [
      '..............',
      '....BB..BB....',
      '...BBBBBBBB...',
      '...BBBDDBBB...',
      '...BBBDDBBB...',
      '....BBBBBB....',
      '......AA......',
      '...C..AA..C...',
      '....CCAACC....',
      '......AA......',
      '..............'
    ] }
  ];

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateLevel(n) {
    var pattern = PATTERNS[(n - 1) % PATTERNS.length];

    // Aynı desen için farklı tohumlarla dener; çözülemeyen tohumu atlar.
    // Son çare: renk başına tek makara + zincirsiz (kanıtlanabilir çözüm).
    for (var attempt = 0; attempt < 12; attempt++) {
      var level = buildAttempt(n, pattern, attempt, false);
      if (solveCheck(level)) return level;
    }
    return buildAttempt(n, pattern, 0, true);
  }

  function buildAttempt(n, pattern, attempt, safeMode) {
    var rnd = mulberry32(n * 7919 + 271 + attempt * 104729);
    var rows = pattern.rows.length, cols = pattern.rows[0].length;

    var roles = ['.'];
    pattern.rows.forEach(function (row) {
      row.split('').forEach(function (ch) {
        if (roles.indexOf(ch) === -1) roles.push(ch);
      });
    });

    // desen sabit renk tanımlıyorsa onu kullan (panda siyah-beyaz kalsın),
    // tanımsız roller karıştırılmış paletten tamamlanır
    var shuffled = PALETTE.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    var colors = roles.map(function (ch, ri) {
      if (pattern.colors && pattern.colors[ch]) return pattern.colors[ch];
      return shuffled[ri % shuffled.length];
    });

    var grid = pattern.rows.map(function (row) {
      return row.split('').map(function (ch) { return roles.indexOf(ch); });
    });

    var stream = [];
    for (var r = rows - 1; r >= 0; r--) {
      var rightToLeft = (rows - 1 - r) % 2 === 0;
      for (var k = 0; k < cols; k++) {
        var c = rightToLeft ? cols - 1 - k : k;
        stream.push({ c: c, r: r, color: grid[r][c] });
      }
    }

    // kapasiteler sınırlı tutulur ki her seviyede tepsi makaralarla dolsun;
    // safeMode: renk başına tek makara (kanıtlanabilir çözüm)
    var capMax = Math.max(6, Math.ceil(stream.length / 12));
    var open = {};
    var spools = [];
    for (i = 0; i < stream.length; i++) {
      var col = stream[i].color;
      if (!(open[col] > 0)) {
        var remainingTotal = 0;
        for (var s2 = i; s2 < stream.length; s2++) {
          if (stream[s2].color === col) remainingTotal++;
        }
        var cap = safeMode ? remainingTotal
          : Math.min(remainingTotal, 4 + Math.floor(rnd() * capMax));
        spools.push({ color: col, cap: cap });
        open[col] = cap;
      }
      open[col]--;
    }

    var level = {
      n: n, name: pattern.name, rows: rows, cols: cols,
      grid: grid, colors: colors, stream: stream, spools: spools
    };

    // bağlı makaralar: ardışık 2'li ya da 3'lü zincir — tepside üst üste
    // dururlar, öndekini alınca ZİNCİRİN TAMAMI raya biner.
    if (n >= 5 && !safeMode) {
      var linkChance = Math.min(0.10 + n * 0.01, 0.3);
      for (i = 0; i + 1 < spools.length; i++) {
        if (spools[i].linkNext !== undefined) continue;
        if (rnd() < linkChance) {
          var chainLen = (rnd() < 0.35 && i + 2 < spools.length) ? 3 : 2;
          chainLen = Math.min(chainLen, spools.length - i);
          for (var c2 = 0; c2 < chainLen - 1; c2++) {
            spools[i + c2].linkNext = i + c2 + 1;
          }
          i += chainLen - 1;
        }
      }
      if (!solveCheck(level)) {
        spools.forEach(function (sp) { delete sp.linkNext; });
      }
    }

    return level;
  }


  // zincir uzunluğu: idx'ten ileriye kaç makara bağlı (kendisi dahil)
  function chainLength(spools, i) {
    var len = 1;
    while (spools[i + len - 1] && spools[i + len - 1].linkNext === i + len) len++;
    return len;
  }

  // tepsi: makaralar açılış sırasıyla sütunlara dağıtılır; zincir AYNI
  // sütuna üst üste konur (öndekiyle birlikte arkadakiler de gelir)
  function buildTray(level) {
    var trayCols = [[], [], [], [], []];
    var col = 0;
    for (var i = 0; i < level.spools.length; i++) {
      var len = chainLength(level.spools, i);
      for (var k = 0; k < len; k++) {
        var sp = level.spools[i + k];
        trayCols[col].push({ color: sp.color, cap: sp.cap, idx: i + k, linkNext: sp.linkNext });
      }
      i += len - 1;
      col = (col + 1) % 5;
    }
    return trayCols;
  }

  // sütun önündeki zincirin uzunluğu (tepsi öğeleri üstünden)
  function frontChainLength(colArr) {
    var len = 1;
    while (colArr[len - 1] && colArr[len] && colArr[len - 1].linkNext === colArr[len].idx) len++;
    return len;
  }

  function solveCheck(level) {
    // Akıllı çözücü: gereken renk öndeyse bindirir; gömülüyse rengi en sığ
    // derinlikte barındıran sütunu KAZAR (önündekileri raya bindirir).
    // Rayda 5 slot sınırı her adımda gözetilir.
    var trayCols = buildTray(level);
    var dock = [];
    var pos = 0;
    var guard = level.stream.length * 6 + 200;
    function boardFrom(t) {
      var len = frontChainLength(trayCols[t]);
      if (dock.length + len > 5) return false;
      for (var k = 0; k < len; k++) dock.push(trayCols[t].shift());
      return true;
    }
    while (pos < level.stream.length && guard-- > 0) {
      var need = level.stream[pos].color;
      var spool = null;
      for (var d = 0; d < dock.length; d++) {
        if (dock[d].color === need && dock[d].cap > 0) { spool = dock[d]; break; }
      }
      if (spool) {
        spool.cap--;
        pos++;
        if (spool.cap === 0) dock.splice(dock.indexOf(spool), 1);
        continue;
      }
      var t, direct = -1;
      for (t = 0; t < 5; t++) {
        if (trayCols[t].length && trayCols[t][0].color === need) { direct = t; break; }
      }
      if (direct >= 0) {
        if (!boardFrom(direct)) return false;
        continue;
      }
      // kazı: need rengini en sığ derinlikte içeren sütun
      var best = -1, bestDepth = Infinity;
      for (t = 0; t < 5; t++) {
        for (var d2 = 1; d2 < trayCols[t].length; d2++) {
          if (trayCols[t][d2].color === need && d2 < bestDepth) { bestDepth = d2; best = t; }
        }
      }
      if (best < 0) return false;
      if (!boardFrom(best)) return false;
    }
    return pos === level.stream.length && guard > 0;
  }


  var api = {
    PALETTE: PALETTE,
    generateLevel: generateLevel,
    buildTray: buildTray,
    frontChainLength: frontChainLength,
    solveCheck: solveCheck
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.YarnLogic = api;
  }
})(this);
