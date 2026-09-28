(function () {
  'use strict';
  // ======================= 中世纪黄昏集市广场 ==========================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  // ------------------------- textures ---------------------------------
  function cobbleCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var gx = Math.floor(x / 16), gy = Math.floor(y / 16);
      var ox = (gy & 1) * 8;
      var lx = (x + ox) % 16, ly = y % 16;
      var cx = (x + ox - 8) % 16, cy = ly - 8;
      var d = Math.sqrt(cx * cx + cy * cy);
      var id = hash2(gx * 3 + Math.floor((x + ox) / 16), gy);
      var base = 108 + id * 34;
      var r = base, g = base * 0.99, b = base * 0.94;
      var n = vnoise(x / 7, y / 7, 9, 2);
      r *= 0.86 + n * 0.28; g *= 0.86 + n * 0.28; b *= 0.86 + n * 0.28;
      if (d > 7.2) { r = 58 + id * 14; g = 55 + id * 13; b = 52 + id * 12; }   // mortar
      if (d > 6.4 && d <= 7.2) { r *= 0.7; g *= 0.7; b *= 0.7; }
      var sp = hash2(x + 31, y + 7);
      if (sp < 0.06) { r *= 0.75; g *= 0.75; b *= 0.75; }
      return [r, g, b];
    });
  }
  function plasterCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 7, 3);
      var r = 196 + n * 26, g = 178 + n * 24, b = 148 + n * 20;
      var stain = vnoise(x / 16 + 4, y / 30, 4, 2);
      if (stain > 0.66) { var k = (stain - 0.66) * 1.6; r *= 1 - k * 0.45; g *= 1 - k * 0.45; b *= 1 - k * 0.42; }
      var sp = hash2(x + 2, y + 51);
      if (sp < 0.05) { r *= 0.85; g *= 0.85; b *= 0.85; }
      return [r, g, b];
    });
  }
  function beamCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var grain = vnoise(x / 4, y / 26, 8, 2);
      var r = 66 * (0.85 + grain * 0.3), g = 48 * (0.85 + grain * 0.3), b = 34 * (0.85 + grain * 0.3);
      if (x % 19 < 1) { r *= 0.6; g *= 0.6; b *= 0.6; }
      var sp = hash2(x + 9, y + 4);
      if (sp < 0.08) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }
  function stripeCanvas(cr, cg, cb) {
    return pixelLoop(newCanvas(64), function (x, y) {
      var stripe = Math.floor(x / 11) % 2 === 0;
      var r = stripe ? cr : 236, g = stripe ? cg : 228, b = stripe ? cb : 218;
      var n = vnoise(x / 12, y / 12, 5, 2);
      r *= 0.92 + n * 0.16; g *= 0.92 + n * 0.16; b *= 0.92 + n * 0.16;
      if (y < 2) { r *= 0.5; g *= 0.5; b *= 0.5; }
      var sp = hash2(x, y + 13);
      if (sp < 0.05) { r *= 0.82; g *= 0.82; b *= 0.82; }
      return [r, g, b];
    });
  }
  function stoneCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 8, 2);
      var r = 118 * (0.88 + n * 0.24), g = 114 * (0.88 + n * 0.24), b = 106 * (0.88 + n * 0.24);
      var sp = hash2(x + 21, y + 8);
      if (sp < 0.09) { r *= 0.84; g *= 0.84; b *= 0.84; }
      var moss = vnoise(x / 18, y / 18, 3, 2);
      if (moss > 0.70) { var k = (moss - 0.70) * 2; r *= 1 - k * 0.45; g *= 1 - k * 0.1; b *= 1 - k * 0.45; }
      return [r, g, b];
    });
  }
  function waterCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var r = 38, g = 80, b = 84;
      var w1 = Math.sin((x + Math.sin(y * 0.35) * 5) * 0.4);
      var w2 = Math.sin((y + Math.sin(x * 0.3) * 6) * 0.3 + 1.4);
      var k = 0.82 + 0.18 * w1 + 0.16 * w2;
      r *= k; g *= k; b *= k;
      if (w1 > 0.9 && w2 > 0.5) { r += 115; g += 128; b += 120; }
      return [r, g, b];
    });
  }
  function sackCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 5, y / 5, 8, 2);
      var r = 148 * (0.85 + n * 0.3), g = 120 * (0.85 + n * 0.3), b = 84 * (0.85 + n * 0.3);
      if ((x + y * 2) % 13 < 1) { r *= 0.8; g *= 0.8; b *= 0.8; }   // weave
      return [r, g, b];
    });
  }
  function shingleCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var col = Math.floor(x / 9), cx = x - col * 9;
      var row = Math.floor(y / 13), ry = y - row * 13;
      var tint = (hash2(col * 2, row * 3) * 2 - 1) * 10;
      var r = 88 + tint, g = 60 + tint, b = 44 + tint;
      if (ry < 1 || cx < 1) { r *= 0.45; g *= 0.45; b *= 0.45; }
      if (ry === 1) { r *= 1.35; g *= 1.3; b *= 1.25; }
      var moss = vnoise(x / 15, y / 15, 4, 2);
      if (moss > 0.74) { var k = (moss - 0.74) * 2; r *= 1 - k * 0.4; g *= 1 - k * 0.05; b *= 1 - k * 0.35; }
      return [r, g, b];
    });
  }
  function bannerCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var r = 148, g = 26, b = 26;
      if (y > 22 && y < 34) { r = 210; g = 168; b = 40; }              // heraldic band
      if (y > 25 && y < 31 && x > 24 && x < 40) { r = 148; g = 26; b = 26; }   // simple emblem block
      var n = vnoise(x / 10, y / 10, 5, 2);
      r *= 0.9 + n * 0.2; g *= 0.9 + n * 0.2; b *= 0.9 + n * 0.2;
      if (y < 2) { r *= 0.4; g *= 0.4; b *= 0.4; }
      if (y > 60) { var k2 = (y - 60) / 4; r *= 1 - k2; g *= 1 - k2; b *= 1 - k2; }  // swallow-tail fade
      return [r, g, b];
    });
  }

  var cobbleTex = texFrom(cobbleCanvas());
  var plasterTex = texFrom(plasterCanvas());
  var beamTex = texFrom(beamCanvas());
  var awnRedTex = texFrom(stripeCanvas(205, 52, 44));
  var awnGreenTex = texFrom(stripeCanvas(72, 132, 80));
  var stoneTex = texFrom(stoneCanvas());
  var waterTex = texFrom(waterCanvas());
  var sackTex = texFrom(sackCanvas());
  var shingleTex = texFrom(shingleCanvas());
  var bannerTex = texFrom(bannerCanvas());

  var matCobble = ps1Material(cobbleTex);
  var matPlaster = ps1Material(plasterTex);
  var matBeam = ps1Material(beamTex);
  var matAwnRed = ps1Material(awnRedTex);
  var matAwnGreen = ps1Material(awnGreenTex);
  var matStone = ps1Material(stoneTex);
  var matWater = ps1Material(waterTex);
  var matSack = ps1Material(sackTex);
  var matShingle = ps1Material(shingleTex);
  var matBanner = ps1Material(bannerTex);
  var matBread = ps1Material(PS1.solidTexture(196, 148, 82));
  var matFruitR = ps1Material(PS1.solidTexture(188, 60, 44));
  var matFruitG = ps1Material(PS1.solidTexture(160, 160, 54));
  var matPot = ps1Material(PS1.solidTexture(150, 96, 62));
  var matClothB = ps1Material(PS1.solidTexture(70, 90, 140));
  var matClothY = ps1Material(PS1.solidTexture(190, 160, 70));
  var matPigeon = ps1Material(PS1.solidTexture(120, 118, 126));
  var matHay = ps1Material(PS1.solidTexture(200, 170, 80));

  // ------------------------- lighting ---------------------------------
  var SUN = new THREE.Vector3(0.62, 0.52, 0.28).normalize();   // higher sun: shorter shadows, brighter square
  var SUN_COL = [1.26, 1.00, 0.70];
  var SKY_AMB = [0.38, 0.35, 0.38];
  var GND_AMB = [0.28, 0.22, 0.18];
  var marketRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = SUN_COL[0] * ndl * 1.02 + GND_AMB[0] + (SKY_AMB[0] - GND_AMB[0]) * hemi;
    var g = SUN_COL[1] * ndl * 1.02 + GND_AMB[1] + (SKY_AMB[1] - GND_AMB[1]) * hemi;
    var b = SUN_COL[2] * ndl * 1.02 + GND_AMB[2] + (SKY_AMB[2] - GND_AMB[2]) * hemi;
    return [Math.min(1.2, r), Math.min(1.16, g), Math.min(1.12, b)];
  };

  PS1.registerScene(function () {
    setRelight(marketRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var sun = new THREE.DirectionalLight(0xffddaa, 1);
    sun.position.copy(SUN).multiplyScalar(32);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 75;
    sun.shadow.camera.left = -21; sun.shadow.camera.right = 21;
    sun.shadow.camera.top = 21; sun.shadow.camera.bottom = -21;
    sun.shadow.bias = -0.004; sun.shadow.normalBias = 0.05;
    scene.add(sun); scene.add(sun.target);

    scene.add(PS1.makeSky({
      top: [0.24, 0.29, 0.50], horizon: [0.99, 0.61, 0.28], bottom: [0.16, 0.11, 0.10],
      sunDir: SUN.toArray(), sunCol: [1.3, 0.95, 0.55], sunCut: 0.9978, sunGlow: 0.45,
      radius: 90
    }));

    // square ground
    scene.add(PS1.groundGrid(matCobble, 0, 0, 34, 34, 11, 1, 0, 1));

    // ---------------- central fountain ---------------------------------
    scene.add(cs(prismMesh(matStone, 0, 0, 2.3, 0.62, 8, 4, 0.8)));
    scene.add(prismMesh(matStone, 0, 0, 2.05, 0.10, 8, 4, 0.4, null, 0.08));   // inner lip
    scene.add(PS1.groundGrid(matWater, 0, 0, 2.9, 2.9, 2, 0.6, 0.68, 1));   // brimming: 6cm above the solid basin top (was buried inside it)
    scene.add(cs(prismMesh(matStone, 0, 0, 0.26, 1.25, 8, 1.5, 1.6, null, 0.5)));
    scene.add(cs(prismMesh(matStone, 0, 0, 0.95, 0.30, 8, 2.4, 0.5, null, 1.6)));
    scene.add(cs(prismMesh(matWater, 0, 0, 0.16, 0.85, 8, 1.2, 1.4, null, 0.72))); // falling sheet
    scene.add(cs(prismMesh(matStone, 0, 0, 0.16, 0.30, 6, 1, 0.5, null, 1.9)));
    colliders.push({ x0: -2.4, z0: -2.4, x1: 2.4, z1: 2.4 });
    decals.oct(0, 0, 2.9, PS1.decalMaterial(0.16, 0.14, 0.11, 0.4), 0.006, 70);  // wet ring

    // ---------------- market stalls ------------------------------------
    var banners = [];
    function stall(x, z, rot, awn, goods) {
      var g = new THREE.Group();
      // 4 posts + counter + back panel
      [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]].forEach(function (p) {
        g.add(cs(boxMesh(matBeam, x + p[0], 1.15, z + p[1], 0.12, 2.3, 0.12, 2)));
      });
      g.add(cs(boxMesh(matBeam, x, 0.88, z, 2.5, 0.09, 1.55, 1.2)));
      g.add(cs(boxMesh(matBeam, x, 1.35, z - 0.72, 2.4, 1.0, 0.08, 1.2)));
      // sloped striped awning (high at back, low at front)
      g.add(cs(quadCorners(awn,
        [x - 1.45, 2.35, z - 0.85], [x + 1.45, 2.35, z - 0.85],
        [x + 1.45, 2.05, z + 1.05], [x - 1.45, 2.05, z + 1.05], 1.8, 2)));
      goods(g, x, z);
      scene.add(g);
      colliders.push({ x0: x - 1.35, z0: z - 0.9, x1: x + 1.35, z1: z + 0.9 });
      decals.rect(x, z, 2.9, 2.1, PS1.blobMat, 0.012);
    }
    // bread stall (W)
    stall(-5.6, -1.2, 0, matAwnRed, function (g, x, z) {
      for (var i = 0; i < 5; i++) {
        g.add(blobMesh(matBread, x - 0.9 + i * 0.45, 1.02, z + 0.1 + (i % 2) * 0.3, 0.16, 0.7, 0.3, function () { return [1, 0.86, 0.6]; }));
      }
    });
    // fruit stall (E)
    stall(5.6, -1.4, 0, matAwnGreen, function (g, x, z) {
      g.add(boxMesh(matBeam, x - 0.6, 1.0, z, 0.7, 0.16, 0.6, 1.5));
      g.add(boxMesh(matBeam, x + 0.6, 1.0, z, 0.7, 0.16, 0.6, 1.5));
      for (var i = 0; i < 7; i++) {
        var m = i % 2 ? matFruitR : matFruitG;
        g.add(blobMesh(m, x - 0.85 + i * 0.28, 1.12, z + (i % 3) * 0.16 - 0.16, 0.10, 0.9, 0.25, function () { return [1, 1, 1]; }));
      }
    });
    // pottery stall (NW)
    stall(-4.6, 5.8, 0, matAwnGreen, function (g, x, z) {
      for (var i = 0; i < 4; i++) {
        g.add(prismMesh(matPot, x - 0.75 + i * 0.5, z - 0.1 + (i % 2) * 0.4, 0.14, 0.24 + (i % 2) * 0.08, 7, 1.6, 0.8, null, 0.93));
      }
    });
    // fabric stall (SE)
    stall(4.8, 5.6, 0, matAwnRed, function (g, x, z) {
      g.add(boxMesh(matBeam, x, 1.02, z, 2.1, 0.12, 0.7, 1.5));
      [[-0.7, matClothB], [0, matClothY], [0.7, matClothB]].forEach(function (r, i) {
        var roll = prismMesh(r[1], 0, 0, 0.11, 0.95, 6, 1.2, 0.6, null, 0);  // geometry at origin
        roll.position.set(x + r[0], 1.16, z);
        roll.rotation.z = Math.PI / 2;
        roll.rotation.y = i * 0.12;
        g.add(roll);
      });
    });

    // ---------------- half-timber houses -------------------------------
    // Built directly in world coords for a given facing (no group rotation:
    // vertex-light baking bakes world positions into geometry).
    var matGlass = ps1Material(PS1.solidTexture(26, 28, 36));
    function timberHouse(cx, cz, w, d, front) {
      // front: '+z' | '-z' | '+x' | '-x'; w along side axis, d along front axis
      var F = front === '+z' ? [0, 1] : front === '-z' ? [0, -1] : front === '+x' ? [1, 0] : [-1, 0];
      var S = [F[1], -F[0]];
      var alongX = F[0] !== 0;                    // front runs along x?
      function P(lx, lz) { return [cx + S[0] * lx + F[0] * lz, cz + S[1] * lx + F[1] * lz]; }
      function PW(lx, lz, y) { var p = P(lx, lz); return [p[0], y, p[1]]; }
      function obox(mat, lx, y, lz, lw, lh, ld, uvScale, rotZ, emissive) {
        var p = P(lx, lz);
        return boxMesh(mat, p[0], y, p[1], alongX ? ld : lw, lh, alongX ? lw : ld, uvScale, rotZ, emissive);
      }
      var H1 = 2.6, H2 = 2.5;
      scene.add(cs(obox(matPlaster, 0, H1 / 2, 0, w, H1, d, 1)));
      scene.add(cs(obox(matPlaster, 0, H1 + H2 / 2, 0.35, w + 0.6, H2, d + 0.5, 1)));   // jettied upper floor
      // corner posts
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        scene.add(obox(matBeam, s[0] * w / 2, H1 / 2, s[1] * d / 2, 0.16, H1, 0.16, 2));
        scene.add(obox(matBeam, s[0] * (w / 2 + 0.3), H1 + H2 / 2, 0.35 + s[1] * (d / 2 + 0.25), 0.16, H2, 0.16, 2));
      });
      // floor bands on the front face
      scene.add(obox(matBeam, 0, H1 - 0.08, d / 2, w, 0.16, 0.10, 2));
      scene.add(obox(matBeam, 0, H1 + H2 - 0.08, 0.35 + (d + 0.5) / 2, w + 0.6, 0.16, 0.10, 2));
      // diagonal braces (z-facing houses only; rotZ is a z-axis rotation)
      if (!alongX) {
        scene.add(obox(matBeam, -w * 0.22, H1 / 2, d / 2, 0.12, H1 * 1.1, 0.08, 2, 0.5));
        scene.add(obox(matBeam, w * 0.22, H1 / 2, d / 2, 0.12, H1 * 1.1, 0.08, 2, -0.5));
      }
      // door + windows
      scene.add(obox(matBeam, -w * 0.22, 1.05, d / 2 + 0.02, 0.9, 2.0, 0.1, 2));
      scene.add(obox(matGlass, w * 0.18, 1.7, d / 2 + 0.06, 0.62, 0.66, 0.06, 2));
      scene.add(obox(matBeam, w * 0.18, 1.7, d / 2 + 0.11, 0.7, 0.74, 0.03, 2));
      scene.add(obox(matGlass, -0.5, H1 + 1.2, 0.35 + (d + 0.5) / 2 + 0.06, 0.62, 0.7, 0.06, 2));
      scene.add(obox(matGlass, 0.5, H1 + 1.2, 0.35 + (d + 0.5) / 2 + 0.06, 0.62, 0.7, 0.06, 2));
      // steep gable roof, ridge along the side axis
      var rh = 2.1, eaveY = H1 + H2 + 0.05, ridgeY = H1 + H2 + rh;
      var eaveF = 0.35 + (d + 0.5) / 2 + 0.35, eaveB = -(d + 0.5) / 2 - 0.35, ridgeZ = 0.35;
      scene.add(cs(quadCorners(matShingle,
        PW(-w / 2 - 0.75, eaveF, eaveY), PW(w / 2 + 0.75, eaveF, eaveY),
        PW(w / 2 + 0.35, ridgeZ, ridgeY), PW(-w / 2 - 0.35, ridgeZ, ridgeY), d * 0.6, w * 0.7)));
      scene.add(cs(quadCorners(matShingle,
        PW(-w / 2 - 0.75, eaveB, eaveY), PW(w / 2 + 0.75, eaveB, eaveY),
        PW(w / 2 + 0.35, ridgeZ, ridgeY), PW(-w / 2 - 0.35, ridgeZ, ridgeY), d * 0.6, w * 0.7)));
      // chimney
      scene.add(cs(obox(matStone, w * 0.22, H1 + H2 + 1.7, 0, 0.5, 2.4, 0.5, 1.4)));
      // collider
      var fw = alongX ? d : w, fd = alongX ? w : d;
      colliders.push({ x0: cx - fw / 2 - 0.6, z0: cz - fd / 2 - 0.6, x1: cx + fw / 2 + 0.6, z1: cz + fd / 2 + 0.6 });
    }

    timberHouse(-4.5, -13.8, 7.5, 5.6, '+z');   // N-W
    timberHouse(5.5, -14.2, 7.0, 5.4, '+z');    // N-E
    timberHouse(-16.2, -4.5, 5.6, 6.6, '+x');   // W
    timberHouse(16.2, 4.0, 5.6, 6.6, '-x');     // E
    timberHouse(-8.6, 14.2, 6.4, 5.2, '-z');    // S-W (entrance gap at x 0)
    timberHouse(8.6, 14.2, 6.4, 5.2, '-z');     // S-E

    // ---------------- cart + barrels + sacks + hay ----------------------
    (function () {
      var cx = 6.0, cz = 3.0;
      scene.add(cs(boxMesh(matBeam, cx, 0.75, cz, 1.5, 0.14, 2.6, 1.5)));
      scene.add(cs(boxMesh(matBeam, cx, 0.95, cz - 1.25, 1.5, 0.4, 0.1, 1.5)));
      scene.add(cs(boxMesh(matBeam, cx, 0.95, cz + 1.25, 1.5, 0.4, 0.1, 1.5)));
      scene.add(boxMesh(matBeam, cx - 0.75, 0.72, cz + 1.9, 0.1, 0.1, 1.3, 2));
      [[-0.8, 0.0], [0.8, 0.0]].forEach(function (w) {
        var wheel = prismMesh(matBeam, 0, 0, 0.55, 0.12, 8, 2.4, 0.5, null, 0);  // geometry at origin
        wheel.position.set(cx + w[0], 0.55, cz);
        wheel.rotation.z = Math.PI / 2;
        scene.add(cs(wheel));
      });
      colliders.push({ x0: cx - 1.0, z0: cz - 1.5, x1: cx + 1.0, z1: cz + 2.3 });
    })();
    function barrel(x, z) {
      scene.add(cs(prismMesh(matBeam, x, z, 0.34, 0.9, 8, 2, 1)));
      scene.add(prismMesh(matBeam, x, z, 0.37, 0.08, 8, 2, 0.2, null, 0.18));
      scene.add(prismMesh(matBeam, x, z, 0.37, 0.08, 8, 2, 0.2, null, 0.64));
      colliders.push({ x0: x - 0.4, z0: z - 0.4, x1: x + 0.4, z1: z + 0.4 });
    }
    barrel(-7.4, -6.8); barrel(-6.6, -7.5); barrel(-7.2, 9.8); barrel(9.4, 8.6); barrel(10.1, 8.0);
    // sacks
    [[-6.2, -7.0], [5.9, -2.6], [6.5, -3.1]].forEach(function (p) {
      scene.add(blobMesh(matSack, p[0], 0.30, p[1], 0.34, 1.0, 0.25, function () { return [1, 0.96, 0.86]; }));
    });
    // hay pile by the cart
    scene.add(blobMesh(matHay, 10.4, 0.55, -9.0, 0.95, 0.65, 0.45, function (sd) { return sd > 0.5 ? [1, 0.9, 0.55] : [0.95, 0.82, 0.5]; }));

    // ---------------- banner poles at the south entrance ----------------
    function bannerPole(x, z) {
      scene.add(cs(prismMesh(matBeam, x, z, 0.08, 3.6, 6, 1, 4)));
      scene.add(cs(boxMesh(matBeam, x, 3.55, z, 0.75, 0.08, 0.08, 2)));
      var pivot = new THREE.Group();
      pivot.position.set(x + 0.35, 3.5, z);
      var b = cs(quadCorners(matBanner, [0, 0, -0.35], [0, 0, 0.35], [0, -1.5, 0.35], [0, -1.5, -0.35], 1, 2.2));
      pivot.add(b);
      scene.add(pivot);
      banners.push(pivot);
      colliders.push({ x0: x - 0.15, z0: z - 0.15, x1: x + 0.15, z1: z + 0.15 });
    }
    bannerPole(-2.6, 11.6); bannerPole(2.6, 11.6);

    // bunting line between the poles
    (function () {
      var cols = [matAwnRed, matAwnGreen, matClothY];
      for (var i = 0; i < 14; i++) {
        var t = i / 13;
        var x = -2.6 + t * 5.2;
        var y = 3.5 - Math.sin(Math.PI * t) * 0.55;
        var tri = quadCorners(cols[i % 3], [x - 0.09, y, 0], [x + 0.09, y, 0], [x + 0.02, y - 0.26, 0], [x - 0.02, y - 0.26, 0], 0.5, 0.8);
        tri.position.z = 11.6;
        scene.add(tri);
      }
    })();

    // ---------------- pigeons -------------------------------------------
    var pigeons = [];
    [[3.2, 2.6], [-2.8, 3.1], [1.2, -3.0], [6.4, 2.2]].forEach(function (p, i) {
      var g = new THREE.Group();
      g.add(blobMesh(matPigeon, p[0], 0.16, p[1], 0.10, 0.85, 0.2, function () { return [1, 1, 1]; }));
      g.add(boxMesh(matPigeon, p[0], 0.20, p[1], 0.10, 0.07, 0.10, 2));
      g.userData = { ph: i * 1.7 };
      scene.add(g); pigeons.push(g);
    });



    // ---------------- v7 atmosphere + props -----------------------------
    // fire braziers with living flame (steam-mode particles in orange)
    var braziers = [];
    var matCoal = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 150, 60)));
    var matIron7 = ps1Material(PS1.solidTexture(54, 56, 62));
    function brazier(x, z) {
      [[-0.22, -0.13], [0.22, -0.13], [0, 0.26]].forEach(function (l) {
        scene.add(cs(boxMesh(matIron7, x + l[0], 0.3, z + l[1], 0.06, 0.6, 0.06, 2, l[0] * 1.2)));
      });
      scene.add(cs(prismMesh(matIron7, x, z, 0.30, 0.22, 7, 1.8, 0.5, null, 0.58)));
      scene.add(boxMesh(matCoal, x, 0.82, z, 0.36, 0.08, 0.36, 2, 0, [1.6, 0.8, 0.25]));
      var flame = PS1.makeParticles({
        mode: 'steam', count: 42, color: [1.0, 0.55, 0.16],
        size: 0.045, speed: 1.5, sway: 0.1,
        area: [x - 0.16, x + 0.16, z - 0.16, z + 0.16, 0.85]
      });
      scene.add(flame);
      braziers.push(flame);
      colliders.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35 });
    }
    brazier(-3.2, 1.9); brazier(3.8, -0.9);
    // hanging shop sign on the NW house (bracket + carved board)
    scene.add(cs(boxMesh(matBeam, -4.5, 3.4, -11.4, 0.85, 0.08, 0.08, 2)));
    scene.add(boxMesh(matBeam, -4.15, 3.05, -11.4, 0.06, 0.6, 0.5, 2));
    // spice sacks hanging on the stall backs
    [[-0.9, 2.0, 1], [0, 2.15, 2], [0.8, 2.0, 3]].forEach(function (sp) {
      var cols = [[188, 120, 50], [160, 60, 40], [90, 120, 60]];
      var m = ps1Material(PS1.solidTexture(cols[sp[2] - 1][0], cols[sp[2] - 1][1], cols[sp[2] - 1][2]));
      scene.add(PS1.blobMesh(m, -5.6 + sp[0], sp[1], -1.85, 0.13, 1.15, 0.25, function () { return [1.05, 1.0, 0.95]; }));
    });
    // sleeping dog by the bread stall
    (function () {
      var matDog = ps1Material(PS1.solidTexture(96, 66, 44));
      scene.add(PS1.blobMesh(matDog, -5.05, 0.16, -0.2, 0.24, 0.62, 0.3, function () { return [1, 0.95, 0.9]; }));
      scene.add(boxMesh(matDog, -5.3, 0.16, -0.1, 0.16, 0.14, 0.2, 2));
      scene.add(boxMesh(matDog, -5.36, 0.35, -0.05, 0.04, 0.24, 0.04, 2, 0.7));
    })();
    // chicken coop + ramp
    scene.add(PS1.blobMesh(matSack, 7.9, 0.35, 8.1, 0.45, 0.8, 0.35, function () { return [0.95, 0.9, 0.8]; }));
    scene.add(boxMesh(matBeam, 7.35, 0.09, 8.1, 0.7, 0.06, 0.18, 2, 0.25));
    // wheelbarrow
    (function () {
      var wx = -8.9, wz = 8.4;
      var wheel = prismMesh(matBeam, 0, 0, 0.32, 0.09, 8, 1.4, 0.4, null, 0);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.32, wz);
      scene.add(cs(wheel));
      scene.add(cs(boxMesh(matBeam, wx + 0.35, 0.42, wz, 0.65, 0.4, 0.55, 1.4, 0.12)));
      scene.add(boxMesh(matBeam, wx - 0.5, 0.42, wz - 0.18, 0.9, 0.06, 0.06, 2, 0.1));
      scene.add(boxMesh(matBeam, wx - 0.5, 0.42, wz + 0.18, 0.9, 0.06, 0.06, 2, 0.1));
      colliders.push({ x0: wx - 0.6, z0: wz - 0.45, x1: wx + 0.7, z1: wz + 0.45 });
    })();
    // flour sacks by the bread stall
    [[-6.5, 0.6], [-6.9, 0.9]].forEach(function (p) {
      scene.add(blobMesh(ps1Material(PS1.solidTexture(232, 228, 218)), p[0], 0.26, p[1], 0.3, 1.0, 0.25, function () { return [1, 1, 0.98]; }));
    });
    // bell on the NE house gable
    (function () {
      scene.add(boxMesh(matBeam, 5.5, 7.0, -14.2, 0.5, 0.35, 0.5, 1.4));
      scene.add(prismMesh(matIron7, 5.5, -14.2, 0.16, 0.3, 8, 1.4, 0.5, null, 6.5));
    })();
    // extra vertical banners on the N house eaves
    [[-4.5, -11.5], [6.0, -11.6]].forEach(function (b) {
      scene.add(quadCorners(matBanner, [b[0], 4.0, b[1]], [b[0] + 0.5, 4.0, b[1]],
        [b[0] + 0.5, 2.6, b[1]], [b[0], 2.6, b[1]], 0.6, 1.6));
    });
    // candles on the fabric stall counter
    [[4.2, 1.1, 5.4], [4.8, 1.1, 5.9], [5.4, 1.1, 5.4]].forEach(function (c) {
      scene.add(boxMesh(matBeam, c[0], c[1] + 0.06, c[2], 0.06, 0.14, 0.06, 2));
      scene.add(boxMesh(matCoal, c[0], c[1] + 0.16, c[2], 0.025, 0.05, 0.025, 2, 0, [1.7, 1.2, 0.5]));
    });
    // pitchfork in the hay
    scene.add(boxMesh(matBeam, 10.4, 0.55, -8.35, 0.05, 1.7, 0.05, 2, 0.3));
    scene.add(boxMesh(matIron7, 10.4, 1.42, -8.3, 0.04, 0.3, 0.04, 2, 0.35));
    scene.add(boxMesh(matIron7, 10.34, 1.5, -8.36, 0.16, 0.04, 0.04, 2, 0.35));
    // entrance signboard at the south gap
    (function () {
      scene.add(cs(boxMesh(matBeam, -1.3, 0.8, 11.9, 0.1, 1.6, 0.1, 2)));
      scene.add(cs(boxMesh(matBeam, 1.3, 0.8, 11.9, 0.1, 1.6, 0.1, 2)));
      scene.add(boxMesh(matBeam, 0, 1.35, 11.9, 2.9, 0.55, 0.07, 1.6));
    })();

    // ---------------- v6 detail pass ------------------------------------
    // crate stacks beside the stalls
    var matIron = ps1Material(PS1.solidTexture(54, 56, 62));
    function crates(x, z, n) {
      for (var i = 0; i < n; i++) {
        var cx2 = x + (hash2(i, Math.round(x * 10)) - 0.5) * 0.26;
        var cz2 = z + (hash2(i, Math.round(z * 10)) - 0.5) * 0.26;
        scene.add(cs(boxMesh(matBeam, cx2, 0.26 + Math.floor(i / 2) * 0.52, cz2, 0.52, 0.50, 0.52, 1.2, hash2(i, 5) * 0.3 - 0.15)));
      }
      colliders.push({ x0: x - 0.5, z0: z - 0.5, x1: x + 0.5, z1: z + 0.5 });
    }
    crates(-7.5, 2.7, 3); crates(9.3, -5.1, 4); crates(-2.7, 9.1, 3);
    // woven baskets with produce
    [[4.9, -0.4], [5.5, -0.1], [-5.9, 4.7], [6.2, 7.5]].forEach(function (b, i) {
      scene.add(prismMesh(matSack, b[0], b[1], 0.26, 0.20, 7, 1.6, 0.5, null, 0));
      if (i < 2) scene.add(PS1.blobMesh(matFruitR, b[0], 0.30, b[1], 0.14, 0.8, 0.3, function () { return [1.1, 1.0, 0.9]; }));
    });
    // second bunting line between the pottery and fabric stalls
    (function () {
      var cols2 = [matAwnGreen, matClothY, matAwnRed];
      for (var i = 0; i < 12; i++) {
        var t = i / 11;
        var x = -3.5 + t * 9.4;
        var y = 2.28 - Math.sin(Math.PI * t) * 0.42;
        var tri = quadCorners(cols2[i % 3], [x - 0.09, y, 0], [x + 0.09, y, 0], [x + 0.02, y - 0.26, 0], [x - 0.02, y - 0.26, 0], 0.5, 0.8);
        tri.position.z = 6.55;
        scene.add(tri);
      }
    })();
    // well pump + bucket by the cart
    scene.add(cs(boxMesh(matStone, 10.8, 0.18, -6.4, 0.72, 0.36, 0.72, 1.2)));
    scene.add(cs(boxMesh(matIron, 10.8, 0.55, -6.4, 0.12, 0.5, 0.12, 2)));
    scene.add(boxMesh(matIron, 10.8, 0.74, -6.26, 0.30, 0.07, 0.12, 2));
    scene.add(boxMesh(matIron, 10.8, 0.95, -6.4, 0.11, 0.26, 0.06, 2));
    scene.add(prismMesh(matBeam, 10.35, -6.1, 0.14, 0.22, 7, 1.4, 0.4, null, 0));
    colliders.push({ x0: 10.35, z0: -6.85, x1: 11.25, z1: -5.95 });
    // firewood stack behind the fabric stall
    for (var w3 = 0; w3 < 6; w3++) {
      var log = prismMesh(matBeam, 0, 0, 0.09, 0.85, 5, 0.7, 1.8, null, 0);
      log.rotation.z = Math.PI / 2;
      log.position.set(3.5, 0.10 + Math.floor(w3 / 3) * 0.19, 7.35 + (w3 % 3) * 0.21);
      scene.add(log);
    }
    // extra grain sacks
    [[-6.4, 7.0], [6.5, 8.7], [-3.3, -6.1]].forEach(function (p) {
      scene.add(blobMesh(matSack, p[0], 0.30, p[1], 0.34, 1.0, 0.25, function () { return [1, 0.96, 0.86]; }));
    });
    // chickens pecking by the grain sacks
    var chickens = [];
    var matHen = ps1Material(PS1.solidTexture(235, 232, 225));
    var matComb = ps1Material(PS1.solidTexture(202, 44, 40));
    [[6.9, 6.5], [7.6, 7.0]].forEach(function (c, i) {
      var g = new THREE.Group();
      g.add(blobMesh(matHen, c[0], 0.13, c[1], 0.10, 0.85, 0.2, function () { return [1, 1, 1]; }));
      g.add(boxMesh(matHen, c[0], 0.20, c[1] - 0.09, 0.08, 0.08, 0.10, 2));
      g.add(boxMesh(matComb, c[0], 0.26, c[1] - 0.09, 0.04, 0.04, 0.06, 2));
      g.userData = { ph: 2.6 + i * 1.3 };
      scene.add(g); chickens.push(g);
    });
    // lantern string sagging between the north houses
    (function () {
      var ax = -2.6, az = 11.6, bx2 = 2.6, bz2 = 11.6, y0 = 3.15, sag = 0.42;
      for (var sg = 0; sg < 6; sg++) {
        var t0 = sg / 6, t1 = (sg + 1) / 6;
        var x0 = ax + (bx2 - ax) * t0, x1 = ax + (bx2 - ax) * t1;
        var z0 = az + (bz2 - az) * t0, z1 = az + (bz2 - az) * t1;
        var ym = y0 - sag * Math.sin(Math.PI * (t0 + t1) / 2);
        scene.add(boxMesh(matBeam, (x0 + x1) / 2, ym, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) + 0.04, 0.04, 0.04, 3, 0, [0.3, 0.22, 0.14]));
      }
      var matLantern2 = ps1Material(PS1.solidTexture(255, 200, 110));
      [0.22, 0.5, 0.78].forEach(function (t) {
        var lx = ax + (bx2 - ax) * t, lz = az + (bz2 - az) * t;
        var ly = y0 - sag * Math.sin(Math.PI * t) - 0.14;
        scene.add(boxMesh(matLantern2, lx, ly, lz, 0.15, 0.20, 0.15, 2, 0, [1.5, 1.05, 0.5]));
      });
    })();
    // smith corner: stump + anvil by the NE house
    scene.add(prismMesh(matBeam, 7.3, -11.3, 0.26, 0.42, 7, 1.4, 0.6, null, 0));
    scene.add(cs(boxMesh(matIron, 7.3, 0.62, -11.3, 0.55, 0.14, 0.26, 1.6)));
    scene.add(boxMesh(matIron, 7.3, 0.72, -11.46, 0.32, 0.10, 0.14, 2));
    colliders.push({ x0: 6.9, z0: -11.7, x1: 7.7, z1: -10.9 });
    // two more pigeons
    [[-3.5, -1.6], [4.5, 3.5]].forEach(function (p) {
      var g = new THREE.Group();
      g.add(blobMesh(matPigeon, p[0], 0.16, p[1], 0.10, 0.85, 0.2, function () { return [1, 1, 1]; }));
      g.add(boxMesh(matPigeon, p[0], 0.20, p[1], 0.10, 0.07, 0.10, 2));
      g.userData = { ph: 3.9 + p[0] };
      scene.add(g); pigeons.push(g);
    });
    // grime: mud + straw
    var matMud = PS1.decalMaterial(0.10, 0.08, 0.06, 0.42);
    var matStraw = PS1.decalMaterial(0.30, 0.24, 0.10, 0.3);
    decals.oct(6.0, 3.0, 1.6, matStraw, 0.005, 80);
    decals.oct(-6.9, -7.1, 1.1, matStraw, 0.005, 81);
    decals.path([[0, 4.5], [0.4, 7.5], [-0.3, 10.5]], 0.5, 0.7, matMud, 0.004);   // trodden path to entrance
    decals.oct(9.6, 7.6, 1.2, matMud, 0.004, 82);
    scene.add(decals.blobGroup); scene.add(decals.decalGroup);

    // golden dust motes + chimney smoke
    var dust = PS1.makeParticles({
      mode: 'dust', count: 150, color: [1.0, 0.86, 0.62],
      size: 0.02, speed: 1, sway: 0.5,
      area: [-12, 12, -12, 12, 3.6]
    });
    var smoke = PS1.makeParticles({
      mode: 'steam', count: 60, color: [0.46, 0.44, 0.44],
      size: 0.055, speed: 0.55, sway: 0.3,
      area: [6.5, 7.6, -14.8, -13.6, 3.4]
    });
    scene.add(dust); scene.add(smoke);

    return {
      name: '中世纪黄昏集市',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -11.6, x1: 11.6, z0: -10.8, z1: 13.4 },
      spawn: [-1.6, 13.0, Math.atan2(-(0.6 - -1.6), -(-2.5 - 13.4)), 0.0],
      idle: { pos: [-1.6, 3.6, 14.6], target: [0.6, 0.9, -2.5] },   // elevated diorama shot: stalls/awning stripes/fountain/cart all readable
      fog: { color: [0.58, 0.44, 0.33], near: 28, far: 66 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [dust, smoke].concat(braziers),
      update: function (t) {
        waterTex.offset.x = t * 0.03;
        waterTex.offset.y = -t * 0.05;
        banners.forEach(function (b, i) {
          b.rotation.z = 0.05 * Math.sin(t * 1.3 + i * 0.8);
        });
        pigeons.forEach(function (p) {
          var ph = p.userData.ph;
          p.position.y = Math.max(0, Math.sin(t * 2.2 + ph)) * 0.05;
          p.rotation.x = Math.max(0, Math.sin(t * 1.1 + ph * 2)) * 0.5;   // pecking
        });
        matCoal.uniforms.uFlicker.value = 0.85 + 0.15 * Math.sin(t * 19.0) * Math.sin(t * 6.7);
        chickens.forEach(function (c) {
          var ph = c.userData.ph;
          c.position.y = Math.max(0, Math.sin(t * 3.1 + ph)) * 0.04;
          c.rotation.x = Math.max(0, Math.sin(t * 1.7 + ph * 2)) * 0.6;   // pecking
        });
      }
    };
  });
})();
