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
  var BOARD = { x: 64, y: 100, w: 292, h: 330 };
  var RAIL_PAD = 26;
  var TRAY_Y = 634;
  var TRAY_X = [66, 138, 210, 282, 354];
  var STITCH_MS = 130;
  var MAX_TRACK = 5;      // rayda aynı anda en fazla makara
  var CONVOY_GAP = 0.085; // ray parametresinde makaralar arası boşluk
  var MAX_PENDING = 5;    // bekleme yuvası sayısı
  var PEND_X = [66, 138, 210, 282, 354];
  var PEND_Y = 494;
  var TRAY_TOP_Y = 574;   // tepsi üst sırası (görünür, dokunulamaz)
  var MAX_LEVEL = 100;

  // tepsi dizilimi: 0 = ön (alt) sıra dokunulabilir, 1 = üst sıra görünür,
  // 2+ üst sıranın arkasında küçülerek bekler
  function trayPosFor(ri) {
    if (ri === 0) return { y: TRAY_Y, scale: 0.8, z: 1.2 };
    if (ri === 1) return { y: TRAY_TOP_Y, scale: 0.72, z: 1.0 };
    return { y: TRAY_TOP_Y - (ri - 1) * 7, scale: 0.5, z: 0.7 - (ri - 2) * 0.2 };
  }

  var WS = 0.1; // dünya ölçeği: 1 mantık birimi = 0.1 dünya birimi
  function wx(x) { return (x - W / 2) * WS; }
  function wy(y) { return (H / 2 - y) * WS; }

  // ---------- durum ----------
  var level = null;
  var alive = null;
  var cell = 0, boardX = 0, boardY = 0;
  var pos = 0;
  var trayCols = null;
  var convoy = [];      // raydaki makaralar (biniş sırasıyla)
  var activeSpool = null; // şu an ip saran makara
  var railT = 0.62;
  var stitchTimer = 0;
  var won = false, failed = false;
  var maxDockUsed = 0;
  var stalledSince = 0;
  var shakeT = 0;
  var now = 0;
  var lastTime = 0;
  var combo = 0;          // kesintisiz sarılan ilmek sayısı
  var heartbeatT = 0;     // tehlike kalp atışı zamanlayıcısı
  var pending = [];       // bekleme yuvasındaki eşleşmemiş ilmekler
  var pendingDrainT = 0;  // bekleyenlerin makaraya akış zamanlayıcısı
  var flowStarted = false; // ilk makara binene dek ip akmaz
  var loadGen = 0;        // seviye nesli: eski zamanlayıcılar yeni seviyeye sızmasın

  // kalıcı istatistikler (profil + koleksiyon)
  var stats;
  try { stats = JSON.parse(localStorage.getItem('yarnloop.stats')) || {}; } catch (e) { stats = {}; }
  stats.maxLevel = stats.maxLevel || 1;
  stats.stitches = stats.stitches || 0;
  stats.spools = stats.spools || 0;
  stats.stars = stats.stars || 0;
  function saveStats() {
    localStorage.setItem('yarnloop.stats', JSON.stringify(stats));
  }

  // sona yaklaştıkça ve kombo sürdükçe sarma hızlanır
  function speedMult() {
    if (!level) return 1;
    var progress = pos / level.stream.length;
    return Math.min(1 + progress * 1.7 + Math.min(combo * 0.012, 0.5), 3.2);
  }
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
  scene.background = new THREE.Color(0xc08a5b); // sıcak ahşap
  scene.fog = new THREE.Fog(0xc08a5b, 120, 190);

  var camera = new THREE.PerspectiveCamera(40, W / H, 1, 300);
  camera.position.set(0, -3, 100);
  camera.lookAt(0, 0, 0);

  var root = new THREE.Group(); // sarsıntı/nabız için kök grup
  scene.add(root);

  scene.add(new THREE.AmbientLight(0xfff4e6, 0.55));
  var keyLight = new THREE.DirectionalLight(0xfff2e0, 0.95);
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
    new THREE.MeshStandardMaterial({ color: 0xcb955f, roughness: 0.9 })
  );
  wall.position.z = -2.4;
  wall.receiveShadow = true;
  root.add(wall);

  function resize() {
    var maxW = Math.min(window.innerWidth * 0.94, 420);
    var maxH = window.innerHeight - 205;
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
        color: new THREE.Color(hex), roughness: 0.38, metalness: 0.04
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
      mat('#7a4e2f', { roughness: 0.5 }) // koyu ahşap ray
    );
    railMesh.castShadow = true;
    staticGroup.add(railMesh);
    // ray vidaları
    var studGeo = new THREE.SphereGeometry(0.22, 8, 8);
    for (t = 0; t < 1; t += 0.05) {
      var sp = railPoint(t);
      var stud = new THREE.Mesh(studGeo, mat('#b98a5e', { roughness: 0.35, metalness: 0.3 }));
      stud.position.set(wx(sp.x), wy(sp.y), 2.0);
      staticGroup.add(stud);
    }

    // fiyonk süsü (makaraların bindiği nokta)
    var bow = new THREE.Group();
    var bowMat = mat('#ff7ad9', { roughness: 0.4 });
    [-1, 1].forEach(function (dir) {
      var wing = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 10), bowMat);
      wing.rotation.z = dir * Math.PI / 2;
      wing.position.x = dir * 1.1;
      bow.add(wing);
    });
    var knot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), mat('#ff4fa0', { roughness: 0.4 }));
    bow.add(knot);
    var bp = railPoint(0.635);
    bow.position.set(wx(bp.x), wy(bp.y), 2.4);
    bow.scale.setScalar(0.9);
    staticGroup.add(bow);

    // örgü zemini (krem pano)
    var back = new THREE.Mesh(
      new THREE.BoxGeometry((level.cols * cell + 14) * WS, (level.rows * cell + 14) * WS, 0.8),
      mat('#f7e8d2', { roughness: 0.85 })
    );
    back.position.set(wx(W / 2), wy(boardY + level.rows * cell / 2), -0.5);
    back.receiveShadow = true;
    staticGroup.add(back);

    // bekleme yuvaları: renk bulunamayan ilmekler buraya düşer
    PEND_X.forEach(function (x) {
      var slot = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 5.6, 0.7),
        mat('#a8815a', { roughness: 0.85 })
      );
      slot.position.set(wx(x), wy(PEND_Y), -0.35);
      slot.receiveShadow = true;
      staticGroup.add(slot);
      var inner = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 4.6, 0.4),
        mat('#f7e8d2', { roughness: 0.9 })
      );
      inner.position.set(wx(x), wy(PEND_Y), -0.1);
      staticGroup.add(inner);
    });

    // tepsi paneli (ahşap, iki sıra makara alır)
    var tray = new THREE.Mesh(
      new THREE.BoxGeometry((W - 48) * WS, 15.6, 1.2),
      mat('#8a5a36', { roughness: 0.8 })
    );
    tray.position.set(0, wy((TRAY_TOP_Y + TRAY_Y) / 2 + 4), -0.7);
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
    // basık, tombul, parlak makara: geniş taban + 2 kalın ip halkası +
    // parlak kubbe kapak (raptiye/yo-yo oranları, boy < en)
    var g = new THREE.Group();
    var body = mat(colorHex, { roughness: 0.22 });
    var light = mat(shade(colorHex, 0.18), { roughness: 0.2 });
    var dark = mat(shade(colorHex, -0.3), { roughness: 0.28 });

    // geniş taban diski (yuvarlatılmış kenar)
    var base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.62, 0.42, 26), dark);
    base.position.y = -1.05;
    base.castShadow = true;
    g.add(base);
    var baseRim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.17, 10, 26), dark);
    baseRim.rotation.x = Math.PI / 2;
    baseRim.position.y = -0.86;
    g.add(baseRim);

    // tombul ip gövdesi: iki kalın sarım halkası
    [[-0.45, body], [0.25, light]].forEach(function (r) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.62, 14, 28), r[1]);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = r[0];
      ring.castShadow = true;
      g.add(ring);
    });
    var core = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 20), body);
    core.position.y = -0.1;
    g.add(core);

    // kapak + parlak kubbe (spekülar parlama burada yakalanır)
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.4, 0.32, 26), dark);
    cap.position.y = 0.95;
    cap.castShadow = true;
    g.add(cap);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(1.18, 24, 16), mat(shade(colorHex, 0.12), { roughness: 0.14 }));
    dome.scale.set(1, 0.42, 1);
    dome.position.y = 1.08;
    dome.castShadow = true;
    g.add(dome);
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
      x: x, y: y, z: 1.2, scale: scale, rot: 0, shake: 0, state: 'tray',
      spinPhase: Math.random() * Math.PI * 2
    };
    sp.group = buildSpoolMesh(level.colors[colorIdx]);
    sp.badge = new THREE.Sprite(badgeSprite(cap, level.colors[colorIdx]));
    sp.badge.scale.set(2.7, 2.7, 1);
    sp.badge.position.y = 2.6;
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
    // raydaki TÜM makaralar döner; ip saran daha hızlı
    sp.group.rotation.y = (sp.state === 'riding' || sp.state === 'boarding')
      ? now * (sp === activeSpool ? 6 : 1.8) + (sp.spinPhase || 0)
      : 0;
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
    if (!activeSpool || pos >= level.stream.length) return;
    if (activeSpool.state !== 'riding') return;
    var st = level.stream[pos];
    var sx = boardX + st.c * cell + cell / 2;
    var sy = boardY + st.r * cell + cell / 2;
    var wob = Math.sin(now * 11) * 0.5;
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(wx(sx), wy(sy), 0.7),
      new THREE.Vector3((wx(sx) + wx(activeSpool.x)) / 2 + wob, (wy(sy) + wy(activeSpool.y)) / 2 - 1.6, 1.6),
      new THREE.Vector3(wx(activeSpool.x), wy(activeSpool.y) + 0.6, activeSpool.z)
    ]);
    strandMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.16, 6, false),
      mat(level.colors[activeSpool.color], { roughness: 0.45 })
    );
    root.add(strandMesh);
  }

  // ---------- bağlı makara ipleri ----------
  var linkMeshes = [];
  function updateLinks() {
    linkMeshes.forEach(function (m) { root.remove(m); m.geometry.dispose(); });
    linkMeshes = [];
    var byIdx = {};
    allSpools.forEach(function (sp) { if (sp.idx !== undefined) byIdx[sp.idx] = sp; });
    allSpools.forEach(function (sp) {
      if (sp.linkNext === undefined || sp.idx === undefined) return;
      var partner = byIdx[sp.linkNext];
      if (!partner) return;
      // ikisi de tepsideyken (ya da binerken) bağ görünür
      var visible = (sp.state === 'tray' || sp.state === 'boarding') &&
                    (partner.state === 'tray' || partner.state === 'boarding');
      if (!visible) return;
      // bağ yana kavis yapar ki üst üste duran çiftte de görünsün
      var sway = 2.6 + Math.sin(now * 3) * 0.3;
      var curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(wx(sp.x) + 1.0, wy(sp.y) + 0.6, sp.z + 0.8),
        new THREE.Vector3((wx(sp.x) + wx(partner.x)) / 2 + sway, (wy(sp.y) + wy(partner.y)) / 2, Math.max(sp.z, partner.z) + 1.4),
        new THREE.Vector3(wx(partner.x) + 1.0, wy(partner.y) + 0.6, partner.z + 0.8)
      ]);
      var m = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 12, 0.14, 6, false),
        mat(level.colors[sp.color], { roughness: 0.45 })
      );
      root.add(m);
      linkMeshes.push(m);
    });
  }

  // ---------- uçan ilmekler ----------
  var flyers = [];
  var flyerGeo = null;
  function spawnFlyerFrom(x0, y0, colorIdx, target) {
    var g = makeStitchGroup(colorIdx, 1);
    root.add(g);
    flyers.push({ g: g, t: 0, target: target, x0: x0, y0: y0 });
  }
  function spawnFlyer(st, target) {
    spawnFlyerFrom(boardX + st.c * cell + cell / 2, boardY + st.r * cell + cell / 2, st.color, target);
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

  // ---------- bekleme yuvası ilmekleri ----------
  function makeStitchGroup(colorIdx, scale) {
    var g = new THREE.Group();
    if (!flyerGeo) flyerGeo = new THREE.CapsuleGeometry(0.28, 1.1, 3, 8);
    [-0.35, 0.35].forEach(function (off, i) {
      var leg = new THREE.Mesh(flyerGeo, mat(level.colors[colorIdx]));
      leg.position.x = off;
      leg.rotation.z = i === 0 ? 0.42 : -0.42;
      leg.castShadow = true;
      g.add(leg);
    });
    g.scale.setScalar(scale || 1);
    return g;
  }

  function addPending(st) {
    var slot = pending.length;
    var g = makeStitchGroup(st.color, 1.4);
    g.position.set(wx(PEND_X[slot]), wy(PEND_Y), 1.2);
    root.add(g);
    pending.push({ color: st.color, g: g });
    relayoutPending();
  }

  function relayoutPending() {
    pending.forEach(function (p, i) {
      p.g.position.set(wx(PEND_X[i]), wy(PEND_Y), 1.2);
    });
  }

  // bekleyen ilmekler, raydaki uygun makaraya sırayla akar
  function drainPending(dt) {
    pendingDrainT += dt * 1000;
    if (pendingDrainT < 90) return;
    pendingDrainT = 0;
    for (var i = 0; i < pending.length; i++) {
      var p = pending[i];
      var spool = null;
      for (var c2 = 0; c2 < convoy.length; c2++) {
        if (convoy[c2].color === p.color && convoy[c2].remaining > 0 && convoy[c2].state === 'riding') {
          spool = convoy[c2];
          break;
        }
      }
      if (!spool) continue;
      var fromX = PEND_X[i];
      pending.splice(i, 1);
      root.remove(p.g);
      relayoutPending();
      spool.remaining--;
      stats.stitches++;
      sfx.stitch();
      spawnFlyerFrom(fromX, PEND_Y, p.color, spool);
      if (spool.remaining === 0) completeSpool(spool);
      break; // her seferde bir ilmek
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
    loadGen++;
    levelNum = Math.min(Math.max(1, n), MAX_LEVEL);
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
        var tp = trayPosFor(ri);
        var sp = makeSpoolEntity(b.color, b.cap, TRAY_X[ci], tp.y, tp.scale);
        sp.z = tp.z;
        sp.idx = b.idx;
        sp.linkNext = b.linkNext;
        return sp;
      });
    });
    combo = 0;
    heartbeatT = 0;
    pending.forEach(function (p) { root.remove(p.g); });
    pending = [];
    pendingDrainT = 0;
    flowStarted = false;
    convoy = [];
    activeSpool = null;
    railT = 0.62;
    stitchTimer = 0;
    won = false; failed = false;
    maxDockUsed = 0;
    stalledSince = 0;
    shakeT = 0;

    buildStatics();
    buildStitches();
    updateTrackChip();
    document.getElementById('level-label').textContent = 'Seviye ' + levelNum + ' / ' + MAX_LEVEL;
    document.getElementById('mistake-label').textContent = '';
    updateProgress();
    hideOverlay();
  }

  function neededColor() {
    return pos < level.stream.length ? level.stream[pos].color : -1;
  }
  function matchingTrackSpool() {
    var need = neededColor();
    if (need < 0) return null;
    for (var i = 0; i < convoy.length; i++) {
      if (convoy[i].color === need && convoy[i].remaining > 0 && convoy[i].state !== 'completing') return convoy[i];
    }
    return null;
  }
  function updateTrackChip(danger) {
    var el = document.getElementById('track-chip');
    if (!el) return;
    el.textContent = convoy.length + '/' + MAX_TRACK;
    el.className = danger ? 'danger' : (convoy.length >= MAX_TRACK ? 'full' : (convoy.length === MAX_TRACK - 1 ? 'warn' : ''));
  }
  function updateSpeedChip() {
    var el = document.getElementById('speed-chip');
    if (!el) return;
    var m = speedMult();
    if (m >= 1.4 && !won && !failed && activeSpool) {
      el.textContent = '⚡x' + m.toFixed(1);
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
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
    var finished = success && levelNum >= MAX_LEVEL;
    document.getElementById('overlay-title').textContent = finished
      ? '🏆 Hepsini Bitirdin!'
      : (success ? (stars() === 3 ? 'Mükemmel!' : 'Tebrikler!') : 'Tıkandın!');
    document.getElementById('overlay-sub').textContent = finished
      ? '100 seviyenin tamamını söktün — gerçek bir örgü ustasısın!'
      : (success
        ? 'Seviye ' + levelNum + ' tamamlandı — ' + level.name + ' söküldü'
        : 'Bekleme yuvaları taştı! Doğru renk makarayı zamanında raya bindir');
    document.getElementById('btn-next').style.display = (success && !finished) ? '' : 'none';
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
  function boardSpool(sp, delay) {
    convoy.push(sp);
    sp.state = 'boarding';
    maxDockUsed = Math.max(maxDockUsed, convoy.length);
    var p = railPoint(railT - CONVOY_GAP * (convoy.length - 1));
    var gen = loadGen;
    cancelTweens(sp);
    setTimeout(function () {
      if (gen !== loadGen) return;
      tween(sp, { x: p.x, y: p.y, scale: 0.92, z: 2.2 }, 0.45, easeOutBack, function () {
        sp.state = 'riding';
      });
    }, (delay || 0) * 1000);
  }

  function tapTray(colIdx) {
    if (won || failed) return false;
    var colArr = trayCols[colIdx];
    if (!colArr.length) return false;
    // zincir: öndeki makaraya bağlı olanlar da onunla birlikte biner
    var chainLen = 1;
    while (colArr[chainLen - 1] && colArr[chainLen] &&
           colArr[chainLen - 1].linkNext === colArr[chainLen].idx) chainLen++;
    if (convoy.length + chainLen > MAX_TRACK) {
      colArr[0].shake = 1;
      sfx.blocked();
      return false;
    }
    for (var k = 0; k < chainLen; k++) {
      boardSpool(colArr.shift(), k * 0.14);
    }
    flowStarted = true;
    sfx.dockIn();
    updateTrackChip();
    colArr.forEach(function (b, ri) {
      var tp = trayPosFor(ri);
      cancelTweens(b);
      tween(b, { y: tp.y, scale: tp.scale, z: tp.z }, 0.3, easeOutBack);
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

  // ---------- alt menü & paneller ----------
  var BADGES = [
    { lvl: 10, emoji: '🧶', name: 'İlk Yumak' },
    { lvl: 20, emoji: '🐤', name: 'Civciv Ustası' },
    { lvl: 30, emoji: '🌹', name: 'Gül Bahçesi' },
    { lvl: 40, emoji: '⭐', name: 'Yıldız Örücü' },
    { lvl: 50, emoji: '🍒', name: 'Kiraz Keyfi' },
    { lvl: 60, emoji: '🏠', name: 'Yuva Kurdu' },
    { lvl: 70, emoji: '🦄', name: 'Tek Boynuz' },
    { lvl: 80, emoji: '🐱', name: 'Kedi Sever' },
    { lvl: 90, emoji: '🌈', name: 'Gökkuşağı' },
    { lvl: 100, emoji: '👑', name: 'Örgü Kralı' },
    { lvl: 110, emoji: '🎀', name: 'Fiyonk Koleksiyoncusu' },
    { lvl: 120, emoji: '🏆', name: 'Efsane' }
  ];

  function renderProfile() {
    var el = document.getElementById('profile-body');
    var unlocked = BADGES.filter(function (b) { return stats.maxLevel >= b.lvl; }).length;
    el.innerHTML =
      '<div class="stat-row"><span>🏔️ En yüksek seviye</span><b>' + stats.maxLevel + '</b></div>' +
      '<div class="stat-row"><span>🧵 Sökülen ilmek</span><b>' + stats.stitches + '</b></div>' +
      '<div class="stat-row"><span>🧶 Biten makara</span><b>' + stats.spools + '</b></div>' +
      '<div class="stat-row"><span>⭐ Toplam yıldız</span><b>' + stats.stars + '</b></div>' +
      '<div class="stat-row"><span>🎁 Açılan rozet</span><b>' + unlocked + ' / ' + BADGES.length + '</b></div>';
  }

  function renderCollection() {
    var grid = document.getElementById('collection-grid');
    grid.innerHTML = '';
    BADGES.forEach(function (b) {
      var unlocked = stats.maxLevel >= b.lvl;
      var card = document.createElement('div');
      card.className = 'badge-card' + (unlocked ? '' : ' locked');
      card.innerHTML = '<span class="emoji">' + (unlocked ? b.emoji : '🔒') + '</span>' +
        '<span class="name">' + b.name + '</span>' +
        '<span class="lvl">Seviye ' + b.lvl + '</span>';
      grid.appendChild(card);
    });
  }

  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ensureAudio();
      document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var which = btn.getAttribute('data-panel');
      document.getElementById('panel-profile').classList.toggle('hidden', which !== 'profile');
      document.getElementById('panel-collection').classList.toggle('hidden', which !== 'collection');
      if (which === 'profile') renderProfile();
      if (which === 'collection') renderCollection();
    });
  });

  document.getElementById('btn-restart').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum); });
  document.getElementById('btn-prev').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum - 1); });
  document.getElementById('btn-next').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum + 1); });
  document.getElementById('btn-replay').addEventListener('click', function () { ensureAudio(); loadLevel(levelNum); });

  // ---------- oyun akışı ----------
  function completeSpool(sp) {
    convoy = convoy.filter(function (s) { return s !== sp; });
    if (activeSpool === sp) activeSpool = null;
    sp.state = 'completing';
    stats.spools++;
    updateTrackChip();
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
      if (pos >= level.stream.length && pending.length === 0) {
        won = true;
        sfx.win();
        spawnConfetti();
        stats.stars += stars();
        stats.maxLevel = Math.max(stats.maxLevel, levelNum + 1);
        saveStats();
        var gen = loadGen;
        setTimeout(function () { if (gen === loadGen) showOverlay(true); }, 800);
      } else if (flowStarted) {
        // KESİNTİSİZ AKIŞ: ip hep sökülür. Sıradaki ilmeğin renginde
        // makara raydaysa ona sarılır; yoksa bekleme yuvasına düşer.
        // Yuvalar taşarsa yanarsın.
        var spool = matchingTrackSpool();
        activeSpool = spool && spool.state === 'riding' ? spool : null;

        stitchTimer += dt * 1000;
        var ms = STITCH_MS / speedMult();
        while (stitchTimer >= ms && pos < level.stream.length && !failed) {
          var st = level.stream[pos];
          var winder = null;
          for (var ci = 0; ci < convoy.length; ci++) {
            if (convoy[ci].color === st.color && convoy[ci].remaining > 0 && convoy[ci].state === 'riding') {
              winder = convoy[ci];
              break;
            }
          }
          stitchTimer -= ms;
          if (winder) {
            alive[st.r][st.c] = false;
            hideStitch(st.c, st.r);
            winder.remaining--;
            pos++;
            combo++;
            stats.stitches++;
            sfx.stitch();
            spawnFlyer(st, winder);
            railT += 0.011;
            if (winder.remaining === 0) completeSpool(winder);
          } else {
            // renk rayda yok → ilmek bekleme yuvasına
            if (pending.length >= MAX_PENDING) {
              failed = true;
              shakeT = 1;
              sfx.fail();
              saveStats();
              var fgen = loadGen;
              setTimeout(function () { if (fgen === loadGen) showOverlay(false); }, 500);
              break;
            }
            alive[st.r][st.c] = false;
            hideStitch(st.c, st.r);
            pos++;
            combo = 0;
            addPending(st);
            beep(260, 180, 0.1, 'sine', 0.12);
          }
          updateProgress();
          ms = STITCH_MS / speedMult();
        }

        drainPending(dt);

        // tehlike: yuvalar dolmaya yakınken kalp atışı
        if (pending.length >= MAX_PENDING - 1) {
          heartbeatT += dt;
          if (heartbeatT > 0.6) {
            heartbeatT = 0;
            beep(110, 90, 0.12, 'sine', 0.25);
            shakeT = Math.max(shakeT, 0.2);
          }
        }
      }
    }

    // konvoy bandı sürekli akar (sarma ilerledikçe ekstra hızlanır)
    if (!won && !failed && convoy.length) railT += dt * 0.012;

    // konvoy: raydaki tüm makaralar birlikte ilerler
    convoy.forEach(function (sp, i) {
      if (sp.state !== 'riding') return;
      var p = railPoint(railT - CONVOY_GAP * i);
      var bob = sp === activeSpool ? Math.sin(now * 9) * 2 : 0;
      sp.x += (p.x - sp.x) * Math.min(dt * 8, 1);
      sp.y += (p.y + bob - sp.y) * Math.min(dt * 8, 1);
    });

    // ipucu: yakında gerekecek (sıradaki + bekleyen) renklerin tepsi
    // makarası, rayda karşılığı yoksa nabız atar
    if (!won && !failed) {
      var hintColors = {};
      var nc = neededColor();
      if (nc >= 0) hintColors[nc] = true;
      pending.forEach(function (p) { hintColors[p.color] = true; });
      convoy.forEach(function (sp) {
        if (sp.remaining > 0) delete hintColors[sp.color];
      });
      trayCols.forEach(function (colArr) {
        if (colArr.length && colArr[0].state === 'tray') {
          var front = colArr[0];
          front.scale = hintColors[front.color] ? 0.8 + Math.sin(now * 6) * 0.06 : 0.8;
        }
      });
    }

    allSpools.forEach(syncSpool);
    updateStrand();
    updateLinks();
    updateFlyers(dt);
    updateParticles(dt);
    updateTrackChip(pending.length >= MAX_PENDING - 1);
    updateSpeedChip();

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
    getConvoy: function () { return convoy; },
    getPending: function () { return pending; },
    isFlowStarted: function () { return flowStarted; },
    getTray: function () { return trayCols; },
    neededColor: neededColor,
    tapTray: tapTray,
    isWon: function () { return won; },
    isFailed: function () { return failed; },
    isFlowing: function () { return !!matchingTrackSpool(); },
    loadLevel: loadLevel
  };

  loadLevel(levelNum);
  requestAnimationFrame(frame);
})();
