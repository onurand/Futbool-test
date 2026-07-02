/*
 * Yarn Loop — knit-unravel clone (Combo Games'in Yarn Loop oyununun
 * mekaniği, ekran görüntülerinden birebir).
 *
 * Tahtada piksel-örgü bir resim var (arka plan dahil her hücre bir ilmek).
 * Resim, örüldüğü sıranın TERSİNE sökülür: son ilmekten (sağ alt) geriye,
 * satır satır serpantin. Sökülen ip, resmin etrafındaki RAYDA gezinen
 * aktif makaraya sarılır.
 *
 * Alt tepside renkli, kapasiteli makaralar durur (5 sütun; yalnızca en
 * öndeki alınabilir). Bir makaraya dokununca YUVAYA (5 slot) yerleşir.
 * Söküm otomatik akar: sıradaki ilmeğin renginde, kapasitesi kalan bir
 * yuva makarası varsa o makara raya çıkar ve ilmekleri sarar; her ilmek
 * kapasitesini 1 azaltır. Kapasitesi biten makara tamamlanır, yuvası
 * boşalır. Sıradaki renk yuvada yoksa akış bekler — doğru makarayı tepsiden
 * eklersiniz. Yuva doluyken sıradaki renge uyan makara yoksa TIKANIRSINIZ.
 * Resim tamamen sökülünce seviye biter.
 *
 * Görsel katman: ilmekler ve makaralar offscreen sprite olarak bir kez
 * yüksek çözünürlükte çizilir; tüm hareketler easing'li tween'lerle akar.
 */
