(function () {
  'use strict';
  // ======================= 江南水乡夜 =================================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function whitewashCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 7, 3);
      var r = 168 + n * 30, g = 166 + n * 28, b = 158 + n * 26;
      var stain = vnoise(x / 15 + 4, y / 34, 4, 2);
      if (stain > 0.64) { var k = (stain - 0.64) * 1.5; r *= 1 - k * 0.42; g *= 1 - k * 0.40; b *= 1 - k * 0.34; }
      if (y > 52) { var d = (y - 52) / 12; r *= 1 - d * 0.5; g *= 1 - d * 0.45; b *= 1 - d * 0.35; }  // damp base
      return [r, g, b];
    });
  }
  function tileCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var col = Math.floor(x / 8);
      var row = Math.floor(y / 10);
      var tint = (hash2(col, row * 3) * 2 - 1) * 9;
      var r = 42 + tint, g = 44 + tint, b = 50 + tint;
      if (x % 8 < 1) { r *= 0.55; g *= 0.55; b *= 0.55; }
      if (y % 10 === 0) { r *= 1.5; g *= 1.5; b *= 1.5; }
      var moss = vnoise(x / 16, y / 16, 4, 2);
      if (moss > 0.72) { var k = (moss - 0.72) * 1.6; r *= 1 - k * 0.5; g *= 1 - k * 0.05; b *= 1 - k * 0.4; }
      return [r, g, b];
    });
  }
  function nightWaterCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var w1 = Math.sin((x + Math.sin(y * 0.32) * 6) * 0.38);
      var w2 = Math.sin((y + Math.sin(x * 0.26) * 7) * 0.3 + 1.6);
      var k = 0.78 + 0.14 * w1 + 0.12 * w2;
      var r = 9 * k, g = 16 * k, b = 24 * k;
      if (w1 > 0.9 && w2 > 0.45) { r += 36; g += 52; b += 62; }     // moonlit crests
      return [r, g, b];
    });
  }
  function stoneSlabCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 16), x2 = x + (row & 1) * 14;
      var col = Math.floor(x2 / 28), cx = x2 - col * 28;
      var tint = (hash2(col + row * 5, row) * 2 - 1) * 10;
      var r = 96 + tint, g = 98 + tint, b = 102 + tint;
      var n = vnoise(x / 6, y / 6, 8, 2);
      r *= 0.88 + n * 0.24; g *= 0.88 + n * 0.24; b *= 0.88 + n * 0.24;
      if (y % 16 < 1 || cx < 1) { r *= 0.5; g *= 0.5; b *= 0.5; }
      return [r, g, b];
    });
  }
  function woodDarkCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var grain = vnoise(x / 4, y / 24, 8, 2);
      var r = 74 * (0.85 + grain * 0.3), g = 56 * (0.85 + grain * 0.3), b = 42 * (0.85 + grain * 0.3);
      if (x % 17 < 1) { r *= 0.6; g *= 0.6; b *= 0.6; }
      return [r, g, b];
    });
  }
  function bannerRedCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var r = 158, g = 30, b = 26;
      if (y > 20 && y < 30 && (x + y) % 21 < 12) { r = 216; g = 180; b = 70; }  // 酒 character band hint
      var n = vnoise(x / 10, y / 10, 5, 2);
      r *= 0.9 + n * 0.2; g *= 0.9 + n * 0.2; b *= 0.9 + n * 0.2;
      if (y < 2) { r *= 0.4; g *= 0.4; b *= 0.4; }
      return [r, g, b];
    });
  }

  var whitewashTex = texFrom(whitewashCanvas());
  var tileTex = texFrom(tileCanvas());
  var nightWaterTex = texFrom(nightWaterCanvas());
  var stoneSlabTex = texFrom(stoneSlabCanvas());
  var woodDarkTex = texFrom(woodDarkCanvas());
  var bannerRedTex = texFrom(bannerRedCanvas());

  var matWall = ps1Material(whitewashTex);
  var matTile = ps1Material(tileTex);
  var matWater = ps1Material(nightWaterTex);
  var matSlab = ps1Material(stoneSlabTex);
  var matWoodDark = ps1Material(woodDarkTex);
  var matBannerRed = ps1Material(bannerRedTex);
  var matWindowWarm = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 200, 110)));
  var matLantern = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 90, 45)));

  var MOON = new THREE.Vector3(-0.22, 0.78, 0.30).normalize();
  var LANTERNS = [];   // baked warm pools along the eaves (filled BEFORE geometry bakes)
  var STRINGS = [
    { x0: -19, x1: -13, y: 3.1, z: -4.05 }, { x0: -10.5, x1: -5.5, y: 3.4, z: -4.45 },
    { x0: -14, x1: -11, y: 3.2, z: 4.45 }, { x0: 5, x1: 8, y: 3.3, z: 4.45 }
  ];
  STRINGS.forEach(function (st2) {
    for (var lb = 0; lb <= 4; lb += 2) {
      var t = lb / 4;
      LANTERNS.push([st2.x0 + (st2.x1 - st2.x0) * t, st2.y - 0.22 * Math.sin(Math.PI * t) - 0.1, st2.z]);
    }
  });
  LANTERNS.push([-4.2, 1.95, -1.7], [4.2, 1.95, 1.7], [-2.0, 2.5, -3.9], [3.5, 2.5, 3.9]);
  var wtRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOON.x + ny * MOON.y + nz * MOON.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.10 + 0.16 * ndl + 0.03 * hemi;
    var g = 0.13 + 0.20 * ndl + 0.04 * hemi;
    var b = 0.20 + 0.30 * ndl + 0.06 * hemi;
    for (var i = 0; i < LANTERNS.length; i++) {
      var L = LANTERNS[i];
      var dx = L[0] - x, dy = L[1] - y, dz = L[2] - z;
      var d2 = dx * dx + dy * dy + dz * dz;
      var fall = 1.5 / (1 + d2 * 0.10);
      var inv = 1 / (Math.sqrt(d2) + 1e-4);
      var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
      var w = fall * (0.4 + 0.6 * nd);
      r += w * 1.35; g += w * 0.52; b += w * 0.22;
    }
    return [Math.min(1.15, r), Math.min(1.1, g), Math.min(1.1, b)];
  };

  PS1.registerScene(function () {
    setRelight(wtRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var moon = new THREE.DirectionalLight(0x8899cc, 1);
    moon.position.copy(MOON).multiplyScalar(32);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 75;
    moon.shadow.camera.left = -19; moon.shadow.camera.right = 19;
    moon.shadow.camera.top = 19; moon.shadow.camera.bottom = -19;
    moon.shadow.bias = -0.004; moon.shadow.normalBias = 0.05;
    scene.add(moon); scene.add(moon.target);

    scene.add(PS1.makeSky({
      top: [0.012, 0.025, 0.06], horizon: [0.075, 0.10, 0.155], bottom: [0.03, 0.04, 0.06],
      sunDir: MOON.toArray(), sunCol: [0.6, 0.68, 0.85], sunCut: 0.9993, sunGlow: 0.08,
      stars: 0.55, meteors: 0.4, radius: 90
    }));

    // ---------------- canal + embankments ------------------------------
    var CANAL = { z0: -2.5, z1: 2.5 };                       // canal runs along x
    scene.add(PS1.groundGrid(matWater, 0, 0, 46, 4.6, 8, 0.7, 0.05, 1));
    scene.add(PS1.groundGrid(matSlab, 0, -5.0, 46, 5.0, 8, 1, 0.14, 1));   // north bank
    scene.add(PS1.groundGrid(matSlab, 0, 5.0, 46, 5.0, 8, 1, 0.14, 1));    // south bank
    // outer ground (dark)
    scene.add(PS1.groundGrid(ps1Material(PS1.solidTexture(18, 22, 26)), 0, 0, 60, 26, 8, 1, -0.02, 1));
    // embankment walls into the water
    scene.add(PS1.wallSurface(matSlab, [-23, 0.14, -2.3], [23, 0.14, -2.3], [23, -0.5, -2.3], [-23, -0.5, -2.3], 20, 0.6, 0, 0, -1));
    scene.add(PS1.wallSurface(matSlab, [23, 0.14, 2.3], [-23, 0.14, 2.3], [-23, -0.5, 2.3], [23, -0.5, 2.3], 20, 0.6, 0, 0, 1));

    // ---------------- whitewash houses with horse-head gables ----------
    function house(x, z, w, d, h, front) {                   // front: +1 faces canal from north bank, -1 from south
      scene.add(cs(boxMesh(matWall, x, h / 2, z, d, h, w, 1.0)));
      // two-layer tile roof, ridge along x
      var rh = 1.3, ry = h;
      scene.add(cs(quadCorners(matTile,
        [x - d / 2 - 0.4, ry, z - w / 2 - 0.35], [x + d / 2 + 0.4, ry, z - w / 2 - 0.35],
        [x + d / 2, ry + rh, z], [x - d / 2, ry + rh, z], d * 0.5, w * 0.6)));
      scene.add(cs(quadCorners(matTile,
        [x - d / 2 - 0.4, ry, z + w / 2 + 0.35], [x + d / 2 + 0.4, ry, z + w / 2 + 0.35],
        [x + d / 2, ry + rh, z], [x - d / 2, ry + rh, z], d * 0.5, w * 0.6)));
      // horse-head gable steps at both x ends
      [-1, 1].forEach(function (sd2) {
        var gx = x + sd2 * (d / 2 + 0.1);
        scene.add(boxMesh(matWall, gx, ry + 0.25, z, 0.22, 0.55, w + 0.5, 1.0));
        scene.add(boxMesh(matTile, gx, ry + 0.62, z, 0.28, 0.2, w + 0.62, 1.2));
        scene.add(boxMesh(matWall, gx, ry + 0.95, z, 0.18, 0.45, w * 0.55, 1.0));
        scene.add(boxMesh(matTile, gx, ry + 1.25, z, 0.24, 0.16, w * 0.65, 1.2));
      });
      // door + lit windows on the canal face
      var fz = z + front * (w / 2 + 0.06);
      scene.add(boxMesh(matWoodDark, x, 1.02, fz, 0.95, 2.0, 0.1, 2));
      var lit = hash2(Math.round(x * 3), Math.round(z));
      var winMat2 = lit > 0.5 ? matWindowWarm : ps1Material(PS1.solidTexture(14, 16, 22));
      scene.add(boxMesh(winMat2, x - d * 0.26, 1.7, fz, 0.62, 0.66, 0.06, 2, 0, lit > 0.5 ? [1.35, 0.92, 0.4] : null));
      scene.add(boxMesh(winMat2, x + d * 0.26, h + 1.0, fz, 0.62, 0.7, 0.06, 2, 0, lit > 0.5 ? [1.35, 0.92, 0.4] : null));
      colliders.push({ x0: x - d / 2 - 0.2, z0: z - w / 2 - 0.4, x1: x + d / 2 + 0.2, z1: z + w / 2 + 0.4 });
    }
    house(-16.5, -6.6, 5.5, 4.6, 3.2, 1);   // north bank row
    house(-8.0, -7.0, 6.0, 5.0, 3.5, 1);
    house(1.5, -6.6, 5.5, 4.8, 3.1, 1);
    house(10.5, -6.9, 6.2, 5.0, 3.4, 1);
    house(-12.5, 7.0, 5.8, 4.8, 3.3, -1);   // south bank row
    house(-3.0, 6.6, 5.2, 4.4, 3.0, -1);
    house(6.5, 7.0, 6.0, 5.0, 3.4, -1);
    house(15.0, 6.7, 5.5, 4.6, 3.2, -1);

    // ---------------- arched stone bridge --------------------------------
    (function () {
      var bx = 0, half = 3.4, deck = 0.42, topY = 2.05;
      // corbelled arch: stepped slabs leaving a water gap
      for (var st = 0; st < 4; st++) {
        var yb = 0.14 + st * 0.48;
        var inset = 0.85 - st * 0.22;
        [-1, 1].forEach(function (sd2) {
          scene.add(cs(boxMesh(matSlab, bx + sd2 * (half - inset / 2), yb + 0.24, 0, inset + 0.3, 0.48, 4.6, 1.0)));
        });
      }
      // deck ramps + flat top
      scene.add(cs(quadCorners(matSlab, [bx - 4.6, 0.14, -2.1], [bx - 1.6, topY - deck, -2.1], [bx - 1.6, topY - deck, 2.1], [bx - 4.6, 0.14, 2.1], 3, 2)));
      scene.add(cs(quadCorners(matSlab, [bx + 4.6, 0.14, -2.1], [bx + 1.6, topY - deck, -2.1], [bx + 1.6, topY - deck, 2.1], [bx + 4.6, 0.14, 2.1], 3, 2)));
      scene.add(cs(boxMesh(matSlab, bx, topY - deck / 2, 0, 3.2, deck, 4.6, 1.0)));
      // railings
      [-1.9, 1.9].forEach(function (rz) {
        for (var rp = -2; rp <= 2; rp++) {
          scene.add(cs(boxMesh(matSlab, bx + rp * 0.8, topY + 0.26, rz, 0.14, 0.52, 0.14, 2)));
        }
        scene.add(boxMesh(matSlab, bx, topY + 0.5, rz, 4.4, 0.12, 0.14, 1.4));
      });
      colliders.push({ x0: bx - 4.6, z0: -2.4, x1: bx + 4.6, z1: 2.4 });
      // lanterns at the bridge heads
      [[-4.2, -1.7], [4.2, 1.7]].forEach(function (p) {
        scene.add(cs(prismMesh(matWoodDark, p[0], p[1], 0.06, 1.9, 6, 1.2, 2.4)));
        scene.add(boxMesh(matLantern, p[0], 1.95, p[1], 0.16, 0.2, 0.16, 2, 0, [1.8, 0.55, 0.25]));
      });
    })();

    // ---------------- eave lantern strings + reflections -----------------
    STRINGS.forEach(function (st2) {
      for (var lb = 0; lb <= 4; lb++) {
        var t = lb / 4;
        var lx = st2.x0 + (st2.x1 - st2.x0) * t;
        var ly = st2.y - 0.22 * Math.sin(Math.PI * t) - 0.1;
        scene.add(boxMesh(matLantern, lx, ly, st2.z, 0.15, 0.18, 0.15, 2, 0, [1.8, 0.55, 0.25]));
      }
      // reflection band on the canal water below
      var wBand = st2.z < 0 ? -1.05 : 1.05;
      decals.rect((st2.x0 + st2.x1) / 2, wBand, Math.abs(st2.x1 - st2.x0) + 0.6, 0.9,
        PS1.decalMaterial(0.34, 0.11, 0.05, 0.42), 0.11);
    });
    // moon glitter band on the water
    decals.rect(6.0, 1.4, 7.0, 1.0, PS1.decalMaterial(0.16, 0.20, 0.30, 0.35), 0.11);
    decals.rect(-6.5, 0.9, 6.0, 1.0, PS1.decalMaterial(0.16, 0.20, 0.30, 0.35), 0.11);

    // ---------------- moored boat ---------------------------------------
    (function () {
      var bx = -8.2, bz = -0.9;
      var hull = prismMesh(matWoodDark, 0, 0, 0.5, 0.5, 6, 2.4, 1, null, 0);
      hull.scale.set(1, 0.5, 2.6);
      hull.position.set(bx, 0.18, bz);
      scene.add(cs(hull));
      // bamboo hood (squashed cylinder)
      var hood = prismMesh(matWoodDark, 0, 0, 0.42, 0.5, 7, 2, 1, null, 0);
      hood.scale.set(1, 0.62, 1.35);
      hood.position.set(bx + 0.8, 0.42, bz);
      scene.add(hood);
      // mooring pole + rope hint
      scene.add(cs(boxMesh(matWoodDark, bx - 2.4, 0.5, bz + 0.3, 0.08, 1.4, 0.08, 2)));
      colliders.push({ x0: bx - 1.4, z0: bz - 0.75, x1: bx + 1.4, z1: bz + 0.75 });
    })();

    // ---------------- dock + steps + props -------------------------------
    (function () {
      var dx = 12.5, dz = -3.6;
      scene.add(boxMesh(matWoodDark, dx, 0.2, dz, 3.2, 0.12, 1.6, 1.4));
      [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]].forEach(function (p) {
        scene.add(boxMesh(matWoodDark, dx + p[0], 0.07, dz + p[1], 0.12, 0.14, 0.12, 2));
      });
      colliders.push({ x0: dx - 1.7, z0: dz - 0.85, x1: dx + 1.7, z1: dz + 0.85 });
    })();
    // wine banner on a pole (sways)
    var banner = new THREE.Group();
    banner.position.set(-9.5, 3.0, -4.3);
    (function () {
      var b2 = PS1.quadCorners(matBannerRed, [0, 0, -0.35], [0, 0, 0.35], [0, -1.4, 0.35], [0, -1.4, -0.35], 0.8, 1.8);
      banner.add(b2);
      scene.add(banner);
    })();
    scene.add(cs(boxMesh(matWoodDark, -9.5, 1.7, -4.3, 0.09, 3.4, 0.09, 2)));
    // stone lions at the bridge head
    function lion(x, z) {
      scene.add(cs(prismMesh(matSlab, x, z, 0.28, 0.42, 6, 1.4, 0.6)));
      scene.add(cs(boxMesh(matSlab, x, 0.62, z, 0.44, 0.3, 0.3, 1.2)));
      scene.add(cs(boxMesh(matSlab, x, 0.88, z, 0.3, 0.28, 0.28, 1.2)));
      scene.add(boxMesh(matSlab, x, 1.0, z + 0.12, 0.12, 0.1, 0.12, 2));
      colliders.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35 });
    }
    lion(-4.9, -1.9); lion(-4.9, 1.9);
    // laundry pole + planter boxes on the south bank
    scene.add(cs(boxMesh(matWoodDark, 2.8, 1.4, 4.6, 0.07, 2.8, 0.07, 2)));
    scene.add(boxMesh(ps1Material(PS1.solidTexture(150, 84, 60)), -0.5, 0.3, 4.4, 1.1, 0.35, 0.4, 1.4));
    scene.add(blobMesh(matBannerRed, -0.5, 0.62, 4.4, 0.22, 0.8, 0.3, function () { return [0.5, 1.1, 0.5]; }));  // shrub
    // hanging street-lantern posts on the banks
    [[-2.0, -3.9], [3.5, 3.9]].forEach(function (p) {
      scene.add(cs(prismMesh(matWoodDark, p[0], p[1], 0.07, 2.6, 6, 1.2, 3)));
      scene.add(boxMesh(matLantern, p[0], 2.5, p[1], 0.2, 0.24, 0.2, 2, 0, [1.8, 0.55, 0.25]));
      decals.oct(p[0], p[1] + (p[1] < 0 ? -0.6 : 0.6), 1.2, PS1.decalMaterial(0.30, 0.10, 0.05, 0.4), 0.012, Math.round(p[0] * 7));
    });


    // ---------------- v8 detail pass ------------------------------------
    // second moored boat with a sleeping cat
    var boatCat = new THREE.Group();
    (function () {
      var bx = -12.6, bz = 0.4;
      var hull2 = prismMesh(matWoodDark, 0, 0, 0.5, 0.5, 6, 2.4, 1, null, 0);
      hull2.scale.set(0.9, 0.5, 2.3);
      hull2.position.set(bx, 0.18, bz);
      scene.add(cs(hull2));
      scene.add(cs(boxMesh(matWoodDark, bx - 2.1, 0.5, bz, 0.07, 1.3, 0.07, 2)));   // mooring pole
      var matCat2 = ps1Material(PS1.solidTexture(26, 24, 26));
      boatCat.position.set(bx + 0.5, 0.5, bz);
      boatCat.add(PS1.blobMesh(matCat2, 0, 0, 0, 0.12, 0.8, 0.25, function () { return [1, 1, 1]; }));
      boatCat.add(boxMesh(ps1Material(PS1.solidTexture(190, 235, 130)), 0, 0.1, -0.1, 0.05, 0.04, 0.02, 2, 0, [1.4, 1.7, 0.9]));
      scene.add(boatCat);
      colliders.push({ x0: bx - 1.3, z0: bz - 0.7, x1: bx + 1.3, z1: bz + 0.7 });
    })();
    // wine jars stacked by the west house
    [[-14.6, -4.4], [-14.0, -4.9], [-14.4, -5.3]].forEach(function (j) {
      scene.add(prismMesh(ps1Material(PS1.solidTexture(94, 74, 52)), j[0], j[1], 0.24, 0.6, 7, 1.8, 0.9));
    });
    // bamboo laundry poles with clothes over the south bank
    (function () {
      var px3 = 0.5, pz3 = 4.2;
      scene.add(cs(boxMesh(matWoodDark, px3 - 1.4, 1.3, pz3, 0.05, 2.6, 0.05, 2, 0.06)));
      scene.add(cs(boxMesh(matWoodDark, px3 + 1.4, 1.3, pz3, 0.05, 2.6, 0.05, 2, -0.06)));
      scene.add(boxMesh(matWoodDark, px3, 2.42, pz3, 2.9, 0.03, 0.03, 3));
      [[-0.9, [186, 168, 150]], [-0.3, [96, 108, 138]], [0.4, [168, 96, 88]], [1.0, [150, 150, 160]]].forEach(function (c) {
        scene.add(boxMesh(ps1Material(PS1.solidTexture(c[1][0], c[1][1], c[1][2])), px3 + c[0], 2.2, pz3, 0.4, 0.5, 0.05, 1.6));
      });
    })();
    // window-sill planters on the canal faces
    [[-8.0, -4.5], [1.5, -4.3], [-3.0, 4.35], [10.5, -4.45]].forEach(function (wp) {
      scene.add(boxMesh(matWoodDark, wp[0], 1.42, wp[1], 0.7, 0.16, 0.2, 1.4));
      scene.add(blobMesh(ps1Material(PS1.solidTexture(52, 104, 60)), wp[0], 1.6, wp[1], 0.16, 0.9, 0.3, function () { return [0.8, 1.05, 0.8]; }));
    });
    // hanging dried fish under the dock-side eave
    (function () {
      var hx = 11.4, hz = -3.5;
      scene.add(boxMesh(matWoodDark, hx, 2.4, hz, 1.4, 0.04, 0.04, 3));
      var matFish = ps1Material(PS1.solidTexture(168, 148, 110));
      for (var fi = 0; fi < 5; fi++) {
        scene.add(boxMesh(matFish, hx - 0.55 + fi * 0.28, 2.2, hz, 0.06, 0.3, 0.1, 2, 0.1 * (fi % 2)));
      }
    })();
    // big lily jar + lotus leaves by the south bank steps
    (function () {
      var jx = -6.5, jz = 3.6;
      scene.add(prismMesh(ps1Material(PS1.solidTexture(96, 78, 60)), jx, jz, 0.4, 0.75, 8, 2, 1.2));
      scene.add(prismMesh(matWater, jx, jz, 0.32, 0.04, 8, 1, 0.4, null, 0.75));
      [[-0.1, 0.1], [0.15, -0.08]].forEach(function (l2) {
        var leaf = prismMesh(matBannerRed, 0, 0, 0.16, 0.03, 8, 1, 1, null, 0);
        leaf.position.set(jx + l2[0], 0.82, jz + l2[1]);
        leaf.scale.set(1, 1, 1);
        scene.add(leaf);
      });
    })();
    // vendor carrying-pole with baskets (resting by the bridge head)
    (function () {
      var vx = 4.9, vz = 2.6;
      scene.add(cs(boxMesh(matWoodDark, vx, 1.15, vz, 0.05, 1.7, 0.05, 2, 0.5)));
      [[-0.55, 0], [0.6, 0.1]].forEach(function (b3) {
        scene.add(boxMesh(matWoodDark, vx + b3[0], 0.3, vz + b3[1], 0.42, 0.3, 0.42, 1.6));
      });
    })();
    // tea table + stools outside the east house
    (function () {
      var tx2 = 9.5, tz2 = 3.9;
      scene.add(boxMesh(matWoodDark, tx2, 0.42, tz2, 0.9, 0.08, 0.9, 1.5));
      [[-0.35, -0.35], [0.35, 0.35]].forEach(function (lg) {
        scene.add(boxMesh(matWoodDark, tx2 + lg[0], 0.2, tz2 + lg[1], 0.4, 0.4, 0.4, 1.5));
      });
      scene.add(prismMesh(ps1Material(PS1.solidTexture(140, 100, 60)), tx2, tz2, 0.1, 0.14, 6, 1.4, 0.5, null, 0.46));
      colliders.push({ x0: tx2 - 0.6, z0: tz2 - 0.6, x1: tx2 + 0.6, z1: tz2 + 0.6 });
    })();
    // three more lantern strings across side lanes
    var MORE_STR = [
      { x0: -6.2, x1: -1.4, y: 3.15, z: -4.15 }, { x0: 7.5, x1: 12.5, y: 3.2, z: -4.35 }, { x0: 11.5, x1: 15.5, y: 3.25, z: 4.55 }
    ];
    MORE_STR.forEach(function (st3) {
      for (var lb2 = 0; lb2 <= 4; lb2++) {
        var t2 = lb2 / 4;
        var lx2 = st3.x0 + (st3.x1 - st3.x0) * t2;
        var ly2 = st3.y - 0.22 * Math.sin(Math.PI * t2) - 0.1;
        scene.add(boxMesh(matLantern, lx2, ly2, st3.z, 0.15, 0.18, 0.15, 2, 0, [1.8, 0.55, 0.25]));
      }
      decals.rect((st3.x0 + st3.x1) / 2, st3.z < 0 ? -1.05 : 1.05, Math.abs(st3.x1 - st3.x0) + 0.6, 0.9,
        PS1.decalMaterial(0.34, 0.11, 0.05, 0.42), 0.11);
    });
    // stone drum blocks (抱鼓石) at the bridge heads
    [[-4.35, -1.75], [-4.35, 1.75]].forEach(function (dr) {
      scene.add(prismMesh(matSlab, dr[0], dr[1], 0.2, 0.5, 8, 1.4, 0.8));
      scene.add(prismMesh(matSlab, dr[0], dr[1], 0.24, 0.18, 8, 1.4, 0.5, null, 0.5));
    });

    // water mist
    var mist = PS1.makeParticles({
      mode: 'steam', count: 70, color: [0.30, 0.34, 0.40],
      size: 0.055, speed: 0.22, sway: 0.15,
      area: [-18, 18, -2.2, 2.2, 1.1]
    });
    scene.add(mist);

    return {
      name: '江南水乡夜',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -18.5, x1: 18.5, z0: -9.2, z1: 9.2 },
      spawn: [-10.5, 3.2, Math.atan2(-(-12.0 - -10.5), -(0.6 - 3.2)), 0.0],
      idle: { pos: [0.2, 2.75, 0.1], target: [-12.0, 1.1, 0.6] },   // standing ON the bridge, looking west down the canal
      fog: { color: [0.075, 0.10, 0.155], near: 7, far: 33 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [mist],
      update: function (t) {
        nightWaterTex.offset.x = t * 0.015;
        nightWaterTex.offset.y = t * 0.05;
        matLantern.uniforms.uFlicker.value = 0.92 + 0.07 * Math.sin(t * 9.7) + 0.03 * Math.sin(t * 24.3);
        matWindowWarm.uniforms.uFlicker.value = 0.94 + 0.06 * Math.sin(t * 7.3);
        banner.rotation.z = 0.06 * Math.sin(t * 1.4);
        boatCat.rotation.z = 0.05 * Math.sin(t * 1.1);
        boatCat.position.y = 0.5 + 0.03 * Math.sin(t * 1.7);
      }
    };
  });
})();
