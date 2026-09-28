(function () {
  'use strict';
  // ======================= 浓雾夜小镇街道 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  // ------------------------- textures ---------------------------------
  function asphaltCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 9, 3);
      var r = 46 + n * 26, g = 47 + n * 26, b = 53 + n * 28;
      var sp = hash2(x, y);
      if (sp < 0.10) { r *= 0.7; g *= 0.7; b *= 0.7; }
      if (sp > 0.955) { r += 42; g += 44; b += 52; }        // wet glints
      // center dashed line
      var lane = Math.abs(x - 32) < 3;
      var dash = (Math.floor(y / 12) % 2) === 0;
      if (lane && dash) { r = 175; g = 152; b = 48; }
      else if (lane && !dash) { r *= 1.05; g *= 1.05; b *= 1.05; }
      // cracks
      var cr = vnoise(x / 18 + 5, y / 4, 6, 2);
      if (cr > 0.78) { r *= 0.6; g *= 0.6; b *= 0.6; }
      return [r, g, b];
    });
  }
  function walkCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 16), ry = y - row * 16;
      var x2 = x + (row & 1) * 16;
      var col = Math.floor(x2 / 32), cx = x2 - col * 32;
      var tint = (hash2(col % 2, row * 3) * 2 - 1) * 9;
      var r = 96 + tint, g = 96 + tint, b = 94 + tint;
      var n = vnoise(x / 8, y / 8, 8, 2);
      r *= 0.9 + n * 0.2; g *= 0.9 + n * 0.2; b *= 0.9 + n * 0.2;
      if (ry < 1 || cx < 1) { r *= 0.55; g *= 0.55; b *= 0.55; }
      var sp = hash2(x + 5, y + 33);
      if (sp < 0.08) { r *= 0.82; g *= 0.82; b *= 0.82; }
      return [r, g, b];
    });
  }
  function sidingCanvas(br, bg, bb) {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 10), ry = y - row * 10;
      var tint = (hash2(row, 3) * 2 - 1) * 8;
      var r = br + tint, g = bg + tint, b = bb + tint;
      if (ry < 1) { r *= 0.5; g *= 0.5; b *= 0.5; }
      else if (ry === 1) { r *= 1.15; g *= 1.15; b *= 1.15; }
      var grain = vnoise(x / 30, y / 5, 8, 2);
      r *= 0.92 + grain * 0.16; g *= 0.92 + grain * 0.16; b *= 0.92 + grain * 0.16;
      var dirt = vnoise(x / 14, y / 40, 4, 2);
      if (dirt > 0.62) { var n = (dirt - 0.62) * 1.2; r *= 1 - n * 0.4; g *= 1 - n * 0.4; b *= 1 - n * 0.4; }
      return [r, g, b];
    });
  }
  function shingleCanvas(br, bg, bb) {
    return pixelLoop(newCanvas(64), function (x, y) {
      var col = Math.floor(x / 10), cx = x - col * 10;
      var row = Math.floor(y / 12), ry = y - row * 12;
      var tint = (hash2(col, row * 5) * 2 - 1) * 9;
      var r = br + tint, g = bg + tint, b = bb + tint;
      if (ry < 1 || cx < 1) { r *= 0.45; g *= 0.45; b *= 0.45; }
      if (ry === 1) { r *= 1.3; g *= 1.3; b *= 1.3; }
      var sp = hash2(x + 19, y + 2);
      if (sp < 0.07) { r *= 0.75; g *= 0.75; b *= 0.75; }
      return [r, g, b];
    });
  }
  function metalCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 10, y / 10, 6, 2);
      var r = 52 + n * 20, g = 53 + n * 20, b = 57 + n * 22;
      if (x % 21 < 1) { r *= 0.7; g *= 0.7; b *= 0.7; }
      var rust = vnoise(x / 12 + 3, y / 12, 5, 2);
      if (rust > 0.72) { var k = (rust - 0.72) * 2.5; r += (90 - r) * k; g += (50 - g) * k; b += (28 - b) * k; }
      return [r, g, b];
    });
  }
  function grassCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 5, y / 5, 9, 2);
      var r = 22 + n * 24, g = 30 + n * 30, b = 20 + n * 18;
      var sp = hash2(x + 3, y + 9);
      if (sp < 0.2) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }

  var asphaltTex = texFrom(asphaltCanvas());
  var walkTex = texFrom(walkCanvas());
  var sidBlue = texFrom(sidingCanvas(96, 102, 112));
  var sidTan = texFrom(sidingCanvas(128, 106, 82));
  var sidGreen = texFrom(sidingCanvas(88, 100, 88));
  var roofDark = texFrom(shingleCanvas(46, 42, 48));
  var roofRed = texFrom(shingleCanvas(102, 58, 46));
  var metalTex = texFrom(metalCanvas());
  var grassTex = texFrom(grassCanvas());

  var matAsphalt = ps1Material(asphaltTex);
  var matWalk = ps1Material(walkTex);
  var matSidB = ps1Material(sidBlue);
  var matSidT = ps1Material(sidTan);
  var matSidG = ps1Material(sidGreen);
  var matRoofD = ps1Material(roofDark);
  var matRoofR = ps1Material(roofRed);
  var matMetal = ps1Material(metalTex);
  var matGrass = ps1Material(grassTex);
  var matDarkWood = ps1Material(PS1.solidTexture(66, 56, 46));
  var matGlassDark = ps1Material(PS1.solidTexture(12, 14, 20));
  var matWindowWarm = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 190, 90)));
  var matWindowCold = PS1.privateFlicker(ps1Material(PS1.solidTexture(140, 190, 255)));
  var matLampGlow = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 220, 150)));
  var matHydrant = ps1Material(PS1.solidTexture(150, 40, 34));

  // street lamps: baked as point lights into vertex colors
  var LAMPS = [
    [2.6, -14], [-2.6, -7], [2.6, 0], [-2.6, 7], [2.6, 14]
  ];
  var MOON = new THREE.Vector3(0.30, 0.80, -0.42).normalize();

  var townRelight = function (x, y, z, nx, ny, nz) {
    // dim cool moonlight + hemispheric night ambience + warm lamp pools
    var ndl = Math.max(0, nx * MOON.x + ny * MOON.y + nz * MOON.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.24 + 0.28 * ndl + 0.07 * hemi;
    var g = 0.27 + 0.32 * ndl + 0.08 * hemi;
    var b = 0.38 + 0.42 * ndl + 0.11 * hemi;
    for (var i = 0; i < LAMPS.length; i++) {
      var dx = LAMPS[i][0] - x, dz = LAMPS[i][1] - z, dy = 3.85 - y;
      var d2 = dx * dx + dy * dy + dz * dz;
      var fall = 1.6 / (1 + d2 * 0.10);
      var inv = 1 / (Math.sqrt(d2) + 1e-4);
      var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
      var w = fall * (0.45 + 0.55 * nd);
      r += w * 1.45; g += w * 1.02; b += w * 0.48;
    }
    return [Math.min(1.15, r), Math.min(1.12, g), Math.min(1.1, b)];
  };

  PS1.registerScene(function () {
    setRelight(townRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    // moon (drives the shadow map)
    var moon = new THREE.DirectionalLight(0x8899cc, 1);
    moon.position.copy(MOON).multiplyScalar(35);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -22; moon.shadow.camera.right = 22;
    moon.shadow.camera.top = 22; moon.shadow.camera.bottom = -22;
    moon.shadow.bias = -0.004; moon.shadow.normalBias = 0.05;
    scene.add(moon); scene.add(moon.target);

    // sky: dim stars, faint moon, fog-matched horizon
    scene.add(PS1.makeSky({
      top: [0.015, 0.025, 0.05], horizon: [0.115, 0.145, 0.195], bottom: [0.05, 0.06, 0.08],
      sunDir: MOON.toArray(), sunCol: [0.5, 0.6, 0.8], sunCut: 0.9994, sunGlow: 0.08,
      stars: 0.32, meteors: 0.9, radius: 90
    }));

    // ground plane far beyond the street (drowns in fog)
    scene.add(PS1.groundGrid(matGrass, 0, 0, 90, 90, 6, 1, -0.10, 1));
    // road + sidewalks
    scene.add(PS1.groundGrid(matAsphalt, 0, 0, 7, 44, 3, 1, 0.0, 1));
    scene.add(PS1.groundGrid(matWalk, -4.55, 0, 2.1, 44, 3, 1, 0.12, 1));
    scene.add(PS1.groundGrid(matWalk, 4.55, 0, 2.1, 44, 3, 1, 0.12, 1));

    // ---------------- houses -------------------------------------------
    function house(sx, z0, w, d, h, siding, roof, flip) {
      // flip=+1: house west of street (front faces +x); -1: east (faces -x)
      var front = sx + flip * d / 2;
      var g = new THREE.Group();
      g.add(cs(boxMesh(siding, sx, h / 2, z0, d, h, w, 1.0)));
      // gable roof: ridge runs along z
      var rh = 1.5;
      g.add(cs(quadCorners(roof,
        [sx - d / 2 - 0.4, h, z0 - w / 2 - 0.4], [sx + d / 2 + 0.4, h, z0 - w / 2 - 0.4],
        [sx + d / 2, h + rh, z0], [sx - d / 2, h + rh, z0], d * 0.6, w * 0.6)));
      g.add(cs(quadCorners(roof,
        [sx - d / 2 - 0.4, h, z0 + w / 2 + 0.4], [sx + d / 2 + 0.4, h, z0 + w / 2 + 0.4],
        [sx + d / 2, h + rh, z0], [sx - d / 2, h + rh, z0], d * 0.6, w * 0.6)));
      // gable ends
      g.add(cs(quadCorners(siding,
        [sx + d / 2, h, z0 - w / 2], [sx + d / 2, h, z0 + w / 2], [sx + d / 2, h + rh, z0], [sx + d / 2, h + rh, z0], w * 0.5, 0.8)));
      g.add(cs(quadCorners(siding,
        [sx - d / 2, h, z0 - w / 2], [sx - d / 2, h, z0 + w / 2], [sx - d / 2, h + rh, z0], [sx - d / 2, h + rh, z0], w * 0.5, 0.8)));
      // door + windows on the street face
      var fx = front + flip * 0.03;
      g.add(boxMesh(matDarkWood, fx, 1.05, z0 - w * 0.22, 0.08, 2.1, 1.0, 2));
      var lit = hash2(Math.round(z0), Math.round(sx)) ;
      var winMat = lit > 0.72 ? matWindowWarm : matGlassDark;
      g.add(boxMesh(winMat, fx, 1.7, z0 + w * 0.18, 0.02, 0.9, 0.8, 2, 0,
        lit > 0.72 ? [1.35, 0.95, 0.42] : null));
      if (hash2(Math.round(z0 * 3), 7) > 0.5) {
        g.add(boxMesh(matWindowWarm, fx, 1.7, z0 - w * 0.28, 0.02, 0.9, 0.8, 2, 0, [1.35, 0.95, 0.42]));
      }
      scene.add(g);
      colliders.push({ x0: sx - d / 2 - 0.4, z0: z0 - w / 2 - 0.4, x1: sx + d / 2 + 0.4, z1: z0 + w / 2 + 0.4 });
    }
    house(-8.2, -12.5, 7, 5.4, 3.4, matSidB, matRoofD, 1);   // W row
    house(-8.4, -3.5, 6.5, 5.8, 3.1, matSidT, matRoofR, 1);
    house(-8.0, 5.5, 7.5, 5.2, 3.6, matSidG, matRoofD, 1);
    house(8.3, -8.5, 7, 5.4, 3.3, matSidT, matRoofR, -1);    // E row
    house(8.1, 1.5, 6.5, 5.8, 3.5, matSidB, matRoofD, -1);
    house(8.4, 10.5, 7.5, 5.2, 3.2, matSidG, matRoofD, -1);

    // water tower on the far W house (fog silhouette landmark)
    (function () {
      var tx = -8.2, tz = -12.5, base = 3.4 + 1.5;
      [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) {
        scene.add(cs(boxMesh(matMetal, tx + p[0], base + 1.0, tz + p[1], 0.14, 2.0, 0.14, 2)));
      });
      scene.add(cs(prismMesh(matMetal, tx, tz, 1.3, 1.7, 8, 3, 1.4, null, base + 2.0)));
      scene.add(cs(prismMesh(matRoofD, tx, tz, 1.45, 0.55, 8, 3, 0.5, null, base + 3.7)));
    })();

    // ---------------- street lamps -------------------------------------
    LAMPS.forEach(function (p, i) {
      var x = p[0], z = p[1];
      scene.add(cs(prismMesh(matMetal, x, z, 0.09, 3.6, 6, 1.4, 4.5)));
      scene.add(cs(boxMesh(matMetal, x, 3.72, z + (x > 0 ? 0.35 : -0.35), 0.5, 0.09, 0.09, 2)));  // arm
      var hx = x + (x > 0 ? 0.62 : -0.62);
      scene.add(cs(boxMesh(matMetal, hx, 3.66, z, 0.34, 0.16, 0.34, 2)));                          // head box
      scene.add(boxMesh(matLampGlow, hx, 3.53, z, 0.24, 0.05, 0.24, 2, 0, [1.8, 1.45, 0.75]));    // glowing bottom
      decals.oct(x, z, 1.9, PS1.decalMaterial(0.44, 0.31, 0.15, 0.44), 0.005, 40 + i);            // light pool tint on road
      colliders.push({ x0: x - 0.16, z0: z - 0.16, x1: x + 0.16, z1: z + 0.16 });
    });

    // ---------------- fences, poles, small props ------------------------
    function fence(x, z0, z1) {
      for (var zz = z0; zz < z1; zz += 0.62) {
        scene.add(cs(boxMesh(matDarkWood, x, 0.55, zz + 0.31, 0.07, 1.0, 0.07, 2)));
      }
      scene.add(boxMesh(matDarkWood, x, 0.82, (z0 + z1) / 2, 0.06, 0.09, z1 - z0, 1));
      scene.add(boxMesh(matDarkWood, x, 0.45, (z0 + z1) / 2, 0.06, 0.09, z1 - z0, 1));
    }
    fence(-5.35, 1.2, 2.2); fence(-5.35, 9.2, 10.8);
    fence(5.35, -6.2, -4.4); fence(5.35, 13.9, 15.4);

    // power poles + sagging cables along the east side
    [[5.9, -16], [5.9, -2], [5.9, 12]].forEach(function (p) {
      scene.add(cs(prismMesh(matDarkWood, p[0], p[1], 0.12, 6.2, 6, 1.4, 8)));
      scene.add(cs(boxMesh(matDarkWood, p[0], 5.9, p[1], 1.3, 0.09, 0.09, 2)));
      scene.add(cs(boxMesh(matDarkWood, p[0], 5.5, p[1], 1.0, 0.08, 0.08, 2)));
    });
    for (var c = 0; c < 2; c++) {
      var zs = c === 0 ? -16 : -2, ze = c === 0 ? -2 : 12;
      for (var seg = 0; seg < 5; seg++) {
        var z0c = zs + (ze - zs) * seg / 5, z1c = zs + (ze - zs) * (seg + 1) / 5;
        var frac = (seg + 0.5) / 5;
        var ymid = 5.9 - 0.45 * Math.sin(Math.PI * frac);
        [-0.55, 0.55].forEach(function (xo) {
          scene.add(boxMesh(matDarkWood, 5.9 + xo, ymid, (z0c + z1c) / 2, 0.04, 0.04, z1c - z0c + 0.02, 4, 0, [0.10, 0.11, 0.13]));
        });
      }
    }

    // parked car (east side, very PS1 sedan)
    (function () {
      var cx = 3.1, cz = 4.6;
      var matCar = ps1Material(PS1.solidTexture(120, 34, 30));
      scene.add(cs(boxMesh(matCar, cx, 0.55, cz, 1.7, 0.5, 4.0, 1)));
      scene.add(cs(boxMesh(matCar, cx, 0.95, cz - 0.3, 1.5, 0.42, 2.0, 1)));
      scene.add(boxMesh(matGlassDark, cx, 0.95, cz + 0.75, 1.3, 0.32, 0.05, 1));
      [[-0.75, 1.35], [0.75, 1.35], [-0.75, -1.35], [0.75, -1.35]].forEach(function (w) {
        scene.add(prismMesh(matMetal, cx + w[0], cz + w[1], 0.30, 0.30, 6, 1.5, 0.8, null, 0.0));
      });
      colliders.push({ x0: cx - 0.95, z0: cz - 2.1, x1: cx + 0.95, z1: cz + 2.1 });
      decals.rect(cx, cz, 2.0, 4.3, PS1.blobMat, 0.005);
    })();

    // hydrant / mailbox / trash cans
    (function () {
      scene.add(cs(prismMesh(matHydrant, -3.9, 8.6, 0.14, 0.55, 6, 1.5, 0.8)));
      scene.add(cs(boxMesh(matHydrant, -3.9, 0.60, 8.6, 0.30, 0.12, 0.30, 1.5)));
      colliders.push({ x0: -4.1, z0: 8.4, x1: -3.7, z1: 8.8 });
      // mailbox
      scene.add(cs(prismMesh(matDarkWood, 4.6, 13.6, 0.06, 0.95, 4, 1, 1.2)));
      scene.add(cs(boxMesh(matMetal, 4.6, 1.02, 13.6, 0.22, 0.20, 0.34, 1.5)));
      // trash cans
      scene.add(cs(prismMesh(matMetal, -4.78, 12.3, 0.30, 0.85, 8, 1.8, 0.9)));
      scene.add(cs(prismMesh(matMetal, -4.78, 11.45, 0.30, 0.85, 8, 1.8, 0.9)));
      scene.add(cs(boxMesh(matMetal, -4.78, 0.90, 11.9, 0.62, 0.06, 0.62, 1.5)));
      colliders.push({ x0: -5.2, z0: 11.05, x1: -4.4, z1: 12.7 });
    })();

    // bare trees
    function bareTree(x, z, s) {
      scene.add(cs(prismMesh(matDarkWood, x, z, 0.16 * s, 2.4 * s, 6, 1.5, 3.5)));
      scene.add(cs(boxMesh(matDarkWood, x, 2.4 * s, z, 1.1 * s, 0.09 * s, 0.09 * s, 3, 0.5)));
      scene.add(cs(boxMesh(matDarkWood, x + 0.3 * s, 2.9 * s, z, 0.7 * s, 0.07 * s, 0.07 * s, 3, -0.45)));
      colliders.push({ x0: x - 0.3, z0: z - 0.3, x1: x + 0.3, z1: z + 0.3 });
    }
    bareTree(-4.9, -16.5, 1.0); bareTree(4.9, -13.8, 0.85); bareTree(-4.9, 14.6, 1.1);



    // ---------------- v7 atmosphere + props -----------------------------
    // a cat on the west fence, tail swaying, eyes catching the moonlight
    var catTail = new THREE.Group();
    (function () {
      var matCat = ps1Material(PS1.solidTexture(16, 15, 18));
      var matEye = PS1.privateFlicker(ps1Material(PS1.solidTexture(180, 230, 120)));
      var cx = -5.32, cz = 14.9;
      PS1.blobMesh(matCat, cx, 0.86, cz, 0.13, 0.8, 0.25, function () { return [1, 1, 1]; });
      scene.add(PS1.blobMesh(matCat, cx, 0.86, cz, 0.13, 0.8, 0.25, function () { return [1, 1, 1]; }));
      scene.add(boxMesh(matCat, cx, 0.98, cz + 0.10, 0.10, 0.09, 0.11, 2));
      scene.add(boxMesh(matEye, cx - 0.025, 0.99, cz + 0.15, 0.018, 0.018, 0.01, 2, 0, [1.3, 1.6, 0.8]));
      scene.add(boxMesh(matEye, cx + 0.025, 0.99, cz + 0.15, 0.018, 0.018, 0.01, 2, 0, [1.3, 1.6, 0.8]));
      catTail.position.set(cx + 0.14, 0.92, cz + 0.08);
      catTail.add(boxMesh(matCat, 0.1, 0.1, 0, 0.24, 0.04, 0.04, 2, -0.5));
      scene.add(catTail);
    })();
    // swing set in the east yard
    (function () {
      var sx = 7.4, sz = 8.2;
      scene.add(cs(boxMesh(matDarkWood, sx - 1.1, 1.15, sz, 0.1, 2.4, 0.1, 2, 0.32)));
      scene.add(cs(boxMesh(matDarkWood, sx + 1.1, 1.15, sz, 0.1, 2.4, 0.1, 2, -0.32)));
      scene.add(cs(boxMesh(matDarkWood, sx, 2.3, sz, 2.6, 0.12, 0.12, 2)));
      [-0.4, 0.4].forEach(function (o) {
        scene.add(boxMesh(matMetal, sx + o - 0.25, 1.4, sz, 0.03, 1.7, 0.03, 3));
        scene.add(boxMesh(matMetal, sx + o + 0.25, 1.4, sz, 0.03, 1.7, 0.03, 3));
        scene.add(boxMesh(matDarkWood, sx + o, 0.58, sz, 0.55, 0.06, 0.3, 2));
      });
      colliders.push({ x0: sx - 1.3, z0: sz - 0.3, x1: sx + 1.3, z1: sz + 0.3 });
    })();
    // blue US-style mailbox by the road
    scene.add(cs(prismMesh(ps1Material(PS1.solidTexture(38, 70, 150)), -4.62, 6.8, 0.24, 1.0, 8, 1.6, 1.4)));
    colliders.push({ x0: -4.9, z0: 6.5, x1: -4.35, z1: 7.1 });
    // flower pots on porches
    [[-5.42, -13.2], [-5.42, -12.1], [5.42, 1.0], [5.42, 2.1]].forEach(function (p) {
      scene.add(prismMesh(ps1Material(PS1.solidTexture(150, 84, 60)), p[0], p[1], 0.16, 0.26, 7, 1.4, 0.5, null, 0));
      scene.add(PS1.blobMesh(matGrass, p[0], 0.34, p[1], 0.15, 0.9, 0.3, function () { return [0.9, 1.0, 0.9]; }));
    });
    // porch steps before two doors
    [[-5.38, -4.93, 1], [5.38, 1.93, -1]].forEach(function (p) {
      scene.add(boxMesh(matWalk, p[0] + p[2] * 0.25, 0.06, p[1], 0.5, 0.12, 1.0, 1.4));
    });
    // welcome mats
    decals.rect(-5.05, -4.93, 0.8, 0.5, PS1.decalMaterial(0.10, 0.09, 0.08, 0.7), 0.13);
    // newspapers on lawns
    decals.rect(-6.4, 4.9, 0.42, 0.3, PS1.decalMaterial(0.72, 0.70, 0.62, 0.85), 0.012);
    decals.rect(6.6, -12.4, 0.4, 0.28, PS1.decalMaterial(0.66, 0.64, 0.56, 0.85), 0.012);
    // fallen-leaf drifts under the bare trees
    var matLeaves = PS1.decalMaterial(0.20, 0.13, 0.05, 0.5);
    [[-4.9, -16.2], [4.9, -13.6], [-4.9, 14.4]].forEach(function (p, i) {
      decals.oct(p[0], p[1], 1.1, matLeaves, 0.005, 60 + i);
    });
    // third power cable + transformer can on the middle pole
    (function () {
      var zs = -16, ze = 12;
      for (var seg = 0; seg < 7; seg++) {
        var z0 = zs + (ze - zs) * seg / 7, z1 = zs + (ze - zs) * (seg + 1) / 7;
        var ym = 5.5 - 0.4 * Math.sin(Math.PI * (seg + 0.5) / 7);
        scene.add(boxMesh(matDarkWood, 5.9 + 0.85, ym, (z0 + z1) / 2, 0.03, 0.03, z1 - z0 + 0.02, 4, 0, [0.10, 0.11, 0.13]));
      }
      scene.add(cs(boxMesh(matMetal, 5.9, 5.05, -2, 0.55, 0.5, 0.4, 1.3)));
      scene.add(prismMesh(matMetal, 5.9, -2.3, 0.05, 0.16, 6, 1, 0.4, null, 5.3));
      scene.add(prismMesh(matMetal, 5.9, -1.7, 0.05, 0.16, 6, 1, 0.4, null, 5.3));
    })();
    // one-way arrow sign
    scene.add(cs(boxMesh(matMetal, -4.62, 1.5, 10.9, 0.06, 3.0, 0.06, 2)));
    scene.add(boxMesh(ps1Material(PS1.solidTexture(225, 225, 220)), -4.56, 2.55, 10.9, 0.05, 0.35, 0.75, 2, 0, [0.95, 0.95, 0.92]));
    // downspouts on house corners + drip stains
    [[-5.7, -9.9], [5.7, -6.0], [5.7, 12.9]].forEach(function (dp) {
      scene.add(boxMesh(matMetal, dp[0], 1.6, dp[1], 0.08, 3.2, 0.08, 2));
      decals.wall(dp[0] * 0.995, 0.5, dp[1], false, 0.3, 0.9, PS1.decalMaterial(0.04, 0.04, 0.045, 0.4));
    });

    // ---------------- v6 detail pass ------------------------------------
    // stop sign at the south crosswalk (octagon face toward the camera)
    scene.add(cs(boxMesh(matMetal, 1.8, 1.1, 12.8, 0.07, 2.2, 0.07, 2)));
    (function () {
      var face = prismMesh(matHydrant, 0, 0, 0.30, 0.05, 8, 1.8, 0.2, null, 0);
      face.rotation.x = Math.PI / 2;
      face.position.set(1.8, 2.28, 12.8);
      scene.add(face);
    })();
    colliders.push({ x0: 1.65, z0: 12.65, x1: 1.95, z1: 12.95 });
    // park benches on the sidewalks
    function bench(x, z) {
      scene.add(boxMesh(matDarkWood, x, 0.42, z, 0.55, 0.06, 1.6, 1.4));
      scene.add(boxMesh(matDarkWood, x, 0.20, z - 0.6, 0.42, 0.36, 0.10, 1.4));
      scene.add(boxMesh(matDarkWood, x, 0.20, z + 0.6, 0.42, 0.36, 0.10, 1.4));
      scene.add(boxMesh(matDarkWood, x, 0.66, z - 0.76, 0.50, 0.44, 0.06, 1.4));
      colliders.push({ x0: x - 0.35, z0: z - 0.9, x1: x + 0.35, z1: z + 0.9 });
    }
    bench(-4.55, 4.6); bench(4.55, -10.6);
    // hedges in the front yards
    [[-5.7, -8.8], [-5.7, -7.3], [5.7, 6.6], [5.7, 8.0], [-5.7, 12.8]].forEach(function (h, i) {
      scene.add(cs(PS1.blobMesh(matGrass, h[0], 0.34, h[1], 0.55, 0.72, 0.35, function () { return [0.85, 0.95, 0.85]; })));
      void i;
    });
    // chimneys + a porch light over one door
    scene.add(cs(boxMesh(matRoofD, -8.4, 4.75, -3.5, 0.6, 1.5, 0.6, 1.5)));
    scene.add(cs(boxMesh(matRoofD, 8.4, 4.55, 10.5, 0.6, 1.4, 0.6, 1.5)));
    scene.add(boxMesh(matLampGlow, -5.40, 2.30, -4.93, 0.05, 0.10, 0.14, 2, 0, [1.6, 1.25, 0.6]));
    // bicycle leaning against the east fence
    (function () {
      var matBike = ps1Material(PS1.solidTexture(46, 92, 142));
      var bx = 5.42, bz = -5.5;
      [-0.52, 0.52].forEach(function (w) {
        var wheel = prismMesh(matMetal, 0, 0, 0.30, 0.05, 8, 1.8, 0.3, null, 0);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(bx + w * 0.55, 0.33, bz);
        scene.add(wheel);
      });
      scene.add(boxMesh(matBike, bx, 0.60, bz, 1.0, 0.05, 0.05, 2, 0.16));
      scene.add(boxMesh(matBike, bx, 0.46, bz, 0.05, 0.42, 0.05, 2));
      scene.add(boxMesh(matBike, bx - 0.46, 0.68, bz, 0.05, 0.05, 0.34, 2));
      scene.add(boxMesh(matDarkWood, bx + 0.44, 0.68, bz, 0.16, 0.05, 0.14, 2));
    })();
    // trash bags by the cans
    var matBag = ps1Material(PS1.solidTexture(24, 24, 28));
    scene.add(PS1.blobMesh(matBag, -4.70, 0.30, 13.15, 0.28, 0.95, 0.25, function () { return [1, 1, 1]; }));
    scene.add(PS1.blobMesh(matBag, -4.50, 0.24, 13.55, 0.22, 1.0, 0.25, function () { return [0.9, 0.9, 0.95]; }));
    // flower bed by the east house
    scene.add(boxMesh(matDarkWood, 5.62, 0.16, 1.6, 0.95, 0.32, 2.2, 1.4));
    [[5.35, 0.95], [5.62, 1.1], [5.9, 0.85], [5.4, 2.2], [5.85, 2.3]].forEach(function (f, i) {
      var cols = [[212, 70, 70], [230, 180, 70], [200, 90, 190]];
      var m = ps1Material(PS1.solidTexture(cols[i % 3][0], cols[i % 3][1], cols[i % 3][2]));
      scene.add(PS1.blobMesh(m, f[0], 0.42, f[1], 0.09, 0.9, 0.25, function () { return [1.15, 1.05, 1.05]; }));
    });
    // bus stop sign
    scene.add(cs(boxMesh(matMetal, 4.62, 1.2, -14.8, 0.06, 2.4, 0.06, 2)));
    scene.add(boxMesh(matWindowCold, 4.60, 2.15, -14.8, 0.03, 0.42, 0.60, 2, 0, [0.5, 0.75, 1.1]));
    // road markings + grime decals
    var matWhite = PS1.decalMaterial(0.72, 0.72, 0.66, 0.6);
    var matPuddle = PS1.decalMaterial(0.03, 0.035, 0.05, 0.55);
    var matManh = PS1.decalMaterial(0.05, 0.05, 0.06, 0.5);
    for (var s2 = 0; s2 < 6; s2++) decals.rect(-1.6 + s2 * 0.64, 16.4, 0.5, 2.6, matWhite, 0.008);  // crosswalk
    decals.oct(0.4, 2.4, 0.5, matManh, 0.006, 60);
    decals.oct(-1.8, -4.8, 0.9, matPuddle, 0.004, 61);
    decals.oct(2.2, 10.2, 0.7, matPuddle, 0.004, 62);
    decals.path([[0, 8], [0.7, 5.6], [1.3, 3.4]], 0.30, 0.2, PS1.decalMaterial(0.05, 0.045, 0.04, 0.4), 0.004); // tire track
    scene.add(decals.blobGroup); scene.add(decals.decalGroup);

    return {
      name: '浓雾夜小镇',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -4.9, x1: 4.9, z0: -18.5, z1: 18.5 },
      spawn: [1.4, 17.6, Math.atan2(-(0 - 1.4), -(-8 - 17.6)), 0.02],
      idle: { pos: [1.4, 1.62, 17.6], target: [-0.4, 1.75, -8] },
      fog: { color: [0.115, 0.145, 0.195], near: 5, far: 29 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [],
      update: function (t) {
        var warm = 0.92 + 0.07 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 23.7);
        matLampGlow.uniforms.uFlicker.value = warm;
        matWindowWarm.uniforms.uFlicker.value = warm;
        matWindowCold.uniforms.uFlicker.value = 0.4 + 0.6 * Math.abs(Math.sin(t * 5.3) * Math.sin(t * 0.7));
        catTail.rotation.z = 0.35 * Math.sin(t * 1.7);
      }
    };
  });
})();
