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

  var PALETTE = [
    '#e5484d', '#f76b15', '#ffc53d', '#46a758', '#00a2c7',
    '#3e63dd', '#8e4ec6', '#e93d82', '#f4f0e6', '#3b3b40'
  ];

  var PATTERNS = [
    { name: 'kalp', rows: [
      '............',
      '..AA....AA..',
      '.AAAA..AAAA.',
      'AAAAAAAAAAAA',
      'AAAAAAAAAAAA',
      'AAAAAAAAAAAA',
      '.AAAAAAAAAA.',
      '..AAAAAAAA..',
      '...AAAAAA...',
      '....AAAA....',
      '.....AA.....',
      '............'
    ] },
    { name: 'gül', rows: [
      '............',
      '....AAAA....',
      '...AAAAAA...',
      '..AAAAAAAA..',
      '..AAAAAAAA..',
      '...AAAAAA...',
      '....AAAA....',
      '.B...BB...B.',
      '.BB..BB..BB.',
      '..BBBBBBBB..',
      '.....BB.....',
      '.....BB.....'
    ] },
    { name: 'civciv', rows: [
      '............',
      '.....CCC....',
      '....CCCCC...',
      '...AAAAAAA..',
      '..AAAADAAA..',
      '..AAAAAAAA..',
      '.AAAAAAAAAA.',
      '.AAABBAAAAA.',
      '..AABBBAAA..',
      '...AAAAAA...',
      '....CC.CC...',
      '............'
    ] },
    { name: 'kiraz', rows: [
      '............',
      '......BB....',
      '.....BB.....',
      '....BB.B....',
      '...BB...B...',
      '..AAA...AAA.',
      '.AAAAA.AAAAA',
      '.AAAAA.AAAAA',
      '.AAAAA.AAAAA',
      '..AAA...AAA.',
      '............',
      '............'
    ] },
    { name: 'yıldız', rows: [
      '............',
      '.....AA.....',
      '.....AA.....',
      '....AAAA....',
      'AAAAAAAAAAAA',
      '.AAAAAAAAAA.',
      '..AAAAAAAA..',
      '...AAAAAA...',
      '...AAAAAA...',
      '..AAA..AAA..',
      '.AA......AA.',
      '............'
    ] },
    { name: 'ev', rows: [
      '............',
      '.....BB.....',
      '....BBBB....',
      '...BBBBBB...',
      '..BBBBBBBB..',
      '.BBBBBBBBBB.',
      '..AAAAAAAA..',
      '..AAADDAAA..',
      '..AAADDAAA..',
      '..AAADDAAA..',
      '..AAAAAAAA..',
      '............'
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
    var rnd = mulberry32(n * 7919 + 271);
    var pattern = PATTERNS[Math.floor(rnd() * PATTERNS.length)];
    var rows = pattern.rows.length, cols = pattern.rows[0].length;

    var roles = ['.'];
    pattern.rows.forEach(function (row) {
      row.split('').forEach(function (ch) {
        if (roles.indexOf(ch) === -1) roles.push(ch);
      });
    });

    var colors = PALETTE.slice();
    for (var i = colors.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = colors[i]; colors[i] = colors[j]; colors[j] = tmp;
    }
    colors = colors.slice(0, roles.length);

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

    var splitChance = Math.min(0.25 + n * 0.04, 0.75);
    var open = {};
    var spools = [];
    for (i = 0; i < stream.length; i++) {
      var col = stream[i].color;
      if (!(open[col] > 0)) {
        var remainingTotal = 0;
        for (var s2 = i; s2 < stream.length; s2++) {
          if (stream[s2].color === col) remainingTotal++;
        }
        var cap = remainingTotal;
        if (remainingTotal > 8 && rnd() < splitChance) {
          cap = Math.max(4, Math.ceil(remainingTotal * (0.35 + rnd() * 0.4)));
        }
        spools.push({ color: col, cap: cap });
        open[col] = cap;
      }
      open[col]--;
    }

    return {
      n: n, name: pattern.name, rows: rows, cols: cols,
      grid: grid, colors: colors, stream: stream, spools: spools
    };
  }

  function buildTray(level) {
    var trayCols = [[], [], [], [], []];
    level.spools.forEach(function (sp, i) {
      trayCols[i % 5].push({ color: sp.color, cap: sp.cap });
    });
    return trayCols;
  }

  function solveCheck(level) {
    var trayCols = buildTray(level);
    var dock = [];
    var pos = 0;
    var guard = level.stream.length * 4 + 50;
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
      var found = false;
      for (var t = 0; t < 5; t++) {
        if (trayCols[t].length && trayCols[t][0].color === need) {
          if (dock.length >= 5) return false;
          dock.push(trayCols[t].shift());
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return pos === level.stream.length && guard > 0;
  }

  var api = {
    PALETTE: PALETTE,
    generateLevel: generateLevel,
    buildTray: buildTray,
    solveCheck: solveCheck
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.YarnLogic = api;
  }
})(this);
