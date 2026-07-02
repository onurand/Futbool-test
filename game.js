/*
 * Yarn Loop — knit-puzzle clone (Combo Games'in Yarn Loop / Yarn Flow
 * oyununun mekaniği).
 *
 * Mekanik: tahtada örgü ilmeklerinden (V dikişler) oluşan renkli bir desen
 * var. Bir ilmek ancak ÜSTÜNDEKİ hücre boşsa sökülebilir (örgü yukarıdan
 * sökülür). Alttaki konveyörde renkli, kapasiteli bobinler sırada bekler.
 * Bir bobine dokununca kendi rengindeki açık ilmekleri tek tek toplar;
 * her ilmek kapasitesini 1 azaltır. Kapasitesi biten bobin tamamlanır ve
 * uçar gider. Toplayacak ilmeği kalmayan ama kapasitesi artan bobin ASKIYA
 * (rack, 3 slot) alınır ve sonra tekrar kullanılabilir. Askı doluyken bir
 * bobin daha askıya çıkmak zorunda kalırsa ya da hiçbir bobin ilerleme
 * yapamazsa seviye tıkanır. Deseni tamamen sökünce seviye biter.
 *
 * Seviyeler seed'li RNG ile deterministik üretilir. Bobin kapasiteleri,
 * desen sanal olarak sökülerek belirlenir: konveyör sırasını takip eden
 * oyuncu her bobini tam doldurur — yani her seviyenin garantili çözümü
 * vardır; askı, sıradan sapan oyuncunun emniyet alanıdır.
 */