(function () {
  'use strict';

  // ---------- sabitler ----------
  var W = 420;
  var H = 700;
  var BOARD = { x: 70, y: 96, w: 280, h: 280 };
  var RAIL_PAD = 26;
  var DOCK_Y = 478;
  var DOCK_X = [66, 138, 210, 282, 354];
  var TRAY_Y = 606;
  var TRAY_X = [66, 138, 210, 282, 354];
  var STITCH_MS = 105;

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

  // ---------- yardımcılar ----------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shadeColor(hex, amt) {
    if (hex[0] !== '#') return hex;
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var target = amt > 0 ? 255 : 0;
    var t = Math.abs(amt);
    r = Math.round(r + (target - r) * t);
    g = Math.round(g + (target - g) * t);
    b = Math.round(b + (target - b) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---------- seviye üretimi ----------
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

  if (typeof window === 'undefined') {
    module.exports = { generateLevel: generateLevel, buildTray: buildTray, solveCheck: solveCheck };
    return;
  }

  // =====================================================================
  //                              TARAYICI
  // =====================================================================
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');

  var levelNum = parseInt(localStorage.getItem('yarnloop.level') || '1', 10);
  if (!(levelNum >= 1)) levelNum = 1;

  var level = null;
  var alive = null;
  var cell = 0, boardX = 0, boardY = 0;
  var pos = 0;
  var trayCols = null;
  var dock = [null, null, null, null, null];
  var rider = null;
  var railT = 0.62;
  var stitchTimer = 0;
  var flyers = [];
  var particles = [];
  var confetti = [];
  var dying = [];
  var won = false, failed = false;
  var maxDockUsed = 0;
  var stalledSince = 0;
  var shakeT = 0;
  var boardPulse = 0;
  var lastTime = 0;
  var now = 0;

  // ---------- easing & tween ----------
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  }

  var tweens = [];
  function tween(obj, props, dur, ease, onDone) {
    var from = {};
    Object.keys(props).forEach(function (k) { from[k] = obj[k]; });
    tweens.push({ obj: obj, props: props, from: from, t: 0, dur: dur, ease: ease || easeOutCubic, onDone: onDone });
  }
  function updateTweens(dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      tw.t += dt;
      var k = Math.min(tw.t / tw.dur, 1);
      var e = tw.ease(k);
      Object.keys(tw.props).forEach(function (p) {
        tw.obj[p] = tw.from[p] + (tw.props[p] - tw.from[p]) * e;
      });
      if (k >= 1) {
        tweens.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }
  }
  function cancelTweens(obj) {
    tweens = tweens.filter(function (tw) { return tw.obj !== obj; });
  }

  function resize() {
    var maxW = Math.min(window.innerWidth * 0.94, 420);
    var maxH = window.innerHeight - 150;
    var scale = Math.min(maxW / W, maxH / H);
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * scale * dpr;
    canvas.height = H * scale * dpr;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- sprite önbelleği ----------
  var SPR = 3; // sprite süperörnekleme
  var stitchSprites = {};
  var spoolSprites = {};

  function stitchSprite(colorIdx) {
    var key = colorIdx + '_' + Math.round(cell);
    if (stitchSprites[key]) return stitchSprites[key];
    var s = Math.max(Math.round(cell * SPR), 12);
    var cv = document.createElement('canvas');
    cv.width = s; cv.height = s;
    var c = cv.getContext('2d');
    var col = level.colors[colorIdx];

    // taban: bir alttaki sıranın gölgesi
    c.fillStyle = shadeColor(col, -0.45);
    c.fillRect(0, 0, s, s);

    // iki bacaklı örgü V'si — kapsül + dikey ışık gradyanı
    function leg(cx2, rot) {
      c.save();
      c.translate(cx2, s * 0.52);
      c.rotate(rot);
      var w = s * 0.34, h = s * 0.94;
      var g = c.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, shadeColor(col, 0.35));
      g.addColorStop(0.45, col);
      g.addColorStop(1, shadeColor(col, -0.28));
      c.fillStyle = g;
      c.beginPath();
      var r = w / 2;
      c.moveTo(-w / 2 + r, -h / 2);
      c.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
      c.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      c.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
      c.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      c.closePath();
      c.fill();
      // iplik dokusu: bacak boyunca ince çizgiler
      c.strokeStyle = 'rgba(0,0,0,0.14)';
      c.lineWidth = s * 0.025;
      for (var i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(i * w * 0.26, -h / 2 + r * 0.6);
        c.lineTo(i * w * 0.26, h / 2 - r * 0.6);
        c.stroke();
      }
      // üst parlama
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = s * 0.05;
      c.beginPath();
      c.moveTo(-w * 0.22, -h * 0.34);
      c.lineTo(-w * 0.22, h * 0.1);
      c.stroke();
      c.restore();
    }
    leg(s * 0.30, 0.38);
    leg(s * 0.70, -0.38);

    stitchSprites[key] = cv;
    return cv;
  }

  function spoolSprite(colorIdx) {
    if (spoolSprites[colorIdx]) return spoolSprites[colorIdx];
    var w = 64 * SPR, h = 76 * SPR;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    var col = level.colors[colorIdx];
    var cx = w / 2;

    // gövde: üst üste sarılmış ip halkaları (3B silindir hissi)
    var rings = 4;
    var ringH = h * 0.16;
    var bodyW = w * 0.78;
    for (var i = rings - 1; i >= 0; i--) {
      var y = h * 0.30 + i * ringH;
      var rw = bodyW * (1 - Math.abs(i - (rings - 1) / 2) * 0.03);
      var g = c.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0);
      g.addColorStop(0, shadeColor(col, -0.42));
      g.addColorStop(0.22, shadeColor(col, 0.12));
      g.addColorStop(0.5, shadeColor(col, 0.32));
      g.addColorStop(0.78, shadeColor(col, 0.05));
      g.addColorStop(1, shadeColor(col, -0.45));
      c.fillStyle = g;
      c.beginPath();
      var r = ringH * 0.62;
      roundRectPath(c, cx - rw / 2, y, rw, ringH * 1.06, r);
      c.fill();
      // halka ayrımı
      c.strokeStyle = 'rgba(0,0,0,0.16)';
      c.lineWidth = SPR * 0.8;
      c.beginPath();
      c.ellipse(cx, y + ringH * 1.02, rw / 2 - r * 0.4, ringH * 0.22, 0, 0, Math.PI);
      c.stroke();
    }
    // üst kapak elipsi
    var topW = bodyW * 0.98;
    var gTop = c.createRadialGradient(cx - topW * 0.15, h * 0.30, topW * 0.05, cx, h * 0.31, topW * 0.55);
    gTop.addColorStop(0, shadeColor(col, 0.5));
    gTop.addColorStop(0.7, shadeColor(col, 0.15));
    gTop.addColorStop(1, shadeColor(col, -0.15));
    c.fillStyle = gTop;
    c.beginPath();
    c.ellipse(cx, h * 0.305, topW / 2, ringH * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    // üstte sarım spirali
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = SPR;
    for (i = 1; i <= 2; i++) {
      c.beginPath();
      c.ellipse(cx, h * 0.305, topW / 2 * (i / 3), ringH * 0.55 * (i / 3), 0, 0, Math.PI * 2);
      c.stroke();
    }
    // ortadaki mil deliği
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(cx, h * 0.305, topW * 0.09, ringH * 0.14, 0, 0, Math.PI * 2);
    c.fill();

    spoolSprites[colorIdx] = cv;
    return cv;
  }

  function roundRectPath(c, x, y, w, h, r) {
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---------- ses ----------
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep(freq, endFreq, dur, type, vol, delay) {
    if (!audioCtx) return;
    var t0 = audioCtx.currentTime + (delay || 0);
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  var sfx = {
    stitch: function () { beep(500 + (pos % 8) * 30, 700, 0.05, 'triangle', 0.07); },
    dockIn: function () { beep(320, 480, 0.14, 'sine', 0.18); },
    complete: function () { beep(520, 1040, 0.28, 'triangle', 0.22); },
    blocked: function () { beep(150, 110, 0.16, 'sawtooth', 0.12); },
    fail: function () { beep(220, 85, 0.55, 'sawtooth', 0.16); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { beep(f, f, 0.22, 'triangle', 0.2, i * 0.12); });
    }
  };

  // ---------- seviye yaşam döngüsü ----------
  function loadLevel(n) {
    levelNum = Math.max(1, n);
    localStorage.setItem('yarnloop.level', String(levelNum));
    level = generateLevel(levelNum);
    alive = level.grid.map(function (row) { return row.map(function () { return true; }); });
    cell = Math.min(BOARD.w / level.cols, BOARD.h / level.rows);
    boardX = W / 2 - level.cols * cell / 2;
    boardY = BOARD.y + (BOARD.h - level.rows * cell) / 2;
    pos = 0;
    trayCols = buildTray(level).map(function (col, ci) {
      return col.map(function (sp, ri) {
        return {
          color: sp.color, cap: sp.cap, remaining: sp.cap,
          x: TRAY_X[ci], y: TRAY_Y + ri * 8, scale: ri === 0 ? 0.8 : 0.55,
          rot: 0, state: 'tray'
        };
      });
    });
    dock = [null, null, null, null, null];
    rider = null;
    railT = 0.62;
    stitchTimer = 0;
    flyers = [];
    particles = [];
    confetti = [];
    dying = [];
    tweens = [];
    won = false; failed = false;
    maxDockUsed = 0;
    stalledSince = 0;
    shakeT = 0;
    boardPulse = 0;
    stitchSprites = {};
    spoolSprites = {};
    document.getElementById('level-label').textContent = 'Seviye ' + levelNum;
    document.getElementById('mistake-label').textContent = '';
    hideOverlay();
  }

  function neededColor() {
    return pos < level.stream.length ? level.stream[pos].color : -1;
  }

  function matchingDockSpool() {
    var need = neededColor();
    if (need < 0) return null;
    for (var i = 0; i < 5; i++) {
      if (dock[i] && dock[i].color === need && dock[i].remaining > 0) return dock[i];
    }
    return null;
  }

  // ---------- ray geometrisi ----------
  function railPoint(t) {
    var x0 = BOARD.x - RAIL_PAD, y0 = BOARD.y - RAIL_PAD;
    var x1 = BOARD.x + BOARD.w + RAIL_PAD, y1 = BOARD.y + BOARD.h + RAIL_PAD;
    var w = x1 - x0, h = y1 - y0;
    var per = 2 * (w + h);
    var d = ((t % 1) + 1) % 1 * per;
    if (d < w) return { x: x0 + d, y: y0 };
    d -= w;
    if (d < h) return { x: x1, y: y0 + d };
    d -= h;
    if (d < w) return { x: x1 - d, y: y1 };
    d -= w;
    return { x: x0, y: y1 - d };
  }

  // ---------- overlay ----------
  function stars() {
    return maxDockUsed <= 3 ? 3 : (maxDockUsed === 4 ? 2 : 1);
  }
  function showOverlay(success) {
    var starEl = document.getElementById('overlay-stars');
    starEl.innerHTML = '';
    if (success) {
      for (var i = 0; i < 3; i++) {
        var s = document.createElement('span');
        s.textContent = '★';
        if (i >= stars()) s.className = 'dim';
        starEl.appendChild(s);
      }
    } else {
      starEl.textContent = '🧶';
    }
    document.getElementById('overlay-title').textContent =
      success ? (stars() === 3 ? 'Mükemmel!' : 'Tebrikler!') : 'Tıkandın!';
    document.getElementById('overlay-sub').textContent = success
      ? 'Seviye ' + levelNum + ' tamamlandı — ' + level.name + ' söküldü'
      : 'Yuvalar doldu, sıradaki renge uyan makara yok';
    document.getElementById('btn-next').style.display = success ? '' : 'none';
    document.getElementById('overlay').classList.remove('hidden');
  }
  function hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
  }

  // ---------- girdi ----------
  function canvasPoint(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) / rect.width * W,
      y: (ev.clientY - rect.top) / rect.height * H
    };
  }
  function tapTray(colIdx) {
    if (won || failed) return false;
    var colArr = trayCols[colIdx];
    if (!colArr.length) return false;
    var slot = dock.indexOf(null);
    if (slot === -1) {
      colArr[0].shake = 1; // yuva dolu: makara sallanır
      sfx.blocked();
      return false;
    }
    var sp = colArr.shift();
    dock[slot] = sp;
    sp.slot = slot;
    sp.state = 'docking';
    sfx.dockIn();
    maxDockUsed = Math.max(maxDockUsed, dock.filter(Boolean).length);
    // tepsiden yuvaya zıplayarak süzül
    cancelTweens(sp);
    tween(sp, { x: DOCK_X[slot], y: DOCK_Y, scale: 0.9 }, 0.42, easeOutBack, function () {
      sp.state = 'docked';
      tween(sp, { scale: 0.8 }, 0.15, easeOutCubic);
    });
    // arkadaki makara öne gelsin
    colArr.forEach(function (b, ri) {
      cancelTweens(b);
      tween(b, { y: TRAY_Y + ri * 8, scale: ri === 0 ? 0.8 : 0.55 }, 0.3, easeOutBack);
    });
    return true;
  }
  canvas.addEventListener('pointerdown', function (ev) {
    ensureAudio();
    var p = canvasPoint(ev);
    if (p.y > TRAY_Y - 50) {
      for (var i = 0; i < 5; i++) {
        if (Math.abs(p.x - TRAY_X[i]) < 34) { tapTray(i); return; }
      }
    }
  });

  document.getElementById('btn-restart').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum); });
  document.getElementById('btn-prev').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum - 1); });
  document.getElementById('btn-next').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum + 1); });
  document.getElementById('btn-replay').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum); });

  // ---------- güncelleme ----------
  function setRider(sp) {
    if (rider === sp) return;
    // eski sürücü yuvasına dönsün
    if (rider && rider.state === 'riding' && dock[rider.slot] === rider) {
      var old = rider;
      old.state = 'docking';
      cancelTweens(old);
      tween(old, { x: DOCK_X[old.slot], y: DOCK_Y, scale: 0.8, rot: 0 }, 0.35, easeOutCubic, function () {
        old.state = 'docked';
      });
    }
    rider = sp;
    if (sp) {
      sp.state = 'toRail';
      var p = railPoint(railT);
      cancelTweens(sp);
      tween(sp, { x: p.x, y: p.y, scale: 0.92 }, 0.35, easeOutBack, function () {
        sp.state = 'riding';
      });
    }
  }

  function update(dt) {
    now += dt;
    updateTweens(dt);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt * 2);
    if (boardPulse > 0) boardPulse = Math.max(0, boardPulse - dt * 2.5);

    if (won || failed) {
      updateFx(dt);
      return;
    }

    if (pos >= level.stream.length) {
      won = true;
      boardPulse = 1;
      sfx.win();
      spawnConfetti();
      setTimeout(function () { showOverlay(true); }, 800);
      return;
    }

    var spool = matchingDockSpool();
    if (spool) {
      stalledSince = 0;
      if (rider !== spool) setRider(spool);
      // sarmaya sürücü raya vardığında başla
      if (spool.state === 'riding') {
        stitchTimer += dt * 1000;
        while (stitchTimer >= STITCH_MS && pos < level.stream.length) {
          var st = level.stream[pos];
          if (st.color !== spool.color || spool.remaining === 0) break;
          stitchTimer -= STITCH_MS;
          alive[st.r][st.c] = false;
          spool.remaining--;
          pos++;
          sfx.stitch();
          spawnFlyer(st, spool);
          railT += 0.011;
          if (spool.remaining === 0) {
            completeSpool(spool);
            break;
          }
          if (pos < level.stream.length && level.stream[pos].color !== spool.color) break;
        }
        // rayda hafif salınım
        var rp = railPoint(railT);
        spool.x += (rp.x - spool.x) * Math.min(dt * 8, 1);
        spool.y += (rp.y + Math.sin(now * 9) * 2 - spool.y) * Math.min(dt * 8, 1);
        spool.rot = Math.sin(now * 7) * 0.08;
      }
    } else {
      stitchTimer = 0;
      if (rider) setRider(null);
      if (dock.every(function (d) { return d !== null; })) {
        stalledSince += dt;
        if (stalledSince > 0.9) {
          failed = true;
          shakeT = 1;
          sfx.fail();
          setTimeout(function () { showOverlay(false); }, 500);
        }
      }
    }

    updateFx(dt);
  }

  function completeSpool(sp) {
    dock[sp.slot] = null;
    if (rider === sp) rider = null;
    sp.state = 'completing';
    dying.push(sp);
    spawnSparkle(sp.x, sp.y);
    sfx.complete();
    cancelTweens(sp);
    tween(sp, { scale: sp.scale * 1.35, y: sp.y - 26 }, 0.18, easeOutCubic, function () {
      tween(sp, { scale: 0, rot: 3.2, y: sp.y - 40 }, 0.4, easeInBack, function () {
        dying = dying.filter(function (d) { return d !== sp; });
      });
    });
  }

  function updateFx(dt) {
    flyers.forEach(function (f) {
      f.t += dt * 2.6;
    });
    flyers = flyers.filter(function (f) { return f.t < 1; });

    particles.forEach(function (p) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
    });
    particles = particles.filter(function (p) { return p.t < 0.8; });
  }

  function spawnFlyer(st, spool) {
    flyers.push({
      x0: boardX + st.c * cell + cell / 2,
      y0: boardY + st.r * cell + cell / 2,
      color: st.color, spool: spool, t: 0
    });
    for (var i = 0; i < 2; i++) {
      particles.push({
        x: boardX + st.c * cell + cell / 2,
        y: boardY + st.r * cell + cell / 2,
        t: 0,
        vx: (Math.random() - 0.5) * 80,
        vy: -50 - Math.random() * 60,
        color: level.colors[st.color], size: 3
      });
    }
  }
  function spawnSparkle(x, y) {
    for (var i = 0; i < 18; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({
        x: x, y: y, t: 0,
        vx: Math.cos(a) * (70 + Math.random() * 130),
        vy: Math.sin(a) * (70 + Math.random() * 130) - 60,
        color: i % 3 === 0 ? '#fff' : '#ffd75e', size: 4.5
      });
    }
  }
  function spawnConfetti() {
    for (var i = 0; i < 130; i++) {
      confetti.push({
        x: Math.random() * W, y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 8,
        size: 5 + Math.random() * 6,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)]
      });
    }
  }

  // ---------- çizim ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
  }

  function drawBackground() {
    var g0 = ctx.createLinearGradient(0, 0, 0, H);
    g0.addColorStop(0, '#5e5553');
    g0.addColorStop(1, '#443c3a');
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);
    // kumaş dokusu: seyrek noktalar
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (var i = 0; i < 60; i++) {
      var x = (i * 73) % W, y = (i * 131) % H;
      ctx.fillRect(x, y, 2, 2);
    }
    var g = ctx.createRadialGradient(W / 2, H * 0.32, 60, W / 2, H * 0.4, 520);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // ray: gölge + krem ray + vida noktaları
    var x0 = BOARD.x - RAIL_PAD, y0 = BOARD.y - RAIL_PAD;
    var rw = BOARD.w + RAIL_PAD * 2, rh = BOARD.h + RAIL_PAD * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = '#262220';
    ctx.lineWidth = 15;
    roundRect(x0, y0, rw, rh, 26);
    ctx.stroke();
    ctx.restore();
    var gr = ctx.createLinearGradient(0, y0, 0, y0 + rh);
    gr.addColorStop(0, '#efe6d2');
    gr.addColorStop(1, '#c9bda3');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 9;
    roundRect(x0, y0, rw, rh, 26);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    roundRect(x0, y0 - 3, rw, rh, 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(46,42,41,0.55)';
    for (var t = 0; t < 1; t += 0.04) {
      var p = railPoint(t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // yuvalar
    DOCK_X.forEach(function (x) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      roundRect(x - 30, DOCK_Y - 32, 60, 64, 13);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      roundRect(x - 30, DOCK_Y - 32, 60, 64, 13);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      roundRect(x - 26, DOCK_Y - 28, 52, 56, 10);
      ctx.stroke();
    });
  }

  function drawBoard() {
    var pulse = 1 + Math.sin(boardPulse * Math.PI) * 0.02;
    ctx.save();
    ctx.translate(W / 2, boardY + level.rows * cell / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-W / 2, -(boardY + level.rows * cell / 2));

    // sökülmüş zemin
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(boardX - 6, boardY - 6, level.cols * cell + 12, level.rows * cell + 12, 10);
    ctx.fill();

    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) {
        if (!alive[r][c]) continue;
        ctx.drawImage(stitchSprite(level.grid[r][c]),
          boardX + c * cell, boardY + r * cell, cell + 0.5, cell + 0.5);
      }
    }
    ctx.restore();
  }

  function drawStrand() {
    if (!rider || pos >= level.stream.length) return;
    if (rider.state !== 'riding' && rider.state !== 'toRail') return;
    var st = level.stream[pos];
    var sx = boardX + st.c * cell + cell / 2;
    var sy = boardY + st.r * cell + cell / 2;
    var col = level.colors[rider.color];
    var wob = Math.sin(now * 11) * 5;
    ctx.strokeStyle = shadeColor(col, -0.2);
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + rider.x) / 2 + wob, (sy + rider.y) / 2 + 16, rider.x, rider.y - 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + rider.x) / 2 + wob, (sy + rider.y) / 2 + 14, rider.x, rider.y - 7);
    ctx.stroke();
  }

  function drawSpoolAt(sp, highlight) {
    var spr = spoolSprite(sp.color);
    var w = 64 * sp.scale, h = 76 * sp.scale;
    if (sp.shake > 0) sp.shake = Math.max(0, sp.shake - 0.035);
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate((sp.rot || 0) + (sp.shake ? Math.sin(now * 40) * 0.16 * sp.shake : 0));
    // yumuşak zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.42, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    if (highlight) {
      ctx.shadowColor = 'rgba(255,255,180,0.9)';
      ctx.shadowBlur = 16;
    }
    ctx.drawImage(spr, -w / 2, -h / 2, w, h);
    ctx.restore();

    // kapasite rozeti
    if (sp.scale > 0.4 && sp.state !== 'completing') {
      var by = sp.y - h * 0.62;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sp.x, by, 12.5 * Math.min(sp.scale / 0.8, 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shadeColor(level.colors[sp.color], -0.3);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#3b3347';
      ctx.font = '800 ' + Math.round(13 * Math.min(sp.scale / 0.8, 1)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sp.remaining !== undefined ? sp.remaining : sp.cap), sp.x, by + 0.5);
    }
  }

  function drawFlyers() {
    flyers.forEach(function (f) {
      var t = Math.min(f.t, 1);
      var tx = f.spool.x, ty = f.spool.y;
      var mx = (f.x0 + tx) / 2 + 24, my = (f.y0 + ty) / 2 - 30;
      var u = 1 - t;
      var x = u * u * f.x0 + 2 * u * t * mx + t * t * tx;
      var y = u * u * f.y0 + 2 * u * t * my + t * t * ty;
      var s = cell * (1 - t * 0.55);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 7);
      ctx.globalAlpha = 1 - t * 0.3;
      ctx.drawImage(stitchSprite(f.color), -s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.globalAlpha = 1;
    });
  }

  function drawTray() {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(24, TRAY_Y - 56, W - 48, 124, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    roundRect(24, TRAY_Y - 56, W - 48, 124, 20);
    ctx.stroke();

    var need = neededColor();
    var wantHint = !matchingDockSpool() && !won && !failed;
    for (var i = 0; i < 5; i++) {
      var colArr = trayCols[i];
      for (var b = Math.min(colArr.length - 1, 2); b >= 1; b--) {
        ctx.globalAlpha = 0.4;
        drawSpoolAt(colArr[b], false);
        ctx.globalAlpha = 1;
      }
      if (colArr.length) {
        var front = colArr[0];
        var hint = wantHint && front.color === need;
        if (hint) front.scale = 0.8 + Math.sin(now * 6) * 0.05;
        drawSpoolAt(front, hint);
      }
    }
  }

  function drawDockAndRider() {
    for (var i = 0; i < 5; i++) {
      if (dock[i] && dock[i] !== rider) drawSpoolAt(dock[i], false);
    }
    if (rider) drawSpoolAt(rider, true);
    dying.forEach(function (sp) { drawSpoolAt(sp, false); });
  }

  function drawProgress() {
    var total = level.stream.length;
    var bw = 170, x = (W - bw) / 2, y = 34;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(x - 8, y - 7, bw + 16, 24, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(x, y, bw, 10, 5);
    ctx.fill();
    if (pos > 0) {
      var gg = ctx.createLinearGradient(x, 0, x + bw, 0);
      gg.addColorStop(0, '#ffd75e');
      gg.addColorStop(1, '#ffb02e');
      ctx.fillStyle = gg;
      roundRect(x, y, Math.max(10, bw * pos / total), 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(pos + ' / ' + total, W / 2, y + 30);
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.8);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawConfetti(dt) {
    confetti.forEach(function (cf) {
      cf.x += cf.vx * dt; cf.y += cf.vy * dt; cf.rot += cf.vr * dt;
      ctx.save();
      ctx.translate(cf.x, cf.y);
      ctx.rotate(cf.rot);
      ctx.fillStyle = cf.color;
      ctx.fillRect(-cf.size / 2, -cf.size / 3, cf.size, cf.size * 0.66);
      ctx.restore();
    });
    confetti = confetti.filter(function (cf) { return cf.y < H + 30; });
  }

  function frame(ts) {
    var dt = Math.min((ts - lastTime) / 1000 || 0, 0.05);
    lastTime = ts;
    update(dt);

    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 8 * shakeT, (Math.random() - 0.5) * 8 * shakeT);
    }
    drawBackground();
    drawProgress();
    drawBoard();
    drawStrand();
    drawDockAndRider();
    drawTray();
    drawFlyers();
    drawParticles();
    if (confetti.length) drawConfetti(dt);
    ctx.restore();

    requestAnimationFrame(frame);
  }

  // test kancası
  window.__yarn = {
    getLevel: function () { return level; },
    getPos: function () { return pos; },
    getDock: function () { return dock; },
    getTray: function () { return trayCols; },
    neededColor: neededColor,
    tapTray: tapTray,
    isWon: function () { return won; },
    isFailed: function () { return failed; },
    isFlowing: function () { return !!matchingDockSpool(); },
    loadLevel: loadLevel
  };

  loadLevel(levelNum);
  requestAnimationFrame(frame);
})();
