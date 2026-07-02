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
 * Seviyeler seed'li ve deterministik. Makara kapasiteleri ip akışı sanal
 * oynatılarak üretilir (renk başına tek açık makara) ve tepsi sütunlarına
 * açılış sırasıyla dağıtılır → her seviyenin garantili çözümü vardır.
 */
(function () {
  'use strict';

  // ---------- sabitler ----------
  var W = 420;
  var H = 700;
  var BOARD = { x: 70, y: 88, w: 280, h: 280 };
  var RAIL_PAD = 26;            // rayın tahtadan uzaklığı
  var DOCK_Y = 468;             // bekleme yuvaları
  var DOCK_X = [66, 138, 210, 282, 354];
  var TRAY_Y = 596;             // tepsi ön sıra
  var TRAY_X = [66, 138, 210, 282, 354];
  var STITCH_MS = 105;          // ilmek başına sökme süresi

  var PALETTE = [
    '#e5484d', '#f76b15', '#ffc53d', '#46a758', '#00a2c7',
    '#3e63dd', '#8e4ec6', '#e93d82', '#f4f0e6', '#3b3b40'
  ];

  // Piksel desenler: '.' arka plan, harfler renk rolleri
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

    // roller: '.' + desendeki harfler
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

    // sökme sırası: son satırdan geriye serpantin (örgünün tersi)
    var stream = [];
    for (var r = rows - 1; r >= 0; r--) {
      var rightToLeft = (rows - 1 - r) % 2 === 0;
      for (var k = 0; k < cols; k++) {
        var c = rightToLeft ? cols - 1 - k : k;
        stream.push({ c: c, r: r, color: grid[r][c] });
      }
    }

    // makaralar: akışı sanal oynat; renk başına tek açık makara.
    // Kapasite = o rengin kalanının bir bölümü → aynı renk için sıralı
    // makaralar oluşur, açılış sırası = ihtiyaç sırası.
    var splitChance = Math.min(0.25 + n * 0.04, 0.75); // ilerledikçe daha çok parçalı
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

  // tepsi: makaralar açılış sırasıyla 5 sütuna dağıtılır
  // (sütun i: makara i, i+5, i+10... → sıradaki makara hep öndedir)
  function buildTray(level) {
    var trayCols = [[], [], [], [], []];
    level.spools.forEach(function (sp, i) {
      trayCols[i % 5].push({ color: sp.color, cap: sp.cap });
    });
    return trayCols;
  }

  // node smoke testi: tıkanınca sıradaki rengin makarasını ekleyen
  // oyuncu kazanır mı, yuva 5'i aşar mı?
  function solveCheck(level) {
    var trayCols = buildTray(level);
    var dock = [];
    var maxDock = 0;
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
      // sıradaki rengi tepsi önlerinden bul ve yuvaya al
      var found = false;
      for (var t = 0; t < 5; t++) {
        if (trayCols[t].length && trayCols[t][0].color === need) {
          if (dock.length >= 5) return false;
          dock.push(trayCols[t].shift());
          maxDock = Math.max(maxDock, dock.length);
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
  var alive = null;         // hücre söküldü mü
  var cell = 0, boardX = 0, boardY = 0;
  var pos = 0;              // stream'de sıradaki ilmek
  var trayCols = null;      // 5 sütun tepsi
  var dock = [null, null, null, null, null];
  var rider = null;         // rayda gezen aktif makara
  var railT = 0.62;         // rayda konum (0..1)
  var stitchTimer = 0;
  var particles = [];
  var confetti = [];
  var won = false, failed = false;
  var maxDockUsed = 0;
  var stalledSince = 0;
  var lastTime = 0;

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
    trayCols = buildTray(level).map(function (col) {
      return col.map(function (sp) { return { color: sp.color, cap: sp.cap, remaining: sp.cap }; });
    });
    dock = [null, null, null, null, null];
    rider = null;
    railT = 0.62;
    stitchTimer = 0;
    particles = [];
    confetti = [];
    won = false; failed = false;
    maxDockUsed = 0;
    stalledSince = 0;
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

  function dockSpool(sp) {
    var slot = dock.indexOf(null);
    if (slot === -1) { sfx.blocked(); return false; }
    dock[slot] = sp;
    sp.slot = slot;
    sp.x = TRAY_X[0]; sp.y = TRAY_Y; // animasyon başlangıcı üzerine yazılır
    sfx.dockIn();
    maxDockUsed = Math.max(maxDockUsed, dock.filter(Boolean).length);
    return true;
  }

  // ---------- ray geometrisi ----------
  function railPoint(t) {
    // tahta etrafında yuvarlatılmış dikdörtgen çevresi, t: 0..1 (saat yönü, sol üstten)
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
    var sp = colArr[0];
    if (dockSpool(sp)) {
      colArr.shift();
      sp.x = TRAY_X[colIdx]; sp.y = TRAY_Y;
      return true;
    }
    return false;
  }
  canvas.addEventListener('pointerdown', function (ev) {
    ensureAudio();
    var p = canvasPoint(ev);
    if (p.y > TRAY_Y - 46) {
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
  function update(dt) {
    if (won || failed) {
      updateParticles(dt);
      return;
    }

    // sökülecek ilmek kaldı mı?
    if (pos >= level.stream.length) {
      won = true;
      sfx.win();
      spawnConfetti();
      setTimeout(function () { showOverlay(true); }, 700);
      return;
    }

    var spool = matchingDockSpool();
    if (spool) {
      stalledSince = 0;
      rider = spool;
      stitchTimer += dt * 1000;
      while (stitchTimer >= STITCH_MS && pos < level.stream.length) {
        var st = level.stream[pos];
        if (st.color !== spool.color || spool.remaining === 0) break;
        stitchTimer -= STITCH_MS;
        alive[st.r][st.c] = false;
        spool.remaining--;
        pos++;
        railT += 0.012;
        sfx.stitch();
        spawnStitchPuff(st);
        if (spool.remaining === 0) {
          // makara doldu → tamamlandı
          dock[spool.slot] = null;
          spawnSparkle(railPoint(railT));
          sfx.complete();
          if (rider === spool) rider = null;
          break;
        }
        // sıradaki ilmek başka renkse duraksa (farklı makara devralacak)
        if (pos < level.stream.length && level.stream[pos].color !== spool.color) break;
      }
    } else {
      stitchTimer = 0;
      rider = null;
      // tıkanma: yuva dolu ve sıradaki renge uyan yok
      if (dock.every(function (d) { return d !== null; })) {
        stalledSince += dt;
        if (stalledSince > 0.9) {
          failed = true;
          sfx.fail();
          setTimeout(function () { showOverlay(false); }, 400);
        }
      }
    }

    updateParticles(dt);
  }

  function updateParticles(dt) {
    particles.forEach(function (p) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
    });
    particles = particles.filter(function (p) { return p.t < 0.8; });
  }

  function spawnStitchPuff(st) {
    var x = boardX + st.c * cell + cell / 2;
    var y = boardY + st.r * cell + cell / 2;
    for (var i = 0; i < 2; i++) {
      particles.push({
        x: x, y: y, t: 0,
        vx: (Math.random() - 0.5) * 90,
        vy: -60 - Math.random() * 60,
        color: level.colors[st.color], size: 3.5
      });
    }
  }
  function spawnSparkle(p) {
    for (var i = 0; i < 16; i++) {
      var a = Math.random() * Math.PI * 2;
      particles.push({
        x: p.x, y: p.y, t: 0,
        vx: Math.cos(a) * (60 + Math.random() * 120),
        vy: Math.sin(a) * (60 + Math.random() * 120) - 60,
        color: '#ffd75e', size: 4.5
      });
    }
  }
  function spawnConfetti() {
    for (var i = 0; i < 120; i++) {
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
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    ctx.fillStyle = '#57504e';
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.4, 500);
    g.addColorStop(0, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // ray
    var x0 = BOARD.x - RAIL_PAD, y0 = BOARD.y - RAIL_PAD;
    var rw = BOARD.w + RAIL_PAD * 2, rh = BOARD.h + RAIL_PAD * 2;
    ctx.strokeStyle = '#2e2a29';
    ctx.lineWidth = 14;
    roundRect(x0, y0, rw, rh, 24);
    ctx.stroke();
    ctx.strokeStyle = '#ded3bd';
    ctx.lineWidth = 9;
    roundRect(x0, y0, rw, rh, 24);
    ctx.stroke();
    // ray travers çizgileri
    ctx.strokeStyle = 'rgba(46,42,41,0.5)';
    ctx.lineWidth = 2;
    for (var t = 0; t < 1; t += 0.033) {
      var p = railPoint(t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // yuvalar
    DOCK_X.forEach(function (x) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      roundRect(x - 30, DOCK_Y - 30, 60, 60, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      roundRect(x - 30, DOCK_Y - 30, 60, 60, 12);
      ctx.stroke();
    });
  }

  function drawStitchCell(c, r, colorIdx) {
    var x = boardX + c * cell, y = boardY + r * cell;
    var col = level.colors[colorIdx];
    ctx.fillStyle = shadeColor(col, -0.22);
    ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
    // mini V dokusu
    ctx.strokeStyle = col;
    ctx.lineWidth = cell * 0.32;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + cell * 0.22, y + cell * 0.2);
    ctx.lineTo(x + cell * 0.5, y + cell * 0.78);
    ctx.lineTo(x + cell * 0.78, y + cell * 0.2);
    ctx.stroke();
  }

  function drawBoard() {
    // sökülmüş bölge zemini
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(boardX - 6, boardY - 6, level.cols * cell + 12, level.rows * cell + 12, 8);
    ctx.fill();
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) {
        if (alive[r][c]) drawStitchCell(c, r, level.grid[r][c]);
      }
    }
  }

  function drawStrand() {
    if (!rider || pos >= level.stream.length) return;
    var st = level.stream[pos];
    var sx = boardX + st.c * cell + cell / 2;
    var sy = boardY + st.r * cell + cell / 2;
    var rp = railPoint(railT);
    var col = level.colors[rider.color];
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    var wob = Math.sin(performance.now() / 90) * 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + rp.x) / 2 + wob, (sy + rp.y) / 2 + 14, rp.x, rp.y);
    ctx.stroke();
  }

  function drawSpool(x, y, colorIdx, count, scale, highlight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    var col = level.colors[colorIdx];
    // makara flanşları
    ctx.fillStyle = shadeColor(col, -0.35);
    roundRect(-24, -26, 48, 12, 6);
    ctx.fill();
    roundRect(-24, 14, 48, 12, 6);
    ctx.fill();
    // sarılı ip gövdesi
    ctx.fillStyle = col;
    roundRect(-17, -16, 34, 32, 7);
    ctx.fill();
    for (var i = 0; i < 3; i++) {
      ctx.strokeStyle = shadeColor(col, i % 2 ? 0.2 : -0.18);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-17, -8 + i * 8);
      ctx.quadraticCurveTo(0, -4 + i * 8, 17, -8 + i * 8);
      ctx.stroke();
    }
    if (highlight) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      roundRect(-26, -28, 52, 56, 8);
      ctx.stroke();
    }
    // kapasite rozeti
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -30, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(col, -0.3);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#3b3347';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), 0, -29);
    ctx.restore();
  }

  function drawDockAndRider() {
    for (var i = 0; i < 5; i++) {
      var sp = dock[i];
      if (!sp) continue;
      if (sp === rider) {
        var p = railPoint(railT);
        drawSpool(p.x, p.y, sp.color, sp.remaining, 0.9, true);
      } else {
        drawSpool(DOCK_X[i], DOCK_Y, sp.color, sp.remaining, 0.78, false);
      }
    }
  }

  function drawTray() {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(24, TRAY_Y - 52, W - 48, 118, 18);
    ctx.fill();
    var need = neededColor();
    for (var i = 0; i < 5; i++) {
      var colArr = trayCols[i];
      // arkadakiler (küçük, soluk)
      for (var b = Math.min(colArr.length - 1, 2); b >= 1; b--) {
        ctx.globalAlpha = 0.45;
        drawSpool(TRAY_X[i], TRAY_Y + 36 - b * 6, colArr[b].color, colArr[b].cap, 0.5, false);
        ctx.globalAlpha = 1;
      }
      if (colArr.length) {
        var front = colArr[0];
        drawSpool(TRAY_X[i], TRAY_Y, front.color, front.cap, 0.82,
          front.color === need && !matchingDockSpool());
      }
    }
  }

  function drawProgress() {
    var total = level.stream.length;
    var bw = 180, x = (W - bw) / 2, y = 40;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(x, y, bw, 10, 5);
    ctx.fill();
    if (pos > 0) {
      ctx.fillStyle = '#ffd75e';
      roundRect(x, y, Math.max(10, bw * pos / total), 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(pos + ' / ' + total, W / 2, y + 26);
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

    drawBackground();
    drawProgress();
    drawBoard();
    drawStrand();
    drawDockAndRider();
    drawTray();
    drawParticles();
    if (confetti.length) drawConfetti(dt);

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
