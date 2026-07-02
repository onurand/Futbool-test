/*
 * Yarn Loop — hyper-casual yarn untangle clone.
 *
 * Mechanic: colored yarn loops are stretched around pins, stacked on top of
 * each other. A loop can only be unwound (tap it) when no loop above it
 * crosses it or shares a pin with it. Unwound yarn flies onto the ball at
 * the bottom. Clear every loop to finish the level.
 *
 * Levels are procedurally generated from a seeded RNG, so level N is the
 * same for everyone. Because blocking follows a total z-order, the topmost
 * remaining loop is always removable — every level is solvable.
 */
(function () {
  'use strict';

  // ---------- constants ----------
  var W = 420;
  var H = 700;
  var YARN_WIDTH = 10;
  var HIT_SLACK = 15;
  var PIN_BASE_RADIUS = 13; // innermost wrap radius around a pin
  var PIN_STACK_STEP = 6.5; // extra radius per loop stacked on the same pin
  var BALL = { x: W / 2, y: 608 };
  var BALL_BASE_R = 20;

  var PALETTE = [
    '#e5484d', '#f76b15', '#ffc53d', '#46a758', '#00a2c7',
    '#3e63dd', '#8e4ec6', '#e93d82', '#12a594', '#ad7f58', '#687076'
  ];

  // ---------- small math helpers ----------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  // point on segment [v -> to] at distance d from v
  function toward(v, to, d) {
    var L = dist(v, to) || 1;
    return { x: v.x + (to.x - v.x) / L * d, y: v.y + (to.y - v.y) / L * d };
  }

  function quadPoint(p0, c, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
    };
  }

  function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  function segIntersect(a, b, c, d) {
    var d1 = cross(a, b, c), d2 = cross(a, b, d);
    var d3 = cross(c, d, a), d4 = cross(c, d, b);
    return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
  }

  function pointSegDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    var q = { x: a.x + dx * t, y: a.y + dy * t };
    return dist(p, q);
  }

  // Andrew's monotone chain — returns hull points in CCW order
  function convexHull(points) {
    var pts = points.slice().sort(function (p, q) {
      return p.x === q.x ? p.y - q.y : p.x - q.x;
    });
    if (pts.length < 3) return pts;
    var lower = [], upper = [], i;
    for (i = 0; i < pts.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
      lower.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
      upper.push(pts[i]);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  function polygonArea(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  }

  function shadeColor(hex, amt) {
    // amt > 0 lightens toward white, amt < 0 darkens toward black
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var target = amt > 0 ? 255 : 0;
    var t = Math.abs(amt);
    r = Math.round(r + (target - r) * t);
    g = Math.round(g + (target - g) * t);
    b = Math.round(b + (target - b) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---------- level generation ----------
  function generateLevel(n) {
    var rnd = mulberry32(n * 7919 + 12345);
    var pinCount = Math.min(5 + Math.floor((n - 1) / 2), 11);
    var loopCount = Math.min(2 + Math.floor((n - 1) * 0.85), 11);

    // scatter pins with a minimum spacing (relaxes if space runs out)
    var pins = [];
    var minD = 82;
    var guard = 0;
    while (pins.length < pinCount && guard < 6000) {
      guard++;
      if (guard % 600 === 0) minD *= 0.92;
      var p = { x: 55 + rnd() * (W - 110), y: 130 + rnd() * 360 };
      var ok = true;
      for (var i = 0; i < pins.length; i++) {
        if (dist(p, pins[i]) < minD) { ok = false; break; }
      }
      if (ok) pins.push(p);
    }

    var colors = PALETTE.slice();
    for (var c = colors.length - 1; c > 0; c--) {
      var j = Math.floor(rnd() * (c + 1));
      var tmp = colors[c]; colors[c] = colors[j]; colors[j] = tmp;
    }

    var loops = [];
    var tries = 0;
    while (loops.length < loopCount && tries < 400) {
      tries++;
      var size = 3;
      if (rnd() < Math.min(0.15 + n * 0.03, 0.5)) size = 4;
      if (n > 8 && rnd() < 0.2) size = 5;
      size = Math.min(size, pins.length);

      // pick `size` distinct pins
      var idx = [];
      var pool = pins.map(function (_, k) { return k; });
      for (var s = 0; s < size; s++) {
        idx.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      }

      var hull = convexHull(idx.map(function (k) { return { x: pins[k].x, y: pins[k].y, idx: k }; }));
      if (hull.length < 3) continue;
      if (polygonArea(hull) < 4000) continue;

      loops.push({
        pinIdx: hull.map(function (h) { return h.idx; }),
        color: colors[loops.length % colors.length],
        z: loops.length // reassigned below
      });
    }

    // random z-order (draw order & blocking order)
    var order = loops.map(function (_, k) { return k; });
    for (var o = order.length - 1; o > 0; o--) {
      var r = Math.floor(rnd() * (o + 1));
      var t2 = order[o]; order[o] = order[r]; order[r] = t2;
    }
    order.forEach(function (loopIdx, z) { loops[loopIdx].z = z; });

    return { n: n, pins: pins, loops: loops };
  }

  // ---------- geometry: sampled outlines, stacking, overlaps ----------
  function buildGeometry(level) {
    var pins = level.pins;

    // loops sharing a pin stack outward by z: higher z sits outside (on top)
    var stacks = pins.map(function () { return []; });
    level.loops.forEach(function (loop, li) {
      loop.id = li;
      loop.pinIdx.forEach(function (pi) { stacks[pi].push(loop); });
    });
    stacks.forEach(function (st) {
      st.sort(function (a, b) { return a.z - b.z; });
    });

    level.loops.forEach(function (loop) {
      var vs = loop.pinIdx.map(function (pi) { return pins[pi]; });
      var k = vs.length;

      var radii = loop.pinIdx.map(function (pi) {
        var stackIdx = stacks[pi].indexOf(loop);
        return PIN_BASE_RADIUS + stackIdx * PIN_STACK_STEP;
      });

      var corners = vs.map(function (v, i) {
        var prev = vs[(i - 1 + k) % k];
        var next = vs[(i + 1) % k];
        var r = Math.min(radii[i], dist(v, prev) * 0.42, dist(v, next) * 0.42, 36);
        return { v: v, pIn: toward(v, prev, r), pOut: toward(v, next, r) };
      });

      // sample a closed polyline: rounded corner then straight edge, repeat
      var pts = [];
      for (var i = 0; i < k; i++) {
        var a = corners[i], b = corners[(i + 1) % k];
        for (var q = 0; q <= 10; q++) {
          pts.push(quadPoint(a.pIn, a.v, a.pOut, q / 10));
        }
        var edgeLen = dist(a.pOut, b.pIn);
        var steps = Math.max(1, Math.floor(edgeLen / 12));
        for (var e = 1; e <= steps; e++) {
          pts.push(lerp(a.pOut, b.pIn, e / steps));
        }
      }
      loop.pts = pts;

      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      pts.forEach(function (p) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      loop.bbox = { minX: minX, minY: minY, maxX: maxX, maxY: maxY };

      loop.state = 'alive';
      loop.rt = 0;        // unwind progress (index into pts)
      loop.shakeT = 0;
      loop.flashT = 0;
      loop.dashOffset = Math.floor(dist(pts[0], BALL)) % 16;
    });

    // pairwise overlap: crossing outlines OR sharing a pin
    var L = level.loops;
    var overlap = L.map(function () { return L.map(function () { return false; }); });
    for (var x = 0; x < L.length; x++) {
      for (var y = x + 1; y < L.length; y++) {
        overlap[x][y] = overlap[y][x] = loopsOverlap(L[x], L[y]);
      }
    }
    level.overlap = overlap;
    return level;
  }

  function loopsOverlap(a, b) {
    for (var i = 0; i < a.pinIdx.length; i++) {
      if (b.pinIdx.indexOf(a.pinIdx[i]) !== -1) return true;
    }
    if (a.bbox.maxX < b.bbox.minX || b.bbox.maxX < a.bbox.minX ||
        a.bbox.maxY < b.bbox.minY || b.bbox.maxY < a.bbox.minY) return false;
    var pa = a.pts, pb = b.pts;
    for (var s = 0; s < pa.length; s++) {
      var a1 = pa[s], a2 = pa[(s + 1) % pa.length];
      for (var t = 0; t < pb.length; t++) {
        if (segIntersect(a1, a2, pb[t], pb[(t + 1) % pb.length])) return true;
      }
    }
    return false;
  }

  function blockersOf(level, loop) {
    return level.loops.filter(function (m) {
      return m !== loop && m.state === 'alive' && m.z > loop.z && level.overlap[loop.id][m.id];
    });
  }

  // greedy solver used by the node smoke test
  function solveCheck(level) {
    var alive = level.loops.slice();
    var removedTotal = 0;
    while (alive.length) {
      var removable = alive.filter(function (l) {
        return alive.every(function (m) {
          return m === l || m.z < l.z || !level.overlap[l.id][m.id];
        });
      });
      if (!removable.length) return false;
      alive = alive.filter(function (l) { return removable.indexOf(l) === -1; });
      removedTotal += removable.length;
    }
    return removedTotal === level.loops.length;
  }

  // ---------- node export (logic smoke tests without a browser) ----------
  if (typeof window === 'undefined') {
    module.exports = {
      generateLevel: generateLevel,
      buildGeometry: buildGeometry,
      solveCheck: solveCheck,
      blockersOf: blockersOf
    };
    return;
  }

  // =====================================================================
  //                            BROWSER GAME
  // =====================================================================
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');

  var levelNum = parseInt(localStorage.getItem('yarnloop.level') || '1', 10);
  if (!(levelNum >= 1)) levelNum = 1;

  var level = null;
  var mistakes = 0;
  var collected = [];       // colors wound onto the ball, in order
  var ballPulse = 0;
  var ballSpin = 0;
  var confetti = [];
  var won = false;
  var lastTime = 0;

  // ---------- sizing ----------
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

  // ---------- audio (tiny synth, no assets) ----------
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
    pop: function () { beep(520, 940, 0.16, 'triangle', 0.25); },
    wind: function () { beep(300, 480, 0.4, 'sine', 0.08); },
    blocked: function () { beep(160, 110, 0.18, 'sawtooth', 0.12); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        beep(f, f, 0.22, 'triangle', 0.2, i * 0.12);
      });
    }
  };

  // ---------- level lifecycle ----------
  function loadLevel(n) {
    levelNum = Math.max(1, n);
    localStorage.setItem('yarnloop.level', String(levelNum));
    level = buildGeometry(generateLevel(levelNum));
    mistakes = 0;
    collected = [];
    ballPulse = 0;
    confetti = [];
    won = false;
    document.getElementById('level-label').textContent = 'Seviye ' + levelNum;
    updateMistakeLabel();
    hideOverlay();
  }

  function updateMistakeLabel() {
    var el = document.getElementById('mistake-label');
    el.textContent = mistakes === 0 ? '' : '✖ ' + mistakes + ' hatalı dokunuş';
  }

  function starsForMistakes(m) {
    return m === 0 ? 3 : (m <= 2 ? 2 : 1);
  }

  function showOverlay() {
    var stars = starsForMistakes(mistakes);
    var starEl = document.getElementById('overlay-stars');
    starEl.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var s = document.createElement('span');
      s.textContent = '★';
      if (i >= stars) s.className = 'dim';
      starEl.appendChild(s);
    }
    document.getElementById('overlay-title').textContent =
      stars === 3 ? 'Mükemmel!' : 'Tebrikler!';
    document.getElementById('overlay-sub').textContent =
      'Seviye ' + levelNum + ' tamamlandı' +
      (mistakes ? ' · ' + mistakes + ' hatalı dokunuş' : ' · hatasız!');
    document.getElementById('overlay').classList.remove('hidden');
  }

  function hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
  }

  // ---------- input ----------
  function canvasPoint(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) / rect.width * W,
      y: (ev.clientY - rect.top) / rect.height * H
    };
  }

  function hitLoop(p) {
    var candidates = level.loops
      .filter(function (l) { return l.state === 'alive'; })
      .sort(function (a, b) { return b.z - a.z; });
    for (var c = 0; c < candidates.length; c++) {
      var l = candidates[c];
      var bb = l.bbox;
      if (p.x < bb.minX - HIT_SLACK || p.x > bb.maxX + HIT_SLACK ||
          p.y < bb.minY - HIT_SLACK || p.y > bb.maxY + HIT_SLACK) continue;
      for (var s = 0; s < l.pts.length; s++) {
        if (pointSegDist(p, l.pts[s], l.pts[(s + 1) % l.pts.length]) <= YARN_WIDTH / 2 + HIT_SLACK) {
          return l;
        }
      }
    }
    return null;
  }

  function tap(p) {
    if (won) return;
    var loop = hitLoop(p);
    if (!loop) return;
    var blockers = blockersOf(level, loop);
    if (blockers.length) {
      mistakes++;
      updateMistakeLabel();
      loop.shakeT = 1;
      blockers.forEach(function (b) { b.flashT = 1; });
      sfx.blocked();
      return;
    }
    loop.state = 'removing';
    loop.rt = 0;
    sfx.wind();
  }

  canvas.addEventListener('pointerdown', function (ev) {
    ensureAudio();
    tap(canvasPoint(ev));
  });

  document.getElementById('btn-restart').addEventListener('click', function () {
    ensureAudio();
    loadLevel(levelNum);
  });
  document.getElementById('btn-prev').addEventListener('click', function () {
    ensureAudio();
    loadLevel(levelNum - 1);
  });
  document.getElementById('btn-next').addEventListener('click', function () {
    ensureAudio();
    loadLevel(levelNum + 1);
  });
  document.getElementById('btn-replay').addEventListener('click', function () {
    ensureAudio();
    loadLevel(levelNum);
  });

  // ---------- drawing ----------
  function drawBoard() {
    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(0, 0, W, H);

    // soft vignette
    var g = ctx.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.42, 430);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(120,95,60,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // pin board panel
    ctx.fillStyle = 'rgba(122, 92, 58, 0.09)';
    roundRect(22, 96, W - 44, 428, 26);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPin(p) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    var g = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, 8);
    g.addColorStop(0, '#f4f6f8');
    g.addColorStop(0.6, '#aeb6bf');
    g.addColorStop(1, '#6d7680');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,66,74,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function strokePolyline(pts, from, closed) {
    ctx.beginPath();
    ctx.moveTo(pts[from].x, pts[from].y);
    for (var i = from + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (closed) ctx.closePath();
    ctx.stroke();
  }

  function yarnStyle(loop, drawFn) {
    var flash = loop.flashT;
    var base = flash > 0 ? mixToWhite(loop.color, Math.min(flash, 0.7)) : loop.color;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.strokeStyle = shadeColor(loop.color, -0.45);
    ctx.lineWidth = YARN_WIDTH + 3.5;
    drawFn();

    ctx.strokeStyle = base;
    ctx.lineWidth = YARN_WIDTH;
    drawFn();

    // twisted-fiber highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = YARN_WIDTH - 3;
    ctx.setLineDash([6, 9]);
    ctx.lineDashOffset = loop.dashOffset;
    drawFn();
    ctx.setLineDash([]);
  }

  function mixToWhite(hex, t) {
    return shadeColor(hex, t);
  }

  function drawLoop(loop) {
    ctx.save();
    if (loop.shakeT > 0) {
      var s = Math.sin(loop.shakeT * 40) * 4 * loop.shakeT;
      ctx.translate(s, 0);
    }

    if (loop.state === 'alive') {
      yarnStyle(loop, function () { strokePolyline(loop.pts, 0, true); });
    } else if (loop.state === 'removing') {
      var head = Math.min(Math.floor(loop.rt), loop.pts.length - 1);
      if (head < loop.pts.length - 1) {
        yarnStyle(loop, function () { strokePolyline(loop.pts, head, false); });
      }
      // strand being pulled to the ball
      var hp = loop.pts[head];
      var mid = { x: (hp.x + BALL.x) / 2 + 18, y: (hp.y + BALL.y) / 2 + 46 };
      ctx.strokeStyle = loop.color;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hp.x, hp.y);
      ctx.quadraticCurveTo(mid.x, mid.y, BALL.x, BALL.y - ballRadius() * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function ballRadius() {
    return BALL_BASE_R + collected.length * 2.6 + ballPulse * 5;
  }

  function drawBall() {
    var r = ballRadius();
    var baseColor = collected.length ? collected[collected.length - 1] : '#c9b8a8';

    ctx.save();
    ctx.translate(BALL.x, BALL.y);
    ctx.rotate(ballSpin);

    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // wrapped strands: arcs of every collected color
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (var i = 0; i < collected.length + 3; i++) {
      var col = collected.length
        ? collected[i % collected.length]
        : '#b3a08e';
      ctx.strokeStyle = shadeColor(col, i % 2 ? 0.25 : -0.2);
      ctx.beginPath();
      var ang = i * 1.7;
      ctx.ellipse(0, 0, r * 0.92, r * (0.35 + (i % 3) * 0.22), ang, 0.3, Math.PI * 2 - 0.3);
      ctx.stroke();
    }

    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.4, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawProgress() {
    var total = level.loops.length;
    var done = level.loops.filter(function (l) { return l.state === 'gone'; }).length;
    var bw = 180;
    var x = (W - bw) / 2, y = 62;
    ctx.fillStyle = 'rgba(90,74,120,0.15)';
    roundRect(x, y, bw, 10, 5);
    ctx.fill();
    if (done > 0) {
      ctx.fillStyle = '#8d6bf0';
      roundRect(x, y, Math.max(10, bw * done / total), 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = '#7a6b9e';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(done + ' / ' + total, W / 2, y + 26);
  }

  function spawnConfetti() {
    for (var i = 0; i < 120; i++) {
      confetti.push({
        x: Math.random() * W,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 60,
        vy: 120 + Math.random() * 160,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 8,
        size: 5 + Math.random() * 6,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)]
      });
    }
  }

  function drawConfetti(dt) {
    confetti.forEach(function (c) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.66);
      ctx.restore();
    });
    confetti = confetti.filter(function (c) { return c.y < H + 30; });
  }

  // ---------- main loop ----------
  function update(dt) {
    var anyRemoving = false;
    level.loops.forEach(function (loop) {
      if (loop.shakeT > 0) loop.shakeT = Math.max(0, loop.shakeT - dt * 3);
      if (loop.flashT > 0) loop.flashT = Math.max(0, loop.flashT - dt * 2.4);

      if (loop.state === 'removing') {
        anyRemoving = true;
        // consume the outline at a steady pace (~0.7s per loop)
        loop.rt += loop.pts.length * dt / 0.7;
        if (loop.rt >= loop.pts.length - 1) {
          loop.state = 'gone';
          collected.push(loop.color);
          ballPulse = 1;
          sfx.pop();
          checkWin();
        }
      }
    });

    if (anyRemoving) ballSpin += dt * 6;
    if (ballPulse > 0) ballPulse = Math.max(0, ballPulse - dt * 3);
  }

  function checkWin() {
    var allGone = level.loops.every(function (l) { return l.state === 'gone'; });
    if (allGone && !won) {
      won = true;
      sfx.win();
      spawnConfetti();
      setTimeout(showOverlay, 650);
    }
  }

  function frame(ts) {
    var dt = Math.min((ts - lastTime) / 1000 || 0, 0.05);
    lastTime = ts;

    update(dt);

    drawBoard();
    drawProgress();
    level.pins.forEach(drawPin);
    level.loops
      .slice()
      .sort(function (a, b) { return a.z - b.z; })
      .forEach(function (loop) {
        if (loop.state !== 'gone') drawLoop(loop);
      });
    drawBall();
    if (confetti.length) drawConfetti(dt);

    requestAnimationFrame(frame);
  }

  // test hook (used by the headless browser check)
  window.__yarn = {
    getLevel: function () { return level; },
    getLevelNum: function () { return levelNum; },
    isWon: function () { return won; },
    tap: tap,
    blockersOf: function (loop) { return blockersOf(level, loop); },
    loadLevel: loadLevel
  };

  loadLevel(levelNum);
  requestAnimationFrame(frame);
})();
