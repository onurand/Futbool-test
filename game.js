/*
 * Yarn Loop — 3B görsel katman (Three.js r147, vendor/three.min.js).
 *
 * Oyun mantığı logic.js'te (window.YarnLogic). Bu dosya sahneyi kurar:
 * ışıklandırma + gölgeler, örgü ilmekleri (InstancedMesh, kapsül bacaklı V),
 * silindirik makaralar (sarım halkaları + kapak diskleri), ray (tüp),
 * ip teli (her karede güncellenen tüp eğrisi), uçan ilmekler, ışıltı ve
 * konfeti havuzları. Tüm yerleşim 420x700'lük mantık düzleminde tutulur,
 * dünya koordinatına tek bir dönüşümle geçilir — böylece oyun kuralları
 * ve dokunma bölgeleri 2B sürümle birebir aynı kalır.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return; // mantık testleri logic.js'i kullanır

  var YL = window.YarnLogic;

  // ---------- yerleşim sabitleri (mantık düzlemi: 420x700) ----------
  var W = 420;
  var H = 700;
  var BOARD = { x: 70, y: 96, w: 280, h: 280 };
  var RAIL_PAD = 26;
  var DOCK_Y = 478;
  var DOCK_X = [66, 138, 210, 282, 354];
  var TRAY_Y = 606;
  var TRAY_X = [66, 138, 210, 282, 354];
  var STITCH_MS = 105;

  var WS = 0.1; // dünya ölçeği: 1 mantık birimi = 0.1 dünya birimi
  function wx(x) { return (x - W / 2) * WS; }
  function wy(y) { return (H / 2 - y) * WS; }

  // ---------- durum ----------
  var level = null;
  var alive = null;
  var cell = 0, boardX = 0, boardY = 0;
  var pos = 0;
  var trayCols = null;
  var dock = [null, null, null, null, null];
  var rider = null;
  var railT = 0.62;
  var stitchTimer = 0;
  var won = false, failed = false;
  var maxDockUsed = 0;
  var stalledSince = 0;
  var shakeT = 0;
  var now = 0;
  var lastTime = 0;
  var levelNum = parseInt(localStorage.getItem('yarnloop.level') || '1', 10);
  if (!(levelNum >= 1)) levelNum = 1;

  // ---------- tween ----------
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

  // ---------- three.js sahnesi ----------
  var canvas = document.getElementById('canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4a423f);
  scene.fog = new THREE.Fog(0x4a423f, 120, 190);

  var camera = new THREE.PerspectiveCamera(40, W / H, 1, 300);
  camera.position.set(0, -3, 100);
  camera.lookAt(0, 0, 0);

  var root = new THREE.Group(); // sarsıntı/nabız için kök grup
  scene.add(root);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var keyLight = new THREE.DirectionalLight(0xfff2e0, 0.9);
  keyLight.position.set(18, 30, 40);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -40;
  keyLight.shadow.camera.right = 40;
  keyLight.shadow.camera.top = 45;
  keyLight.shadow.camera.bottom = -45;
  scene.add(keyLight);
  var fillLight = new THREE.DirectionalLight(0xbfd4ff, 0.35);
  fillLight.position.set(-20, -10, 30);
  scene.add(fillLight);

  // arka duvar (gölgeleri alır)
  var wall = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 200),
    new THREE.MeshStandardMaterial({ color: 0x554b48, roughness: 0.95 })
  );
  wall.position.z = -2.4;
  wall.receiveShadow = true;
  root.add(wall);

  function resize() {
    var maxW = Math.min(window.innerWidth * 0.94, 420);
    var maxH = window.innerHeight - 150;
    var scale = Math.min(maxW / W, maxH / H);
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W * scale, H * scale, false);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- malzeme yardımcıları ----------
  var matCache = {};
  function mat(hex, opts) {
    var key = hex + JSON.stringify(opts || {});
    if (!matCache[key]) {
      matCache[key] = new THREE.MeshStandardMaterial(Object.assign({
        color: new THREE.Color(hex), roughness: 0.55, metalness: 0.05
      }, opts || {}));
    }
    return matCache[key];
  }
  function shade(hex, amt) {
    var c = new THREE.Color(hex);
    var t = new THREE.Color(amt > 0 ? 0xffffff : 0x000000);
    c.lerp(t, Math.abs(amt));
    return '#' + c.getHexString();
  }

  // ---------- ray ----------
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

  var staticGroup = new THREE.Group();
  root.add(staticGroup);

  function buildStatics() {
    while (staticGroup.children.length) staticGroup.remove(staticGroup.children[0]);

    // ray: kapalı tüp
    var pts = [];
    for (var t = 0; t < 1; t += 0.01) {
      var p = railPoint(t);
      pts.push(new THREE.Vector3(wx(p.x), wy(p.y), 1.4));
    }
    var curve = new THREE.CatmullRomCurve3(pts, true);
    var railMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 200, 0.55, 10, true),
      mat('#e8dcc4', { roughness: 0.4 })
    );
    railMesh.castShadow = true;
    staticGroup.add(railMesh);
    // ray vidaları
    var studGeo = new THREE.SphereGeometry(0.22, 8, 8);
    for (t = 0; t < 1; t += 0.05) {
      var sp = railPoint(t);
      var stud = new THREE.Mesh(studGeo, mat('#6b6058', { roughness: 0.3, metalness: 0.6 }));
      stud.position.set(wx(sp.x), wy(sp.y), 2.0);
      staticGroup.add(stud);
    }

    // örgü zemini (koyu pano)
    var back = new THREE.Mesh(
      new THREE.BoxGeometry((level.cols * cell + 14) * WS, (level.rows * cell + 14) * WS, 0.8),
      mat('#33302e', { roughness: 0.9 })
    );
    back.position.set(wx(W / 2), wy(boardY + level.rows * cell / 2), -0.5);
    back.receiveShadow = true;
    staticGroup.add(back);

    // yuva çukurları
    DOCK_X.forEach(function (x) {
      var slot = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 6.8, 0.8),
        mat('#3a3331', { roughness: 0.9 })
      );
      slot.position.set(wx(x), wy(DOCK_Y), -0.4);
      slot.receiveShadow = true;
      staticGroup.add(slot);
    });

    // tepsi paneli
    var tray = new THREE.Mesh(
      new THREE.BoxGeometry((W - 48) * WS, 12.4, 1.2),
      mat('#3a3331', { roughness: 0.9 })
    );
    tray.position.set(0, wy(TRAY_Y + 6), -0.7);
    tray.receiveShadow = true;
    staticGroup.add(tray);
  }

  // ---------- örgü ilmekleri (instanced) ----------
  var stitchMesh = null;
  var dummy = new THREE.Object3D();

  function buildStitches() {
    if (stitchMesh) { root.remove(stitchMesh); stitchMesh.geometry.dispose(); }
    var s = cell * WS;
    var legGeo = new THREE.CapsuleGeometry(s * 0.17, s * 0.62, 4, 10);
    var count = level.rows * level.cols * 2;
    stitchMesh = new THREE.InstancedMesh(legGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), count);
    stitchMesh.castShadow = true;
    stitchMesh.receiveShadow = true;
    var i = 0;
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) {
        var color = new THREE.Color(level.colors[level.grid[r][c]]);
        for (var leg = 0; leg < 2; leg++) {
          setStitchInstance(i, c, r, leg, 1);
          stitchMesh.setColorAt(i, color);
          i++;
        }
      }
    }
    stitchMesh.instanceMatrix.needsUpdate = true;
    if (stitchMesh.instanceColor) stitchMesh.instanceColor.needsUpdate = true;
    root.add(stitchMesh);
  }

  function setStitchInstance(i, c, r, leg, scale) {
    var s = cell * WS;
    var cx = boardX + c * cell + cell / 2;
    var cy = boardY + r * cell + cell / 2;
    dummy.position.set(
      wx(cx) + (leg === 0 ? -s * 0.20 : s * 0.20),
      wy(cy),
      0.45
    );
    dummy.rotation.set(0, 0, leg === 0 ? 0.42 : -0.42);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    stitchMesh.setMatrixAt(i, dummy.matrix);
  }

  function hideStitch(c, r) {
    var base = (r * level.cols + c) * 2;
    setStitchInstance(base, c, r, 0, 0.0001);
    setStitchInstance(base + 1, c, r, 1, 0.0001);
    stitchMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- makara modeli ----------
  function buildSpoolMesh(colorHex) {
    var g = new THREE.Group();
    var body = mat(colorHex, { roughness: 0.5 });
    var dark = mat(shade(colorHex, -0.35), { roughness: 0.55 });

    // sarım halkaları
    for (var i = 0; i < 4; i++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.42, 10, 24), i % 2 ? body : mat(shade(colorHex, 0.12), { roughness: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.15 + i * 0.78;
      ring.castShadow = true;
      g.add(ring);
    }
    // orta silindir
    var core = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 3.2, 20), body);
    core.position.y = 0;
    core.castShadow = true;
    g.add(core);
    // kapak diskleri
    var capTop = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.34, 24), dark);
    capTop.position.y = 1.85;
    capTop.castShadow = true;
    g.add(capTop);
    var capBot = capTop.clone();
    capBot.position.y = -1.85;
    g.add(capBot);
    // mil
    var axle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.4, 12), mat('#d8cdbb', { roughness: 0.35 }));
    g.add(axle);
    return g;
  }

  // kapasite rozeti (CanvasTexture sprite)
  var badgeCache = {};
  function badgeSprite(count, colorHex) {
    var key = count + colorHex;
    if (!badgeCache[key]) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      var c = cv.getContext('2d');
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(48, 48, 40, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = shade(colorHex, -0.3);
      c.stroke();
      c.fillStyle = '#3b3347';
      c.font = '800 ' + (String(count).length > 2 ? 30 : 38) + 'px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(count), 48, 50);
      var tex = new THREE.CanvasTexture(cv);
      badgeCache[key] = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    }
    return badgeCache[key];
  }

  // ---------- makara varlıkları ----------
  // sp: {color, cap, remaining, x, y, scale, rot, state, group, badge}
  var allSpools = [];

  function makeSpoolEntity(colorIdx, cap, x, y, scale) {
    var sp = {
      color: colorIdx, cap: cap, remaining: cap,
      x: x, y: y, z: 1.2, scale: scale, rot: 0, shake: 0, state: 'tray'
    };
    sp.group = buildSpoolMesh(level.colors[colorIdx]);
    sp.badge = new THREE.Sprite(badgeSprite(cap, level.colors[colorIdx]));
    sp.badge.scale.set(2.7, 2.7, 1);
    sp.badge.position.y = 3.4;
    sp.group.add(sp.badge);
    root.add(sp.group);
    allSpools.push(sp);
    return sp;
  }

  function syncSpool(sp) {
    if (sp.shake > 0) sp.shake = Math.max(0, sp.shake - 0.035);
    sp.group.position.set(wx(sp.x), wy(sp.y), sp.z);
    sp.group.scale.setScalar(Math.max(sp.scale, 0.0001) * 1.35);
    sp.group.rotation.z = (sp.rot || 0) + (sp.shake ? Math.sin(now * 40) * 0.16 * sp.shake : 0);
    sp.group.rotation.y = sp.state === 'riding' ? now * 5 : 0; // sararken kendi ekseninde döner
    var m = badgeSprite(sp.remaining, level.colors[sp.color]);
    if (sp.badge.material !== m) sp.badge.material = m;
    sp.badge.visible = sp.scale > 0.3 && sp.state !== 'completing';
  }

  function removeSpoolEntity(sp) {
    root.remove(sp.group);
    allSpools = allSpools.filter(function (s) { return s !== sp; });
  }

  // ---------- ip teli ----------
  var strandMesh = null;
  function updateStrand() {
    if (strandMesh) {
      root.remove(strandMesh);
      strandMesh.geometry.dispose();
      strandMesh = null;
    }
    if (!rider || pos >= level.stream.length) return;
    if (rider.state !== 'riding' && rider.state !== 'toRail') return;
    var st = level.stream[pos];
    var sx = boardX + st.c * cell + cell / 2;
    var sy = boardY + st.r * cell + cell / 2;
    var wob = Math.sin(now * 11) * 0.5;
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(wx(sx), wy(sy), 0.7),
      new THREE.Vector3((wx(sx) + wx(rider.x)) / 2 + wob, (wy(sy) + wy(rider.y)) / 2 - 1.6, 1.6),
      new THREE.Vector3(wx(rider.x), wy(rider.y) + 0.6, rider.z)
    ]);
    strandMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.16, 6, false),
      mat(level.colors[rider.color], { roughness: 0.45 })
    );
    root.add(strandMesh);
  }

  // ---------- uçan ilmekler ----------
  var flyers = [];
  var flyerGeo = null;
  function spawnFlyer(st, target) {
    if (!flyerGeo) flyerGeo = new THREE.CapsuleGeometry(0.28, 1.1, 3, 8);
    var g = new THREE.Group();
    [-0.35, 0.35].forEach(function (off, i) {
      var leg = new THREE.Mesh(flyerGeo, mat(level.colors[st.color]));
      leg.position.x = off;
      leg.rotation.z = i === 0 ? 0.42 : -0.42;
      g.add(leg);
    });
    root.add(g);
    flyers.push({
      g: g, t: 0, target: target,
      x0: boardX + st.c * cell + cell / 2,
      y0: boardY + st.r * cell + cell / 2
    });
  }
  function updateFlyers(dt) {
    for (var i = flyers.length - 1; i >= 0; i--) {
      var f = flyers[i];
      f.t += dt * 2.6;
      if (f.t >= 1) {
        root.remove(f.g);
        flyers.splice(i, 1);
        continue;
      }
      var t = f.t, u = 1 - t;
      var mx = (f.x0 + f.target.x) / 2 + 24, my = (f.y0 + f.target.y) / 2 - 30;
      var x = u * u * f.x0 + 2 * u * t * mx + t * t * f.target.x;
      var y = u * u * f.y0 + 2 * u * t * my + t * t * f.target.y;
      f.g.position.set(wx(x), wy(y), 1.5);
      f.g.rotation.z = t * 7;
      var s = (1 - t * 0.5) * 0.9;
      f.g.scale.setScalar(s);
    }
  }

  // ---------- parçacıklar (ışıltı + konfeti havuzu) ----------
  var particles = [];
  var particleGeo = null;
  function spawnParticle(x, y, vx, vy, colorHex, size, life) {
    if (!particleGeo) particleGeo = new THREE.SphereGeometry(0.5, 6, 6);
    var m = new THREE.Mesh(particleGeo, mat(colorHex));
    m.scale.setScalar(size);
    root.add(m);
    particles.push({ m: m, x: x, y: y, vx: vx, vy: vy, t: 0, life: life || 0.8 });
  }
  function spawnSparkle(x, y) {
    for (var i = 0; i < 16; i++) {
      var a = Math.random() * Math.PI * 2;
      spawnParticle(x, y, Math.cos(a) * (70 + Math.random() * 130),
        Math.sin(a) * (70 + Math.random() * 130) - 60,
        i % 3 === 0 ? '#ffffff' : '#ffd75e', 0.45);
    }
  }
  function spawnConfetti() {
    for (var i = 0; i < 100; i++) {
      spawnParticle(Math.random() * W, -20 - Math.random() * 200,
        (Math.random() - 0.5) * 60, 150 + Math.random() * 160,
        YL.PALETTE[Math.floor(Math.random() * YL.PALETTE.length)], 0.5, 4);
    }
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      if (p.t >= p.life || p.y > H + 40) {
        root.remove(p.m);
        particles.splice(i, 1);
        continue;
      }
      p.m.position.set(wx(p.x), wy(p.y), 2.2);
      var k = 1 - p.t / p.life;
      p.m.scale.setScalar(0.45 * Math.max(k, 0.05));
    }
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
    level = YL.generateLevel(levelNum);
    alive = level.grid.map(function (row) { return row.map(function () { return true; }); });
    cell = Math.min(BOARD.w / level.cols, BOARD.h / level.rows);
    boardX = W / 2 - level.cols * cell / 2;
    boardY = BOARD.y + (BOARD.h - level.rows * cell) / 2;
    pos = 0;

    // eski varlıkları temizle
    allSpools.slice().forEach(removeSpoolEntity);
    flyers.slice().forEach(function (f) { root.remove(f.g); });
    flyers = [];
    particles.slice().forEach(function (p) { root.remove(p.m); });
    particles = [];
    if (strandMesh) { root.remove(strandMesh); strandMesh = null; }
    tweens = [];

    trayCols = YL.buildTray(level).map(function (col, ci) {
      return col.map(function (b, ri) {
        var sp = makeSpoolEntity(b.color, b.cap, TRAY_X[ci], TRAY_Y + ri * 8, ri === 0 ? 0.8 : 0.55);
        sp.z = 1.2 - ri * 0.5;
        return sp;
      });
    });
    dock = [null, null, null, null, null];
    rider = null;
    railT = 0.62;
    stitchTimer = 0;
    won = false; failed = false;
    maxDockUsed = 0;
    stalledSince = 0;
    shakeT = 0;

    buildStatics();
    buildStitches();
    document.getElementById('level-label').textContent = 'Seviye ' + levelNum;
    document.getElementById('mistake-label').textContent = '';
    updateProgress();
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

  // ---------- overlay & hud ----------
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
  function updateProgress() {
    var total = level.stream.length;
    document.getElementById('progress-fill').style.width = (pos / total * 100) + '%';
    document.getElementById('progress-text').textContent = pos + ' / ' + total;
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
      colArr[0].shake = 1;
      sfx.blocked();
      return false;
    }
    var sp = colArr.shift();
    dock[slot] = sp;
    sp.slot = slot;
    sp.state = 'docking';
    sfx.dockIn();
    maxDockUsed = Math.max(maxDockUsed, dock.filter(Boolean).length);
    cancelTweens(sp);
    tween(sp, { x: DOCK_X[slot], y: DOCK_Y, scale: 0.9, z: 1.2 }, 0.42, easeOutBack, function () {
      sp.state = 'docked';
      tween(sp, { scale: 0.8 }, 0.15, easeOutCubic);
    });
    colArr.forEach(function (b, ri) {
      cancelTweens(b);
      tween(b, { y: TRAY_Y + ri * 8, scale: ri === 0 ? 0.8 : 0.55, z: 1.2 - ri * 0.5 }, 0.3, easeOutBack);
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

  // ---------- oyun akışı ----------
  function setRider(sp) {
    if (rider === sp) return;
    if (rider && rider.state === 'riding' && dock[rider.slot] === rider) {
      var old = rider;
      old.state = 'docking';
      cancelTweens(old);
      tween(old, { x: DOCK_X[old.slot], y: DOCK_Y, scale: 0.8, rot: 0, z: 1.2 }, 0.35, easeOutCubic, function () {
        old.state = 'docked';
      });
    }
    rider = sp;
    if (sp) {
      sp.state = 'toRail';
      var p = railPoint(railT);
      cancelTweens(sp);
      tween(sp, { x: p.x, y: p.y, scale: 0.95, z: 2.2 }, 0.35, easeOutBack, function () {
        sp.state = 'riding';
      });
    }
  }

  function completeSpool(sp) {
    dock[sp.slot] = null;
    if (rider === sp) rider = null;
    sp.state = 'completing';
    spawnSparkle(sp.x, sp.y);
    sfx.complete();
    cancelTweens(sp);
    tween(sp, { scale: sp.scale * 1.35, y: sp.y - 26 }, 0.18, easeOutCubic, function () {
      tween(sp, { scale: 0.0001, rot: 3.2, y: sp.y - 40 }, 0.4, easeInBack, function () {
        removeSpoolEntity(sp);
      });
    });
  }

  function update(dt) {
    now += dt;
    updateTweens(dt);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt * 2);

    if (!won && !failed) {
      if (pos >= level.stream.length) {
        won = true;
        sfx.win();
        spawnConfetti();
        setTimeout(function () { showOverlay(true); }, 800);
      } else {
        var spool = matchingDockSpool();
        if (spool) {
          stalledSince = 0;
          if (rider !== spool) setRider(spool);
          if (spool.state === 'riding') {
            stitchTimer += dt * 1000;
            while (stitchTimer >= STITCH_MS && pos < level.stream.length) {
              var st = level.stream[pos];
              if (st.color !== spool.color || spool.remaining === 0) break;
              stitchTimer -= STITCH_MS;
              alive[st.r][st.c] = false;
              hideStitch(st.c, st.r);
              spool.remaining--;
              pos++;
              updateProgress();
              sfx.stitch();
              spawnFlyer(st, spool);
              railT += 0.011;
              if (spool.remaining === 0) {
                completeSpool(spool);
                break;
              }
              if (pos < level.stream.length && level.stream[pos].color !== spool.color) break;
            }
            if (spool.state === 'riding') {
              var rp = railPoint(railT);
              spool.x += (rp.x - spool.x) * Math.min(dt * 8, 1);
              spool.y += (rp.y + Math.sin(now * 9) * 2 - spool.y) * Math.min(dt * 8, 1);
            }
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
      }
    }

    // ipucu: gereken tepsi makarası nabız atar
    var need = neededColor();
    var wantHint = !matchingDockSpool() && !won && !failed;
    trayCols.forEach(function (colArr) {
      if (colArr.length && colArr[0].state === 'tray') {
        var front = colArr[0];
        var isHint = wantHint && front.color === need;
        front.scale = isHint ? 0.8 + Math.sin(now * 6) * 0.06 : 0.8;
      }
    });

    allSpools.forEach(syncSpool);
    updateStrand();
    updateFlyers(dt);
    updateParticles(dt);

    // sarsıntı
    root.position.x = shakeT > 0 ? (Math.random() - 0.5) * 0.9 * shakeT : 0;
    root.position.y = shakeT > 0 ? (Math.random() - 0.5) * 0.9 * shakeT : 0;
  }

  function frame(ts) {
    var dt = Math.min((ts - lastTime) / 1000 || 0, 0.05);
    lastTime = ts;
    update(dt);
    renderer.render(scene, camera);
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