(function () {
  'use strict';

  // ---------- sabitler ----------
  var W = 420;
  var H = 700;
  var BOARD = { x: 40, y: 96, w: 340, h: 336 }; // örgü alanı
  var RACK_Y = 500;
  var BELT_Y = 596;
  var SLOT_X = [105, 210, 315]; // konveyörde görünen 3 bobin
  var RACK_X = [105, 210, 315];
  var COLLECT_MS = 95; // ilmek başına toplama süresi

  var PALETTE = [
    '#e5484d', '#f76b15', '#ffc53d', '#46a758', '#00a2c7',
    '#3e63dd', '#8e4ec6', '#e93d82', '#12a594'
  ];

  // Örgü desen kalıpları (X = ilmek)
  var MASKS = [
    [ // kalp
      '.XX.XX.',
      'XXXXXXX',
      'XXXXXXX',
      '.XXXXX.',
      '..XXX..',
      '...X...'
    ],
    [ // yıldız
      '....X....',
      '...XXX...',
      'XXXXXXXXX',
      '.XXXXXXX.',
      '..XXXXX..',
      '.XXX.XXX.',
      'XX.....XX'
    ],
    [ // balık
      '..XXXX...',
      '.XXXXXX.X',
      'XXXXXXXXX',
      '.XXXXXX.X',
      '..XXXX...'
    ],
    [ // ev
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      '.XX..XX.',
      '.XX..XX.'
    ],
    [ // kelebek
      'XX.....XX',
      'XXX...XXX',
      'XXXX.XXXX',
      '.XXXXXXX.',
      'XXXX.XXXX',
      'XXX...XXX',
      'XX.....XX'
    ],
    [ // kupa
      '.XXXXXX..',
      '.XXXXXXX.',
      '.XXXXXX.X',
      '.XXXXXXX.',
      '.XXXXXX..',
      '..XXXX...'
    ],
    [ // ağaç
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      '...XX...'
    ],
    [ // kare battaniye
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX'
    ]
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
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var target = amt > 0 ? 255 : 0;
    var t = Math.abs(amt);
    r = Math.round(r + (target - r) * t);
    g = Math.round(g + (target - g) * t);
    b = Math.round(b + (target - b) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function cloneGrid(g) {
    return g.map(function (row) { return row.slice(); });
  }

  // ---------- seviye üretimi ----------
  function generateLevel(n) {
    var rnd = mulberry32(n * 7919 + 613);
    var mask = MASKS[Math.floor(rnd() * MASKS.length)];
    var rows = mask.length, cols = mask[0].length;
    var colorCount = Math.min(3 + Math.floor((n - 1) / 3), 7);

    // renkleri karıştırıp ilk colorCount tanesini kullan
    var colors = PALETTE.slice();
    for (var i = colors.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = colors[i]; colors[i] = colors[j]; colors[j] = tmp;
    }
    colors = colors.slice(0, colorCount);

    // hücrelere rastgele renk, sonra komşu çoğunluğuyla yumuşatma
    // (örgüdeki renk blokları gibi kümeler oluşsun)
    var grid = [];
    for (var r = 0; r < rows; r++) {
      grid.push([]);
      for (var c = 0; c < cols; c++) {
        grid[r].push(mask[r][c] === 'X' ? Math.floor(rnd() * colorCount) : -1);
      }
    }
    for (var pass = 0; pass < 2; pass++) {
      var next = cloneGrid(grid);
      for (r = 0; r < rows; r++) {
        for (c = 0; c < cols; c++) {
          if (grid[r][c] < 0) continue;
          var votes = {};
          [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) {
            var rr = r + d[1], cc = c + d[0];
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[rr][cc] >= 0) {
              votes[grid[rr][cc]] = (votes[grid[rr][cc]] || 0) + 1;
            }
          });
          var best = grid[r][c], bestN = 1;
          Object.keys(votes).forEach(function (k) {
            if (votes[k] > bestN + (rnd() < 0.5 ? 0 : 1)) { best = +k; bestN = votes[k]; }
          });
          next[r][c] = best;
        }
      }
      grid = next;
    }

    // bobinleri, deseni sanal sökerek üret → çözüm sırası garanti
    var sim = cloneGrid(grid);
    var bobbins = [];
    var capMin = 3, capMax = Math.min(5 + Math.floor(n / 2), 10);
    var safety = 500;
    while (safety-- > 0) {
      var exposedByColor = {};
      var remaining = 0;
      for (r = 0; r < rows; r++) {
        for (c = 0; c < cols; c++) {
          if (sim[r][c] < 0) continue;
          remaining++;
          if (r === 0 || sim[r - 1][c] < 0) {
            (exposedByColor[sim[r][c]] = exposedByColor[sim[r][c]] || []).push([c, r]);
          }
        }
      }
      if (remaining === 0) break;
      var avail = Object.keys(exposedByColor);
      var color = +avail[Math.floor(rnd() * avail.length)];
      var cap = capMin + Math.floor(rnd() * (capMax - capMin + 1));
      var collected = 0;
      // zincirleme topla: her sökümden sonra açığa çıkanlar da dahil
      while (collected < cap) {
        var found = null;
        outer:
        for (r = 0; r < rows; r++) {
          for (c = 0; c < cols; c++) {
            if (sim[r][c] === color && (r === 0 || sim[r - 1][c] < 0)) { found = [c, r]; break outer; }
          }
        }
        if (!found) break;
        sim[found[1]][found[0]] = -1;
        collected++;
      }
      if (collected > 0) bobbins.push({ color: color, cap: collected });
    }

    return { n: n, rows: rows, cols: cols, grid: grid, colors: colors, bobbins: bobbins };
  }

  // node smoke testi: konveyör sırası takip edilince seviye biter mi?
  function solveCheck(level) {
    var sim = cloneGrid(level.grid);
    var rows = level.rows, cols = level.cols;
    for (var b = 0; b < level.bobbins.length; b++) {
      var bob = level.bobbins[b];
      var left = bob.cap;
      while (left > 0) {
        var found = null;
        for (var r = 0; r < rows && !found; r++) {
          for (var c = 0; c < cols && !found; c++) {
            if (sim[r][c] === bob.color && (r === 0 || sim[r - 1][c] < 0)) found = [c, r];
          }
        }
        if (!found) return false; // sırayı izleyen bobin tam dolmalı
        sim[found[1]][found[0]] = -1;
        left--;
      }
    }
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) if (sim[r][c] >= 0) return false;
    }
    return true;
  }

  if (typeof window === 'undefined') {
    module.exports = { generateLevel: generateLevel, solveCheck: solveCheck };
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
  var grid = null;          // canlı ızgara (renk idx | -1)
  var cell = 0, boardX = 0, boardY = 0;
  var totalStitches = 0;
  var queue = [];           // konveyördeki bobinler (obje listesi)
  var rack = [null, null, null];
  var active = null;        // şu an toplama yapan bobin
  var collectTimer = 0;
  var flyers = [];          // uçan ilmekler
  var movers = [];          // yer değiştiren bobin animasyonları
  var confetti = [];
  var won = false, failed = false, busy = false;
  var rackMaxUsed = 0;
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
  var chain = 0;
  var sfx = {
    stitch: function () { chain++; beep(420 + chain * 45, 620 + chain * 45, 0.09, 'triangle', 0.18); },
    complete: function () { beep(500, 1000, 0.25, 'triangle', 0.22); },
    toRack: function () { beep(340, 250, 0.16, 'sine', 0.15); },
    blocked: function () { beep(150, 110, 0.16, 'sawtooth', 0.12); },
    fail: function () { beep(220, 90, 0.5, 'sawtooth', 0.16); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { beep(f, f, 0.22, 'triangle', 0.2, i * 0.12); });
    }
  };

  // ---------- seviye yaşam döngüsü ----------
  function loadLevel(n) {
    levelNum = Math.max(1, n);
    localStorage.setItem('yarnloop.level', String(levelNum));
    level = generateLevel(levelNum);
    grid = cloneGrid(level.grid);
    cell = Math.min(BOARD.w / level.cols, BOARD.h / level.rows, 42);
    boardX = W / 2 - level.cols * cell / 2;
    boardY = BOARD.y + (BOARD.h - level.rows * cell) / 2;
    totalStitches = 0;
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) if (grid[r][c] >= 0) totalStitches++;
    }
    queue = level.bobbins.map(function (b, i) {
      return {
        color: b.color, cap: b.cap, remaining: b.cap, display: b.cap,
        id: i, x: 0, y: BELT_Y, scale: 1, state: 'queued' // queued|active|racked|leaving|gone
      };
    });
    rack = [null, null, null];
    active = null;
    flyers = [];
    movers = [];
    confetti = [];
    won = false; failed = false; busy = false;
    rackMaxUsed = 0;
    chain = 0;
    layoutBelt(true);
    document.getElementById('level-label').textContent = 'Seviye ' + levelNum;
    document.getElementById('mistake-label').textContent = '';
    hideOverlay();
  }

  function visibleQueue() {
    return queue.filter(function (b) { return b.state === 'queued'; }).slice(0, 3);
  }

  function layoutBelt(instant) {
    visibleQueue().forEach(function (b, i) {
      b.tx = SLOT_X[i];
      b.ty = BELT_Y;
      if (instant) { b.x = b.tx; b.y = b.ty; }
    });
  }

  // ---------- oyun kuralları ----------
  function exposedCellOf(color) {
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) {
        if (grid[r][c] === color && (r === 0 || grid[r - 1][c] < 0)) return [c, r];
      }
    }
    return null;
  }

  function clearedCount() {
    var left = 0;
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) if (grid[r][c] >= 0) left++;
    }
    return totalStitches - left;
  }

  function startBobbin(bob) {
    if (busy || won || failed) return;
    if (!exposedCellOf(bob.color)) { // şu an toplayacak ilmeği yok
      bob.shakeT = 1;
      sfx.blocked();
      return;
    }
    if (bob.state === 'racked') {
      rack[rack.indexOf(bob)] = null;
    }
    bob.state = 'active';
    active = bob;
    busy = true;
    chain = 0;
    collectTimer = 0;
    bob.tx = W / 2; bob.ty = BELT_Y - 46; // sahneye çık
  }

  function finishActive() {
    var bob = active;
    active = null;
    if (bob.remaining === 0) {
      bob.state = 'leaving';
      sfx.complete();
      setTimeout(function () {
        bob.state = 'gone';
        layoutBelt(false);
        settle();
      }, 350);
    } else {
      var slot = rack.indexOf(null);
      if (slot === -1) {
        failed = true;
        sfx.fail();
        setTimeout(function () { showOverlay(false); }, 500);
        busy = false;
        return;
      }
      rack[slot] = bob;
      bob.state = 'racked';
      bob.tx = RACK_X[slot]; bob.ty = RACK_Y;
      sfx.toRack();
      rackMaxUsed = Math.max(rackMaxUsed, rack.filter(Boolean).length);
      setTimeout(settle, 380);
    }
    layoutBelt(false);
  }

  function settle() {
    busy = false;
    if (clearedCount() === totalStitches) {
      won = true;
      sfx.win();
      spawnConfetti();
      setTimeout(function () { showOverlay(true); }, 650);
      return;
    }
    // tıkanma: görünür konveyör + askıdaki hiçbir bobin ilerleyemiyorsa
    var options = visibleQueue().concat(rack.filter(Boolean));
    var any = options.some(function (b) { return exposedCellOf(b.color); });
    if (!any) {
      failed = true;
      sfx.fail();
      setTimeout(function () { showOverlay(false); }, 600);
    }
  }

  // ---------- overlay ----------
  function stars() {
    return rackMaxUsed <= 1 ? 3 : (rackMaxUsed === 2 ? 2 : 1);
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
      ? 'Seviye ' + levelNum + ' tamamlandı'
      : 'İpler kilitli kaldı — sökme sırasını değiştirip tekrar dene';
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
  function tap(p) {
    if (won || failed) return;
    var candidates = visibleQueue().concat(rack.filter(Boolean));
    for (var i = 0; i < candidates.length; i++) {
      var b = candidates[i];
      if (Math.abs(p.x - b.x) < 44 && Math.abs(p.y - b.y) < 52) {
        startBobbin(b);
        return;
      }
    }
  }
  canvas.addEventListener('pointerdown', function (ev) {
    ensureAudio();
    tap(canvasPoint(ev));
  });

  document.getElementById('btn-restart').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum); });
  document.getElementById('btn-prev').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum - 1); });
  document.getElementById('btn-next').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum + 1); });
  document.getElementById('btn-replay').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum); });

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
    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W / 2, H * 0.4, 80, W / 2, H * 0.4, 460);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(120,95,60,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // örgü panosu (ahşap çerçeve)
    ctx.fillStyle = '#c89b6d';
    roundRect(BOARD.x - 14, BOARD.y - 14, BOARD.w + 28, BOARD.h + 28, 20);
    ctx.fill();
    ctx.fillStyle = '#f9f4e9';
    roundRect(BOARD.x - 4, BOARD.y - 4, BOARD.w + 8, BOARD.h + 8, 12);
    ctx.fill();

    // askı rafı
    ctx.fillStyle = 'rgba(122,92,58,0.25)';
    roundRect(52, RACK_Y - 34, W - 104, 74, 16);
    ctx.fill();
    ctx.fillStyle = '#8a6a48';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ASKI', 62, RACK_Y - 20);
    RACK_X.forEach(function (x) {
      ctx.strokeStyle = 'rgba(122,92,58,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(x, RACK_Y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // konveyör bandı
    ctx.fillStyle = '#4a4258';
    roundRect(26, BELT_Y - 34, W - 52, 72, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -(performance.now() / 40) % 26;
    ctx.beginPath();
    ctx.moveTo(34, BELT_Y + 26);
    ctx.lineTo(W - 34, BELT_Y + 26);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawStitch(c, r, colorIdx, exposed) {
    var x = boardX + c * cell, y = boardY + r * cell;
    var col = level.colors[colorIdx];
    var lw = cell * 0.3;
    ctx.lineCap = 'round';

    // koyu taban (derinlik)
    ctx.strokeStyle = shadeColor(col, -0.4);
    ctx.lineWidth = lw + 2;
    strokeV(x, y);

    ctx.strokeStyle = exposed ? shadeColor(col, 0.12) : shadeColor(col, -0.12);
    ctx.lineWidth = lw;
    strokeV(x, y);

    // açık ilmeklerin üst kenarına parlama
    if (exposed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.18, y + cell * 0.14);
      ctx.lineTo(x + cell * 0.34, y + cell * 0.14);
      ctx.stroke();
    }
  }

  function strokeV(x, y) {
    ctx.beginPath();
    ctx.moveTo(x + cell * 0.2, y + cell * 0.16);
    ctx.lineTo(x + cell * 0.5, y + cell * 0.82);
    ctx.moveTo(x + cell * 0.8, y + cell * 0.16);
    ctx.lineTo(x + cell * 0.5, y + cell * 0.82);
    ctx.stroke();
  }

  function drawBoard() {
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) {
        if (grid[r][c] < 0) continue;
        drawStitch(c, r, grid[r][c], r === 0 || grid[r - 1][c] < 0);
      }
    }
  }

  function drawBobbin(b) {
    ctx.save();
    var sx = b.x, sy = b.y;
    if (b.shakeT > 0) sx += Math.sin(b.shakeT * 40) * 4 * b.shakeT;
    ctx.translate(sx, sy);
    if (b.state === 'leaving') ctx.globalAlpha = Math.max(b.scale, 0);
    ctx.scale(b.scale, b.scale);

    var col = level.colors[b.color];
    // makara gövdesi
    ctx.fillStyle = '#e8dcc8';
    roundRect(-22, -30, 44, 60, 8);
    ctx.fill();
    // sarılı ip
    ctx.fillStyle = col;
    roundRect(-19, -20, 38, 40, 6);
    ctx.fill();
    for (var i = 0; i < 4; i++) {
      ctx.strokeStyle = shadeColor(col, i % 2 ? 0.18 : -0.18);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-19, -12 + i * 8);
      ctx.quadraticCurveTo(0, -8 + i * 8, 19, -12 + i * 8);
      ctx.stroke();
    }
    // kapasite rozeti
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 30, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(col, -0.25);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#4a3f66';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.display), 0, 31);
    ctx.restore();
  }

  function drawProgress() {
    var done = clearedCount();
    var bw = 180, x = (W - bw) / 2, y = 56;
    ctx.fillStyle = 'rgba(90,74,120,0.15)';
    roundRect(x, y, bw, 10, 5);
    ctx.fill();
    if (done > 0) {
      ctx.fillStyle = '#8d6bf0';
      roundRect(x, y, Math.max(10, bw * done / totalStitches), 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = '#7a6b9e';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(done + ' / ' + totalStitches, W / 2, y + 26);
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

  // ---------- güncelleme ----------
  function update(dt) {
    // bobin hareketleri (hedefe yumuşak süzülme)
    queue.forEach(function (b) {
      if (b.state === 'gone') return;
      if (b.shakeT > 0) b.shakeT = Math.max(0, b.shakeT - dt * 3);
      if (b.tx !== undefined) {
        b.x += (b.tx - b.x) * Math.min(dt * 10, 1);
        b.y += (b.ty - b.y) * Math.min(dt * 10, 1);
      }
      if (b.state === 'leaving') {
        b.scale = Math.max(0, b.scale - dt * 3);
        b.ty = BELT_Y - 140;
      }
    });

    // aktif bobin toplama döngüsü
    if (active) {
      collectTimer += dt * 1000;
      while (active && collectTimer >= COLLECT_MS) {
        collectTimer -= COLLECT_MS;
        var found = active.remaining > 0 ? exposedCellOf(active.color) : null;
        if (found) {
          grid[found[1]][found[0]] = -1;
          active.remaining--;
          sfx.stitch();
          flyers.push({
            x: boardX + found[0] * cell + cell / 2,
            y: boardY + found[1] * cell + cell / 2,
            bob: active, t: 0, color: level.colors[active.color]
          });
        } else {
          finishActive();
        }
      }
    }

    // uçan ilmekler
    flyers.forEach(function (f) {
      f.t += dt * 2.4;
      if (f.t >= 1 && !f.done) {
        f.done = true;
        f.bob.display = Math.max(0, f.bob.display - 1);
      }
    });
    flyers = flyers.filter(function (f) { return !f.done; });
  }

  function drawFlyers() {
    flyers.forEach(function (f) {
      var t = Math.min(f.t, 1);
      var mx = (f.x + f.bob.x) / 2 + 30;
      var my = (f.y + f.bob.y) / 2 - 40;
      var u = 1 - t;
      var x = u * u * f.x + 2 * u * t * mx + t * t * f.bob.x;
      var y = u * u * f.y + 2 * u * t * my + t * t * (f.bob.y - 20);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 6);
      ctx.scale(1 - t * 0.5, 1 - t * 0.5);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, -6);
      ctx.lineTo(0, 7);
      ctx.moveTo(7, -6);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.restore();
    });
  }

  function frame(ts) {
    var dt = Math.min((ts - lastTime) / 1000 || 0, 0.05);
    lastTime = ts;
    update(dt);

    drawBackground();
    drawProgress();
    drawBoard();
    queue.forEach(function (b) {
      if (b.state !== 'gone' && b.state !== 'queued') drawBobbin(b);
    });
    visibleQueue().forEach(drawBobbin);
    drawFlyers();
    if (confetti.length) drawConfetti(dt);

    requestAnimationFrame(frame);
  }

  // test kancası
  window.__yarn = {
    getLevel: function () { return level; },
    getGrid: function () { return grid; },
    getQueue: function () { return queue; },
    getRack: function () { return rack; },
    visibleQueue: visibleQueue,
    startBobbin: startBobbin,
    isWon: function () { return won; },
    isFailed: function () { return failed; },
    isBusy: function () { return busy || !!active; },
    cleared: clearedCount,
    total: function () { return totalStitches; },
    loadLevel: loadLevel
  };

  loadLevel(levelNum);
  requestAnimationFrame(frame);
})();
