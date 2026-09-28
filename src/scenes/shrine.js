(function () {
  'use strict';
  // ======================= 黄昏神社庭院 ================================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var shade = PS1.shade, cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  // ------------------------- textures ---------------------------------
  function gravelCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var base = 168, t = (hash2(Math.floor(x / 3), Math.floor(y / 3)) * 2 - 1) * 10;
      var r = base + t + 8, g = base + t + 4, b = base + t - 2;
      // raked lines: soft horizontal arcs
      var rake = Math.sin(y * 0.42 + Math.sin(x * 0.06) * 1.4);
      var k = rake > 0.55 ? 0.90 : (rake < -0.55 ? 1.08 : 1);
      r *= k; g *= k; b *= k;
      // scattered pebbles
      var px = Math.floor(x / 2), py = Math.floor(y / 2);
      var sp = hash2(px * 3 + 1, py * 5 + 2);
      if (sp < 0.05) { r *= 0.62; g *= 0.62; b *= 0.60; }
      else if (sp > 0.965) { r *= 1.25; g *= 1.24; b *= 1.18; }
      var moss = vnoise(x / 20, y / 20, 3, 2);
      if (moss > 0.74) { var n = (moss - 0.74) * 2.4; r *= 1 - n * 0.5; g *= 1 - n * 0.2; b *= 1 - n * 0.5; }
      return [r, g, b];
    });
  }
  function stoneCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 21), ry = y - row * 21;
      var x2 = x + (row & 1) * 16;
      var col = Math.floor(x2 / 32), cx = x2 - col * 32;
      var tint = (hash2(col % 3, row * 5 + 1) * 2 - 1) * 12;
      var r = 128 + tint, g = 126 + tint, b = 120 + tint;
      var grain = vnoise(x / 5, y / 5, 8, 2);
      r *= 0.88 + grain * 0.24; g *= 0.88 + grain * 0.24; b *= 0.88 + grain * 0.24;
      if (ry < 1 || cx < 1) { r *= 0.55; g *= 0.55; b *= 0.55; }
      var sp = hash2(x + 13, y + 29);
      if (sp < 0.09) { r *= 0.84; g *= 0.84; b *= 0.84; }
      return [r, g, b];
    });
  }
  function toriiCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var grain = vnoise(x / 3, y / 30, 8, 2);
      var base = 206, r = base, g = 68, b = 38;
      r *= 0.88 + grain * 0.2; g *= 0.88 + grain * 0.24; b *= 0.88 + grain * 0.24;
      // horizontal dark band at top (kasagi shadow line)
      if (y > 56) { r *= 0.35; g *= 0.35; b *= 0.35; }
      var sp = hash2(x + 3, y + 61);
      if (sp < 0.07) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }
  function waterCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var r = 48, g = 96, b = 100;
      var w1 = Math.sin((x + Math.sin(y * 0.3) * 6) * 0.35);
      var w2 = Math.sin((y + Math.sin(x * 0.22) * 8) * 0.26 + 2.0);
      var k = 0.8 + 0.2 * w1 + 0.18 * w2;
      r *= k; g *= k; b *= k;
      if (w1 > 0.86 && w2 > 0.4) { r += 80; g += 92; b += 84; }   // glints
      var sp = hash2(x + 7, y + 19);
      if (sp < 0.05) { r += 26; g += 30; b += 28; }
      return [r, g, b];
    });
  }
  function barkCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var grain = vnoise(x / 4, y / 22, 8, 2);
      var r = 88, g = 62, b = 48;
      r *= 0.8 + grain * 0.4; g *= 0.8 + grain * 0.4; b *= 0.8 + grain * 0.4;
      if (x % 23 < 1) { r *= 0.6; g *= 0.6; b *= 0.6; }
      var sp = hash2(x + 41, y + 3);
      if (sp < 0.08) { r *= 0.75; g *= 0.75; b *= 0.75; }
      // moss patches
      var moss = vnoise(x / 12, y / 12, 5, 2);
      if (moss > 0.70) { var n = (moss - 0.70) * 2; r *= 1 - n * 0.5; g *= 1 - n * 0.1; b *= 1 - n * 0.5; }
      return [r, g, b];
    });
  }
  function leafCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var cl = vnoise(x / 7, y / 7, 9, 3);
      var r, g, b;
      if (cl > 0.62) { r = 206; g = 64; b = 34; }          // red clumps
      else if (cl > 0.48) { r = 220; g = 126; b = 44; }    // orange clumps
      else if (cl > 0.38) { r = 134; g = 134; b = 48; }    // leftover green
      else { r = 46; g = 32; b = 27; }                     // dark gaps
      var sp = hash2(x + 11, y + 47);
      if (sp < 0.14) { r *= 0.7; g *= 0.7; b *= 0.7; }
      return [r, g, b];
    });
  }
  function plankCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 16), ry = y - row * 16;
      var tint = (hash2(row, 9) * 2 - 1) * 12;
      var r = 142 + tint, g = 104 + tint * 0.8, b = 70 + tint * 0.6;
      if (ry < 1) { r = 56; g = 40; b = 26; }
      var grain = vnoise(x / 26, (y + row * 17) / 3.6, 8, 2);
      if (grain > 0.60) { var n = (grain - 0.60) * 1.5; r *= 1 - n * 0.45; g *= 1 - n * 0.5; b *= 1 - n * 0.5; }
      var sp = hash2(x + 17, y + 8);
      if (sp < 0.07) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }
  function roofCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var col = Math.floor(x / 8), cx = x - col * 8;
      var row = Math.floor(y / 10), ry = y - row * 10;
      var r = 52, g = 42, b = 46;
      if (cx === 0) { r *= 0.5; g *= 0.5; b *= 0.5; }          // tile seams
      if (ry === 0) { r *= 1.5; g *= 1.45; b *= 1.4; }          // course highlight
      if (ry === 1) { r *= 0.7; g *= 0.7; b *= 0.7; }
      var tint = (hash2(col, row * 3) * 2 - 1) * 8;
      r += tint; g += tint; b += tint;
      var moss = vnoise(x / 16, y / 16, 4, 2);
      if (moss > 0.72) { var n = (moss - 0.72) * 1.8; r *= 1 - n * 0.4; g *= 1; b *= 1 - n * 0.3; }
      return [r, g, b];
    });
  }

  var gravelTex = texFrom(gravelCanvas());
  var stoneTex = texFrom(stoneCanvas());
  var toriiTex = texFrom(toriiCanvas());
  var waterTex = texFrom(waterCanvas());
  var barkTex = texFrom(barkCanvas());
  var leafTex = texFrom(leafCanvas());
  var plankTex = texFrom(plankCanvas());
  var roofTex = texFrom(roofCanvas());

  var matGravel = ps1Material(gravelTex);
  var matStone = ps1Material(stoneTex);
  var matTorii = ps1Material(toriiTex);
  var matWater = ps1Material(waterTex);
  var matBark = ps1Material(barkTex);
  var matLeaf = ps1Material(leafTex);
  var matPlank = ps1Material(plankTex);
  var matRoof = ps1Material(roofTex);
  var matDark = ps1Material(PS1.solidTexture(24, 20, 20));
  var matLanternGlow = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 205, 120)));

  // ------------------------- lighting ---------------------------------
  var SUN = new THREE.Vector3(-0.62, 0.20, -0.50).normalize();   // low WNW sun, sits in frame upper-left
  var SUN_COL = [1.32, 0.98, 0.62];
  var SKY_AMB = [0.36, 0.30, 0.38];
  var GND_AMB = [0.25, 0.19, 0.16];
  var shrineRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = SUN_COL[0] * ndl * 1.15 + GND_AMB[0] + (SKY_AMB[0] - GND_AMB[0]) * hemi;
    var g = SUN_COL[1] * ndl * 1.15 + GND_AMB[1] + (SKY_AMB[1] - GND_AMB[1]) * hemi;
    var b = SUN_COL[2] * ndl * 1.15 + GND_AMB[2] + (SKY_AMB[2] - GND_AMB[2]) * hemi;
    return [Math.min(1.18, r), Math.min(1.15, g), Math.min(1.12, b)];
  };

  PS1.registerScene(function () {
    setRelight(shrineRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    // sun light (drives directional shadow map)
    var sun = new THREE.DirectionalLight(0xffc890, 1);
    sun.position.copy(SUN).multiplyScalar(30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.004; sun.shadow.normalBias = 0.05;
    scene.add(sun); scene.add(sun.target);

    // sky + distant ridge silhouettes
    scene.add(PS1.makeSky({
      top: [0.16, 0.11, 0.30], horizon: [0.94, 0.52, 0.24], bottom: [0.13, 0.09, 0.11],
      sunDir: SUN.toArray(), sunCol: [1.3, 0.82, 0.42], sunCut: 0.9952, sunGlow: 0.55,
      radius: 90
    }));
    setRelight(function (x, y, z) {           // flat haze-tinted silhouettes
      var k = 0.85 + y * 0.012;
      return [0.17 * k, 0.125 * k, 0.24 * k];
    });
    [[0, -50, 60, 17], [-52, -6, 46, 13], [50, 4, 48, 15], [-24, 48, 52, 12]].forEach(function (m) {
      var cx = m[0], cz = m[1], w = m[2], h = m[3];
      scene.add(quadCorners(matDark,
        [cx - w / 2, -2, cz], [cx + w / 2, -2, cz], [cx + w / 6, h, cz + w / 3], [cx - w / 6, h * 0.8, cz + w / 3]));
    });
    setRelight(shrineRelight);

    // ground: raked gravel court
    scene.add(PS1.groundGrid(matGravel, 0, 0, 34, 30, 10, 1, 0, 1));

    // ---------------- torii gates along the approach -------------------
    function torii(z) {
      var g = new THREE.Group();
      g.add(cs(boxMesh(matTorii, -2.30, 1.70, z, 0.30, 3.40, 0.30, 1.6, 0.035)));
      g.add(cs(boxMesh(matTorii, 2.30, 1.70, z, 0.30, 3.40, 0.30, 1.6, -0.035)));
      g.add(cs(boxMesh(matTorii, 0, 3.42, z, 6.10, 0.26, 0.34, 1.6)));            // kasagi
      g.add(cs(boxMesh(matTorii, -3.05, 3.47, z, 0.28, 0.30, 0.30, 1.6, 0.16)));  // upturned end L
      g.add(cs(boxMesh(matTorii, 3.05, 3.47, z, 0.28, 0.30, 0.30, 1.6, -0.16)));  // upturned end R
      g.add(cs(boxMesh(matDark, 0, 3.20, z, 5.30, 0.14, 0.26, 2)));               // shimaki (black)
      g.add(cs(boxMesh(matTorii, 0, 2.62, z, 5.00, 0.20, 0.20, 1.6)));            // nuki
      g.add(cs(boxMesh(matDark, 0, 2.92, z, 0.30, 0.44, 0.10, 2)));               // plaque
      scene.add(g);
      colliders.push({ x0: -2.55, z0: z - 0.25, x1: -2.05, z1: z + 0.25 });
      colliders.push({ x0: 2.05, z0: z - 0.25, x1: 2.55, z1: z + 0.25 });
    }
    torii(7.5); torii(3.8); torii(0.2);

    // ---------------- stone lanterns (tōrō) -----------------------------
    var lanternWindows = [];
    function stoneLantern(x, z) {
      var g = new THREE.Group();
      g.add(cs(prismMesh(matStone, x, z, 0.44, 0.16, 6, 1.2, 0.4)));
      g.add(cs(prismMesh(matStone, x, z, 0.15, 0.92, 6, 1.0, 2.2, null, 0.16)));
      g.add(cs(prismMesh(matStone, x, z, 0.36, 0.10, 6, 1.2, 0.3, null, 1.08)));
      g.add(cs(boxMesh(matStone, x, 1.44, z, 0.46, 0.46, 0.46, 1.2)));            // fire box
      g.add(boxMesh(matLanternGlow, x - 0.275, 1.44, z, 0.02, 0.26, 0.26, 2, 0, [1.9, 1.35, 0.55]));
      g.add(boxMesh(matLanternGlow, x + 0.275, 1.44, z, 0.02, 0.26, 0.26, 2, 0, [1.9, 1.35, 0.55]));
      g.add(boxMesh(matLanternGlow, x, 1.44, z - 0.275, 0.26, 0.26, 0.02, 2, 0, [1.9, 1.35, 0.55]));
      g.add(boxMesh(matLanternGlow, x, 1.44, z + 0.275, 0.26, 0.26, 0.02, 2, 0, [1.9, 1.35, 0.55]));
      g.add(cs(prismMesh(matStone, x, z, 0.55, 0.34, 4, 1.4, 0.6, null, 1.67)));  // roof pyramid
      g.add(cs(boxMesh(matStone, x, 2.06, z, 0.10, 0.28, 0.10, 2)));              // finial
      scene.add(g);
      lanternWindows.push(matLanternGlow);
      colliders.push({ x0: x - 0.42, z0: z - 0.42, x1: x + 0.42, z1: z + 0.42 });
      decals.oct(x, z, 0.55, PS1.blobMat, 0.014);
    }
    stoneLantern(-2.35, 5.6); stoneLantern(2.35, 5.6);
    stoneLantern(-2.35, -1.8); stoneLantern(2.35, -1.8);
    stoneLantern(-7.9, 4.9);   // beside the pond

    // ---------------- koi pond -----------------------------------------
    var POND = { x: -5.6, z: 1.4, w: 5.2, d: 6.6 };
    var pondWater = PS1.groundGrid(matWater, POND.x, POND.z, POND.w - 0.5, POND.d - 0.5, 3, 0.5, 0.10, 1);   // >1 bucket above the gravel bed
    scene.add(pondWater);
    // stone rim
    [[POND.x, POND.z - POND.d / 2, POND.w + 0.7, 0.35], [POND.x, POND.z + POND.d / 2, POND.w + 0.7, 0.35],
     [POND.x - POND.w / 2, POND.z, 0.35, POND.d + 0.7], [POND.x + POND.w / 2, POND.z, 0.35, POND.d + 0.7]]
      .forEach(function (r) {
        scene.add(cs(boxMesh(matStone, r[0], 0.11, r[1], r[2], 0.22, r[3], 1.1)));
      });
    colliders.push({ x0: POND.x - POND.w / 2 - 0.3, z0: POND.z - POND.d / 2 - 0.3, x1: POND.x + POND.w / 2 + 0.3, z1: POND.z + POND.d / 2 + 0.3 });
    // lily pads
    for (var i = 0; i < 6; i++) {
      var a = hash2(i, 77) * Math.PI * 2, rr = 0.5 + hash2(i, 31) * 1.5;
      scene.add(prismMesh(matLeaf, POND.x + Math.cos(a) * rr, POND.z + Math.sin(a) * rr * 1.1,
        0.14 + hash2(i, 5) * 0.10, 0.02, 8, 1, 1, null, 0.035));
    }
    // swimming koi
    var koi = [];
    for (i = 0; i < 3; i++) {
      var k = new THREE.Group();
      k.add(boxMesh(PS1.ps1Material(PS1.solidTexture(235, 130, 40)), 0, 0, 0, 0.34, 0.06, 0.13, 1));
      k.add(boxMesh(PS1.ps1Material(PS1.solidTexture(220, 240, 245)), -0.20, 0, 0, 0.12, 0.05, 0.09, 1));
      k.userData = { r: 0.7 + hash2(i, 9) * 1.3, sp: (0.25 + hash2(i, 13) * 0.2) * (i % 2 ? 1 : -1), ph: hash2(i, 21) * Math.PI * 2 };
      scene.add(k); koi.push(k);
    }

    // ---------------- maple trees --------------------------------------
    function maple(x, z, s) {
      var g = new THREE.Group();
      g.add(cs(prismMesh(matBark, x, z, 0.20 * s, 1.5 * s, 6, 1.2, 2.4)));
      g.add(cs(prismMesh(matBark, x, z, 0.13 * s, 0.8 * s, 6, 1.0, 1.6, null, 1.5 * s)));
      g.add(cs(blobMesh(matLeaf, x + 0.3 * s, 2.7 * s, z - 0.2 * s, 1.5 * s, 0.85, 0.4,
        function (sd, y) {
          if (y > 3.4 * s) return [1.05, 0.42, 0.25];
          return sd > 0.5 ? [1.0, 0.5, 0.26] : [0.94, 0.62, 0.30];
        })));
      g.add(cs(blobMesh(matLeaf, x - 0.9 * s, 2.1 * s, z + 0.7 * s, 1.0 * s, 0.8, 0.45,
        function () { return [0.9, 0.55, 0.32]; })));
      scene.add(g);
      colliders.push({ x0: x - 0.45, z0: z - 0.45, x1: x + 0.45, z1: z + 0.45 });
      // fallen-leaf carpet decal
      var matLeafDrop = PS1.decalMaterial(0.24, 0.08, 0.05, 0.5);
      decals.oct(x, z, 1.9 * s, matLeafDrop, 0.008, Math.round(x * 7 + z));
    }
    maple(15.4, 2.4, 1.2); maple(10.2, -2.6, 1.0); maple(12.4, -6.2, 1.35);
    maple(-10.6, -6.2, 1.1); maple(-11.4, 7.2, 0.9); maple(13.6, 3.2, 1.05);

    // ---------------- stepping-stone path ------------------------------
    for (i = 0; i < 17; i++) {
      var sz = 9.6 - i * 0.92;
      if (sz < -5.4) break;
      var sx = Math.sin(i * 1.7) * 0.14;
      scene.add(cs(boxMesh(matStone, sx, 0.035, sz, 0.78 + hash2(i, 3) * 0.22, 0.07, 0.55 + hash2(i, 7) * 0.15, 1.0, hash2(i, 11) * 0.1 - 0.05)));
    }

    // ---------------- shrine building (north backdrop) ------------------
    var SHX = 0, SHZ = -10.6;
    scene.add(cs(boxMesh(matStone, SHX, 0.30, SHZ, 11, 0.60, 4.6, 1.0)));         // platform
    scene.add(cs(boxMesh(matStone, SHX, 0.14, SHZ + 2.7, 4.4, 0.28, 1.0, 1.0)));  // step 1
    scene.add(cs(boxMesh(matStone, SHX, 0.05, SHZ + 3.5, 3.0, 0.10, 0.7, 1.0)));  // step 2
    [-4.4, -1.6, 1.6, 4.4].forEach(function (cx2) {
      scene.add(cs(prismMesh(matTorii, cx2, SHZ + 1.7, 0.17, 3.0, 6, 1.4, 4.5)));
    });
    scene.add(PS1.wallSurface(matPlank, [SHX - 5.0, 0.60, SHZ - 1.4], [SHX + 5.0, 0.60, SHZ - 1.4],
      [SHX + 5.0, 3.55, SHZ - 1.4], [SHX - 5.0, 3.55, SHZ - 1.4], 5, 1.5, 0, 0, 1));   // back wall
    // shoji doors on the front face
    for (i = -2; i <= 2; i++) {
      scene.add(boxMesh(matPlank, SHX + i * 1.85, 2.05, SHZ + 1.68, 1.55, 2.75, 0.10, 1.2));
    }
    // roof: two big slopes + ridge
    scene.add(cs(quadCorners(matRoof,
      [SHX - 6.4, 3.55, SHZ - 2.6], [SHX + 6.4, 3.55, SHZ - 2.6],
      [SHX + 5.4, 5.30, SHZ + 0.1], [SHX - 5.4, 5.30, SHZ + 0.1], 6, 3)));            // back slope
    scene.add(cs(quadCorners(matRoof,
      [SHX - 6.9, 3.30, SHZ + 3.6], [SHX + 6.9, 3.30, SHZ + 3.6],
      [SHX + 5.4, 5.30, SHZ + 0.15], [SHX - 5.4, 5.30, SHZ + 0.15], 6.4, 2.6)));      // front slope
    scene.add(cs(boxMesh(matDark, SHX, 5.34, SHZ + 0.1, 11.2, 0.22, 0.34, 2)));      // ridge
    colliders.push({ x0: SHX - 5.8, z0: SHZ - 2.4, x1: SHX + 5.8, z1: SHZ + 2.2 });

    // ---------------- komainu (guardian statues) -----------------------
    function komainu(x, z) {
      var g = new THREE.Group();
      g.add(cs(prismMesh(matStone, x, z, 0.34, 0.52, 6, 1.2, 0.6)));
      g.add(cs(boxMesh(matStone, x, 0.72, z, 0.62, 0.34, 0.34, 1.2)));
      g.add(cs(boxMesh(matStone, x, 1.00, z, 0.30, 0.30, 0.32, 1.2)));
      g.add(cs(boxMesh(matStone, x, 1.18, z + 0.10, 0.10, 0.09, 0.12, 2)));          // snout
      g.add(cs(boxMesh(matStone, x - 0.10, 1.22, z, 0.07, 0.14, 0.06, 2, 0.3)));     // ear
      g.add(cs(boxMesh(matStone, x + 0.10, 1.22, z, 0.07, 0.14, 0.06, 2, -0.3)));
      scene.add(g);
      colliders.push({ x0: x - 0.45, z0: z - 0.45, x1: x + 0.45, z1: z + 0.45 });
    }
    komainu(-2.1, -5.8); komainu(2.1, -5.4);

    // ---------------- moss + petals decals ------------------------------
    var matMoss = PS1.decalMaterial(0.06, 0.10, 0.05, 0.42);
    [[-3.4, 8.6], [3.6, 7.2], [-8.9, 5.9], [4.2, -1.2], [-4.0, -2.6], [9.0, -4.4]].forEach(function (p, i2) {
      decals.oct(p[0], p[1], 0.5 + hash2(i2, 3) * 0.7, matMoss, 0.006, i2 + 20);
    });
    decals.oct(POND.x + 3.4, POND.z + 3.8, 0.8, PS1.decalMaterial(0.30, 0.16, 0.13, 0.34), 0.009, 31);  // petal drift
    scene.add(decals.blobGroup); scene.add(decals.decalGroup);


    // ---------------- v6 detail pass ------------------------------------
    // ema plaque rack beside the shrine steps
    (function () {
      var ex = 4.3, ez = -6.9;
      scene.add(cs(boxMesh(matBark, ex, 1.05, ez, 0.10, 2.1, 0.10, 2)));
      scene.add(cs(boxMesh(matBark, ex, 1.05, ez + 1.7, 0.10, 2.1, 0.10, 2)));
      scene.add(cs(boxMesh(matBark, ex, 2.02, ez + 0.85, 0.08, 0.14, 1.9, 2)));
      for (var e = 0; e < 6; e++) {
        scene.add(boxMesh(matPlank, ex + 0.10, 1.80 - Math.floor(e / 2) * 0.30, ez + 0.35 + (e % 2) * 1.0, 0.03, 0.24, 0.30, 2, 0, [0.86, 0.72, 0.5]));
      }
      colliders.push({ x0: ex - 0.15, z0: ez - 0.15, x1: ex + 0.15, z1: ez + 1.85 });
    })();
    // stone benches flanking the approach
    function benchLegs(x, z) {
      scene.add(cs(boxMesh(matStone, x, 0.16, z - 0.55, 0.40, 0.32, 0.18, 1.2)));
      scene.add(cs(boxMesh(matStone, x, 0.16, z + 0.55, 0.40, 0.32, 0.18, 1.2)));
      scene.add(cs(boxMesh(matStone, x, 0.40, z, 0.55, 0.14, 1.55, 1.0)));
      colliders.push({ x0: x - 0.35, z0: z - 0.85, x1: x + 0.35, z1: z + 0.85 });
    }
    benchLegs(2.75, 4.6); benchLegs(-2.75, -3.4);
    // low tamagaki fence runs along the approach
    function fenceRun(x, z0, z1) {
      for (var zz = z0; zz <= z1; zz += 1.0) scene.add(cs(boxMesh(matBark, x, 0.45, zz, 0.09, 0.9, 0.09, 2)));
      scene.add(boxMesh(matBark, x, 0.74, (z0 + z1) / 2, 0.05, 0.08, z1 - z0 + 0.12, 1.2));
      scene.add(boxMesh(matBark, x, 0.40, (z0 + z1) / 2, 0.05, 0.08, z1 - z0 + 0.12, 1.2));
    }
    fenceRun(3.3, 2.2, 9.2); fenceRun(-3.3, -3.4, 1.8);
    // shrubs tucked into corners
    [[4.7, 6.4], [-4.3, 7.6], [8.8, 7.8], [-8.4, -3.4], [5.4, -4.8], [-7.2, 8.4]].forEach(function (b, i) {
      scene.add(cs(blobMesh(matLeaf, b[0], 0.30, b[1], 0.42 + hash2(i, 3) * 0.2, 0.75, 0.4,
        function (sd) { return sd > 0.6 ? [0.82, 0.62, 0.34] : [0.74, 0.56, 0.36]; })));
    });
    // short ground lanterns by the entrance
    function shortLantern(x, z) {
      scene.add(cs(prismMesh(matStone, x, z, 0.30, 0.34, 6, 1.4, 0.6)));
      scene.add(boxMesh(matLanternGlow, x, 0.18, z + 0.305, 0.20, 0.16, 0.02, 2, 0, [1.9, 1.35, 0.55]));
      scene.add(boxMesh(matLanternGlow, x, 0.18, z - 0.305, 0.20, 0.16, 0.02, 2, 0, [1.9, 1.35, 0.55]));
      scene.add(cs(prismMesh(matStone, x, z, 0.38, 0.10, 4, 1.4, 0.3, null, 0.34)));
      colliders.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35 });
    }
    shortLantern(-1.9, 10.6); shortLantern(1.9, 10.6);
    // sake barrels stacked on the shrine platform
    [[4.2, -9.6, 0.6], [4.2, -10.5, 0.6], [5.0, -10.05, 0.6], [4.55, -10.05, 1.24]].forEach(function (b) {
      scene.add(cs(prismMesh(matPlank, b[0], b[1], 0.33, 0.60, 8, 2, 0.9, null, b[2])));
      scene.add(prismMesh(matTorii, b[0], b[1], 0.35, 0.09, 8, 2, 0.3, null, b[2] + 0.16));
    });
    // incense burner in front of the steps + a wisp of smoke
    scene.add(cs(prismMesh(matStone, 1.5, -7.5, 0.24, 0.44, 6, 1.5, 0.6)));
    scene.add(cs(prismMesh(matStone, 1.5, -7.5, 0.42, 0.44, 8, 1.8, 0.6, null, 0.44)));
    colliders.push({ x0: 1.05, z0: -7.95, x1: 1.95, z1: -7.05 });
    var matAsh = ps1Material(PS1.solidTexture(90, 88, 84));
    scene.add(boxMesh(matAsh, 1.5, 0.90, -7.5, 0.55, 0.05, 0.55, 2));
    var incense = PS1.makeParticles({
      mode: 'steam', count: 36, color: [0.58, 0.56, 0.53],
      size: 0.035, speed: 0.45, sway: 0.12,
      area: [1.2, 1.8, -7.8, -7.2, 2.4]
    });
    scene.add(incense);
    // small guide signs
    function signPost(x, z) {
      scene.add(cs(boxMesh(matBark, x, 0.55, z, 0.07, 1.1, 0.07, 2)));
      scene.add(boxMesh(matPlank, x + 0.06, 0.95, z, 0.04, 0.34, 0.26, 2));
      colliders.push({ x0: x - 0.12, z0: z - 0.12, x1: x + 0.12, z1: z + 0.12 });
    }
    signPost(-4.9, 10.5); signPost(4.9, -3.2);
    // extra moss + fallen-leaf drifts
    var matLeafPile = PS1.decalMaterial(0.30, 0.13, 0.08, 0.42);
    [[3.9, 8.8], [-3.7, -4.9], [8.2, -2.4], [-9.4, 5.6]].forEach(function (p, i) {
      decals.oct(p[0], p[1], 0.6 + hash2(i, 9) * 0.5, matLeafPile, 0.006, 90 + i);
    });
    // ---------------- falling petals ------------------------------------
    var petals = PS1.makeParticles({
      mode: 'petal', count: 210, color: [0.93, 0.52, 0.47],
      size: 0.035, speed: 0.55, sway: 0.55,
      area: [-13, 13, -11, 12, 7.5]
    });
    scene.add(petals);

    return {
      name: '黄昏神社庭院',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -12.5, x1: 12.5, z0: -7.6, z1: 12.5 },
      spawn: [10.8, 8.8, Math.atan2(-(-3.5 - 10.8), -(-5.5 - 8.8)), 0.0],
      idle: { pos: [10.8, 1.62, 8.8], target: [-3.5, 2.0, -5.5] },
      fog: { color: [0.60, 0.37, 0.26], near: 26, far: 64 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [petals, incense],
      update: function (t) {
        waterTex.offset.x = t * 0.018;
        waterTex.offset.y = t * 0.042;
        var glow = 0.9 + 0.08 * Math.sin(t * 11.3) + 0.04 * Math.sin(t * 29.7 + 1.1);
        matLanternGlow.uniforms.uFlicker.value = glow;
        koi.forEach(function (k) {
          var d = k.userData;
          var a = d.ph + t * d.sp;
          var px = POND.x + Math.cos(a) * d.r * 0.8;
          var pz = POND.z + Math.sin(a) * d.r;
          k.position.set(px, 0.055, pz);
          k.rotation.y = -a + (d.sp > 0 ? Math.PI / 2 : -Math.PI / 2);
        });
      }
    };
  });
})();
