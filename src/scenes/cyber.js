(function () {
  'use strict';
  // ======================= 赛博朋克雨夜小巷 ============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  // ------------------------- textures ---------------------------------
  function wetAsphaltCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 5, y / 5, 9, 3);
      var r = 30 + n * 16, g = 31 + n * 16, b = 35 + n * 18;
      var sp = hash2(x, y);
      if (sp < 0.05) { r *= 0.55; g *= 0.55; b *= 0.55; }
      if (sp > 0.972) { r += 34; g += 36; b += 44; }         // rain glints
      var crack = vnoise(x / 20 + 3, y / 5, 6, 2);
      if (crack > 0.8) { r *= 0.55; g *= 0.55; b *= 0.55; }
      return [r, g, b];
    });
  }
  function brickCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 12), ry = y - row * 12;
      var x2 = x + (row & 1) * 14;
      var col = Math.floor(x2 / 28), cx = x2 - col * 28;
      var id = hash2(col + row * 7, row);
      var base = 62 + id * 26;
      var r = base * 1.06, g = base * 0.82, b = base * 0.78;
      if (ry < 1 || cx < 1) { r = 26; g = 24; b = 24; }
      var grime = vnoise(x / 14, y / 30, 4, 2);
      if (grime > 0.62) { var k = (grime - 0.62) * 1.5; r *= 1 - k * 0.55; g *= 1 - k * 0.5; b *= 1 - k * 0.45; }
      var sp = hash2(x + 8, y + 27);
      if (sp < 0.07) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }
  function concreteCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var panel = Math.floor(x / 32);
      var n = vnoise(x / 7, y / 7, 8, 2);
      var r = 54 + n * 20, g = 55 + n * 20, b = 60 + n * 22;
      if (x % 32 === 0 || y === 0) { r *= 0.5; g *= 0.5; b *= 0.5; }
      var stain = vnoise(x / 10 + 2, y / 40, 4, 2);
      if (stain > 0.68) { var k = (stain - 0.68) * 1.4; r *= 1 - k * 0.6; g *= 1 - k * 0.6; b *= 1 - k * 0.5; }
      void panel;
      return [r, g, b];
    });
  }
  function shutterCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var ridge = y % 6;
      var r = 44, g = 46, b = 52;
      if (ridge === 0) { r *= 1.4; g *= 1.4; b *= 1.4; }
      else if (ridge === 1) { r *= 0.6; g *= 0.6; b *= 0.6; }
      var rust = vnoise(x / 16, y / 10, 5, 2);
      if (rust > 0.72) { var k = (rust - 0.72) * 2; r += (100 - r) * k; g += (56 - g) * k; b += (30 - b) * k; }
      var sp = hash2(x + 5, y + 61);
      if (sp < 0.06) { r *= 0.7; g *= 0.7; b *= 0.7; }
      return [r, g, b];
    });
  }
  function metalCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 6, 2);
      var r = 42 + n * 18, g = 43 + n * 18, b = 48 + n * 20;
      if (x % 20 < 1) { r *= 0.7; g *= 0.7; b *= 0.7; }
      var rust = vnoise(x / 10 + 3, y / 10, 5, 2);
      if (rust > 0.74) { var k = (rust - 0.74) * 2.2; r += (95 - r) * k; g += (52 - g) * k; b += (30 - b) * k; }
      return [r, g, b];
    });
  }
  // chunky pixel glyph -> glowing neon sign face
  function neonCanvas(glyph, col) {
    var gw = glyph[0].length, gh = glyph.length;
    return pixelLoop(newCanvas(64), function (x, y) {
      var r = 3, g = 3, b = 5;
      // frame
      if (x < 3 || x > 60 || y < 3 || y > 60) {
        var t = (hash2(x, y) * 2 - 1) * 5;
        return [16 + t, 16 + t, 18 + t];
      }
      var sc = Math.floor(44 / gw);
      var ox = Math.floor((64 - gw * sc) / 2), oy = Math.floor((64 - gh * sc) / 2);
      var gx = Math.floor((x - ox) / sc), gy = Math.floor((y - oy) / sc);
      if (gx >= 0 && gx < gw && gy >= 0 && gy < gh && glyph[gy][gx] === 'x') {
        return [col[0], col[1], col[2]];
      }
      // faint bloom around strokes
      if (gx >= 0 && gx < gw && gy >= 0 && gy < gh) {
        var near = false, dx, dy;
        for (dy = -1; dy <= 1 && !near; dy++) for (dx = -1; dx <= 1; dx++) {
          var nx2 = gx + dx, ny2 = gy + dy;
          if (nx2 >= 0 && nx2 < gw && ny2 >= 0 && ny2 < gh && glyph[ny2][nx2] === 'x') { near = true; break; }
        }
        if (near) return [col[0] * 0.3 + 6, col[1] * 0.3 + 6, col[2] * 0.3 + 8];
      }
      var sp = hash2(x + 9, y + 3);
      if (sp < 0.02) return [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5];
      return [r, g, b];
    });
  }
  function vendingCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      if (x < 4 || x > 59 || y < 4 || y > 60) return [20, 20, 24];
      // glowing product window
      if (y > 8 && y < 44 && x > 8 && x < 52) {
        var row = Math.floor((y - 8) / 7), colI = Math.floor((x - 8) / 6);
        var c = [[240, 80, 66], [80, 220, 245], [252, 220, 80], [150, 110, 240], [100, 238, 145]][Math.floor(hash2(colI, row) * 5)];
        var sh = 0.85 + hash2(colI * 3, row * 7) * 0.45;
        return [Math.min(255, c[0] * sh), Math.min(255, c[1] * sh), Math.min(255, c[2] * sh)];
      }
      if (y > 46 && y < 58 && x > 8 && x < 40) {    // dispensing slot
        return [30, 30, 34];
      }
      return [100, 36, 42];    // brand panel
    });
  }

  var GLYPH_SAKE = [
    '............',
    '.x.....xxx..',
    '.x....x...x.',
    'xxx...x...x.',
    '.x....xxxxx.',
    '.x....x...x.',
    '.x....x.x.x.',
    'xxx...x.x.x.',
    '.x....xxxxx.',
    '.x..x......x',
    '.x.x.......x',
    '..x....xxx.x'
  ];
  var GLYPH_DEN = [
    '............',
    '..xxxxxxx...',
    '.....x......',
    '..xxxxxxx...',
    '..x.x.x.x...',
    '..xxxxxxx...',
    '....xxx.....',
    '...xxxxx....',
    '..xx.x.xx...',
    '..x..x..x...',
    '..xx.x.xx...',
    '....xxx.....',
    '......x.x...'
  ];
  var GLYPH_MEN = [
    '............',
    '.xx..x...x..',
    '..x..xxxxx..',
    '..x....x....',
    '.xx..xxxxx..',
    '..x..x...x..',
    '..x..xxxxx..',
    '.xx....x....',
    '..x..xxxxx..',
    '..x..x...x..',
    '.xx..xxxxx..',
    '............'
  ];
  var GLYPH_24H = [
    '............',
    '.xxx...xxx..',
    'x...x.x...x.',
    '....x.x...x.',
    '...x...xxxx.',
    '..xx...xxx..',
    '..x.......x.',
    '..x..xxxxxx.',
    '..x.......x.',
    '.xxx......x.',
    '.......xxxxx',
    '............'
  ];

  var asphaltTex = texFrom(wetAsphaltCanvas());
  var brickTex = texFrom(brickCanvas());
  var concreteTex = texFrom(concreteCanvas());
  var shutterTex = texFrom(shutterCanvas());
  var metalTex = texFrom(metalCanvas());
  var neonSakeTex = texFrom(neonCanvas(GLYPH_SAKE, [235, 60, 50]));
  var neonDenTex = texFrom(neonCanvas(GLYPH_DEN, [235, 60, 200]));
  var neonMenTex = texFrom(neonCanvas(GLYPH_MEN, [50, 225, 235]));
  var neon24Tex = texFrom(neonCanvas(GLYPH_24H, [240, 210, 60]));
  var vendingTex = texFrom(vendingCanvas());

  var matAsphalt = ps1Material(asphaltTex);
  var matBrick = ps1Material(brickTex);
  var matConcrete = ps1Material(concreteTex);
  var matShutter = ps1Material(shutterTex);
  var matMetal = ps1Material(metalTex);
  var matVending = ps1Material(vendingTex);
  var matNeonSake = ps1Material(neonSakeTex);
  var matNeonDen = ps1Material(neonDenTex);
  var matNeonMen = PS1.privateFlicker(ps1Material(neonMenTex));
  var matNeon24 = ps1Material(neon24Tex);
  var matTube = PS1.privateFlicker(ps1Material(PS1.solidTexture(80, 230, 240)));

  // neon lights baked as colored vertex pools
  var NEONS = [
    { x: -3.8, y: 4.0, z: 8.0, col: [1.15, 0.24, 0.18], k: 4.6 },
    { x: 3.8, y: 5.5, z: -2.0, col: [1.05, 0.22, 0.95], k: 4.6 },
    { x: 3.8, y: 4.5, z: 5.0, col: [0.16, 1.05, 1.15], k: 5.0 },
    { x: -3.8, y: 3.5, z: -6.0, col: [1.05, 0.9, 0.2], k: 3.8 },
    { x: 0, y: 2.8, z: -12.0, col: [1.15, 0.6, 0.24], k: 5.2 }    // far warm glow
  ];
  var MOON = new THREE.Vector3(-0.2, 0.75, 0.35).normalize();

  var cyberRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOON.x + ny * MOON.y + nz * MOON.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.11 + 0.12 * ndl + 0.05 * hemi;
    var g = 0.115 + 0.13 * ndl + 0.052 * hemi;
    var b = 0.16 + 0.17 * ndl + 0.07 * hemi;
    for (var i = 0; i < NEONS.length; i++) {
      var L = NEONS[i];
      var dx = L.x - x, dy = L.y - y, dz = L.z - z;
      var d2 = dx * dx + dy * dy + dz * dz;
      var fall = L.k / (1 + d2 * 0.13);
      var inv = 1 / (Math.sqrt(d2) + 1e-4);
      var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
      var w = fall * (0.4 + 0.6 * nd);
      r += w * L.col[0]; g += w * L.col[1]; b += w * L.col[2];
    }
    return [Math.min(1.15, r), Math.min(1.15, g), Math.min(1.2, b)];
  };

  PS1.registerScene(function () {
    setRelight(cyberRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var moon = new THREE.DirectionalLight(0x6677aa, 1);
    moon.position.copy(MOON).multiplyScalar(30);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 60;
    moon.shadow.camera.left = -14; moon.shadow.camera.right = 14;
    moon.shadow.camera.top = 18; moon.shadow.camera.bottom = -18;
    moon.shadow.bias = -0.004; moon.shadow.normalBias = 0.05;
    scene.add(moon); scene.add(moon.target);

    scene.add(PS1.makeSky({
      top: [0.015, 0.02, 0.045], horizon: [0.105, 0.085, 0.15], bottom: [0.03, 0.03, 0.05],
      sunDir: MOON.toArray(), sunCol: [0, 0, 0], stars: 0,
      radius: 90
    }));

    // ground + side service ledges
    scene.add(PS1.groundGrid(matAsphalt, 0, 0, 7.4, 36, 4, 1, 0, 1));

    // ---------------- flanking building walls --------------------------
    function wallStrip(x, z0, z1, y0, y1, mat, uvScale) {
      var n = Math.max(1, Math.round((z1 - z0) / 6));
      for (var i = 0; i < n; i++) {
        var za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n;
        var side = x < 0 ? 1 : -1;   // face the alley
        scene.add(PS1.wallSurface(mat,
          [x, y0, za], [x, y0, zb], [x, y1, zb], [x, y1, za],
          (zb - za) * uvScale, (y1 - y0) * uvScale, side, 0, 0));
      }
    }
    wallStrip(-4.2, -20, 17, 0, 11.5, matBrick, 0.55);
    wallStrip(4.2, -20, 17, 0, 13.0, matConcrete, 0.5);
    // wall tops silhouette clutter: tanks + AC boxes
    for (var i = 0; i < 6; i++) {
      var wx = i % 2 ? -4.0 : 4.0, wz = -18 + i * 6 + hash2(i, 3) * 2;
      var wy = (i % 2 ? 11.5 : 13.0) + 0.5;
      if (i % 3 === 0) {
        scene.add(cs(prismMesh(matMetal, wx, wz, 0.7, 1.1, 8, 3, 1, null, wy)));
      } else {
        scene.add(cs(boxMesh(matMetal, wx, wy + 0.35, wz, 0.9, 0.7, 0.9, 1.2)));
      }
    }

    // ground-floor shopfronts (shutters) with gaps
    [[-4.14, 4, -1], [-4.14, -9, -6], [-4.14, 12, 9], [4.14, 9, 6], [4.14, -4, -7.5], [4.14, 14, 11.5]]
      .forEach(function (s) {
        var side = s[0] < 0 ? 1 : -1;
        scene.add(PS1.wallSurface(matShutter,
          [s[0], 0, s[2]], [s[0], 0, s[1]], [s[0], 2.7, s[1]], [s[0], 2.7, s[2]],
          Math.abs(s[1] - s[2]) * 0.5, 1.35, side, 0, 0));
      });

    // ---------------- neon signs ---------------------------------------
    function neonSign(x, y, z, mat, w, h, flicker) {
      var side = x < 0 ? 1 : -1;
      var g = new THREE.Group();
      // box frame + glowing face toward the alley
      g.add(cs(boxMesh(matMetal, x, y, z, 0.18, h, w, 1.2)));
      g.add(quadMesh(mat, x + side * 0.165, y, z, side, 0, 0, w * 0.92, h * 0.92, 1, 1));
      g.add(boxMesh(matTube, x + side * 0.18, y, z - w * 0.52, 0.05, h * 0.9, 0.05, 2, 0, [0.55, 1.6, 1.7]));
      g.add(boxMesh(matTube, x + side * 0.18, y, z + w * 0.52, 0.05, h * 0.9, 0.05, 2, 0, [0.55, 1.6, 1.7]));
      if (flicker) {
        g.add(boxMesh(matMetal, x, y - h / 2 - 0.25, z, 0.10, 0.5, 0.10, 2));   // mount bracket
      }
      scene.add(g);
      return g;
    }
    neonSign(-4.28, 3.6, 8.0, matNeonSake, 1.25, 2.7, false);
    neonSign(4.28, 4.8, -2.0, matNeonDen, 1.25, 2.7, false);
    neonSign(4.28, 3.9, 5.0, matNeonMen, 1.25, 2.7, true);
    neonSign(-4.28, 3.3, -6.0, matNeon24, 1.35, 2.4, false);
    // horizontal neon tube high on the W wall + far-end glow panel
    scene.add(boxMesh(matTube, -4.1, 2.9, -13.0, 0.06, 0.10, 3.4, 2, 0, [0.5, 1.5, 1.6]));
    scene.add(boxMesh(PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 150, 60))), 0, 2.6, -19.5, 5.4, 3.4, 0.2, 2, 0, [1.05, 0.62, 0.28]));

    // vending machines
    [[-3.75, 0.5, 1], [3.75, -10.0, -1]].forEach(function (v, i) {
      var side = v[2];
      scene.add(cs(boxMesh(matMetal, v[0], 0.95, v[1], 0.8, 1.9, 1.05, 1.2)));
      scene.add(quadMesh(matVending, v[0] + side * 0.46, 1.15, v[1], side, 0, 0, 0.9, 1.55, 1, 1));
      colliders.push({ x0: v[0] - 0.6, z0: v[1] - 0.6, x1: v[0] + 0.6, z1: v[1] + 0.6 });
      decals.rect(v[0], v[1], 1.3, 1.4, PS1.blobMat, 0.006);
      void i;
    });

    // steam vent + grate
    scene.add(boxMesh(matMetal, 1.8, 0.02, 3.6, 1.1, 0.05, 0.7, 1.5));

    // AC units on walls + drip stains
    [[-3.9, 3.3, 10.5], [-3.9, 5.8, -9.5], [3.9, 4.6, 12.5]].forEach(function (a) {
      scene.add(cs(boxMesh(matMetal, a[0], a[1], a[2], 0.55, 0.65, 0.8, 1.2)));
      scene.add(boxMesh(matMetal, a[0] * 1.012, a[1] - 0.36, a[2], 0.4, 0.08, 0.6, 1.5));
      var side = a[0] < 0 ? 1 : -1;
      decals.wall(a[0] + side * 0.03, a[1] - 0.6, a[2], false, 0.5, 1.6, PS1.decalMaterial(0.05, 0.05, 0.06, 0.4));
    });

    // pipes: vertical + horizontal runs
    scene.add(cs(boxMesh(matMetal, -4.05, 3.2, 1.8, 0.14, 6.4, 0.14, 2.4)));
    scene.add(cs(boxMesh(matMetal, -4.05, 6.3, -4.0, 0.14, 0.14, 9.0, 2.4)));
    scene.add(cs(boxMesh(matMetal, 4.05, 7.4, 2.0, 0.14, 0.14, 12.0, 2.4)));

    // fire escape on the E wall (zigzag platforms + stair boxes)
    for (var lv = 0; lv < 3; lv++) {
      var fy = 2.9 + lv * 2.9;
      scene.add(cs(boxMesh(matMetal, 3.85, fy, 8.0, 0.9, 0.07, 3.0, 1.6)));
      scene.add(cs(boxMesh(matMetal, 3.85, fy + 1.45, 8.0, 0.9, 2.8, 0.07, 1.6)));   // railing hint
      scene.add(cs(boxMesh(matMetal, 3.85, fy + 0.9, 8.0, 0.7, 0.08, 2.2, 1.6, lv % 2 ? 0.55 : -0.55)));
    }

    // overhead cables crossing the alley
    [[6.2, 10.0], [5.4, 2.0], [6.6, -6.0], [5.8, -13.0]].forEach(function (cab, ci) {
      var y = cab[0], z = cab[1];
      for (var s3 = 0; s3 < 4; s3++) {
        var xa = -4.2 + 8.4 * s3 / 4, xb = -4.2 + 8.4 * (s3 + 1) / 4;
        var ym = y - 0.5 * Math.sin(Math.PI * (s3 + 0.5) / 4);
        scene.add(boxMesh(matMetal, (xa + xb) / 2, ym, z, (xb - xa) + 0.02, 0.028, 0.028, 4, 0, [0.04, 0.04, 0.05]));
      }
      void ci;
    });



    // ---------------- v7 atmosphere + props -----------------------------
    // scrolling marquee sign (animated texture offset)
    var marqueeTex = texFrom(pixelLoop(newCanvas(64), function (x, y) {
      if (x < 3 || x > 60 || y < 18 || y > 45) {
        var t = (hash2(x, y) * 2 - 1) * 5;
        return [16 + t, 16 + t, 19 + t];
      }
      var seg = Math.floor(x / 8);
      var dash = (Math.floor(y / 6) % 2 === 0) !== (seg % 2 === 0);
      if (dash && y > 24 && y < 40) return [70, 225, 235];
      return [8, 12, 14];
    }));
    var matMarquee = ps1Material(marqueeTex);
    scene.add(cs(boxMesh(matMetal, -4.1, 5.9, 4.2, 0.16, 0.6, 2.6, 1.4)));
    scene.add(quadMesh(matMarquee, -4.01, 5.9, 4.2, 1, 0, 0, 2.35, 0.46, 1, 1));
    // string lights across the alley (two catenaries, warm bulbs)
    var matBulbStr = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 210, 140)));
    function lightString(z, y0) {
      for (var sg = 0; sg < 6; sg++) {
        var x0 = -4.2 + 8.4 * sg / 6, x1 = -4.2 + 8.4 * (sg + 1) / 6;
        var ym = y0 - 0.35 * Math.sin(Math.PI * (sg + 0.5) / 6);
        scene.add(boxMesh(matMetal, (x0 + x1) / 2, ym, z, x1 - x0 + 0.02, 0.02, 0.02, 4, 0, [0.05, 0.05, 0.06]));
      }
      for (var b = 0; b < 7; b++) {
        var t = b / 6;
        scene.add(boxMesh(matBulbStr, -4.2 + 8.4 * t, y0 - 0.35 * Math.sin(Math.PI * t) - 0.06, z, 0.07, 0.09, 0.07, 2, 0, [1.6, 1.25, 0.65]));
      }
    }
    lightString(9.5, 4.35); lightString(1.0, 4.15);
    // cat eyes blinking in the stoop doorway
    var matCatEye = PS1.privateFlicker(ps1Material(PS1.solidTexture(190, 235, 130)));
    scene.add(boxMesh(matCatEye, -4.14, 0.42, 12.15, 0.02, 0.025, 0.015, 2, 0, [1.4, 1.7, 0.9]));
    scene.add(boxMesh(matCatEye, -4.14, 0.42, 12.45, 0.02, 0.025, 0.015, 2, 0, [1.4, 1.7, 0.9]));
    // cyber-yellow fire hydrant
    scene.add(cs(prismMesh(ps1Material(PS1.solidTexture(215, 185, 40)), 3.3, -12.6, 0.14, 0.55, 6, 1.5, 0.8)));
    scene.add(cs(boxMesh(ps1Material(PS1.solidTexture(215, 185, 40)), 3.3, 0.6, -12.6, 0.3, 0.12, 0.3, 1.5)));
    // locker row against the west wall
    (function () {
      var matLocker = ps1Material(PS1.solidTexture(70, 76, 84));
      for (var l = 0; l < 3; l++) {
        scene.add(cs(boxMesh(matLocker, -3.85, 0.9, -14.6 + l * 0.5, 0.45, 1.8, 0.46, 1.4)));
        scene.add(boxMesh(matMetal, -3.62, 1.1, -14.6 + l * 0.5, 0.02, 0.3, 0.06, 2));
      }
      colliders.push({ x0: -4.1, z0: -14.95, x1: -3.6, z1: -13.0 });
    })();
    // big caged wall fan
    (function () {
      var fan = prismMesh(matMetal, 0, 0, 0.8, 0.12, 8, 2.4, 0.5, null, 0);
      fan.rotation.y = Math.PI / 2;
      fan.position.set(4.14, 6.2, -5.5);
      scene.add(fan);
      for (var bar = 0; bar < 3; bar++) {
        scene.add(boxMesh(matMetal, 4.06, 6.2, -5.5 - 0.5 + bar * 0.5, 0.04, 1.3, 0.05, 2, 0, [0.16, 0.17, 0.19]));
      }
    })();
    // two more cable catenaries + transformer on the pole
    [[6.4, -10.5], [5.0, 7.0]].forEach(function (cab) {
      var y = cab[0], z = cab[1];
      for (var sg = 0; sg < 4; sg++) {
        var xa = -4.2 + 8.4 * sg / 4, xb = -4.2 + 8.4 * (sg + 1) / 4;
        var ym = y - 0.45 * Math.sin(Math.PI * (sg + 0.5) / 4);
        scene.add(boxMesh(matMetal, (xa + xb) / 2, ym, z, xb - xa + 0.02, 0.026, 0.026, 4, 0, [0.04, 0.04, 0.05]));
      }
    });
    scene.add(cs(boxMesh(matMetal, 5.9, 5.1, -2, 0.6, 0.55, 0.45, 1.3)));
    scene.add(prismMesh(matMetal, 5.9, -2.35, 0.05, 0.16, 6, 1, 0.4, null, 5.35));
    scene.add(prismMesh(matMetal, 5.9, -1.65, 0.05, 0.16, 6, 1, 0.4, null, 5.35));
    // newspaper box
    scene.add(cs(boxMesh(matMetal, -3.9, 0.5, 11.8, 0.5, 0.9, 0.4, 1.3)));
    scene.add(boxMesh(ps1Material(PS1.solidTexture(210, 205, 195)), -3.64, 0.62, 11.8, 0.02, 0.35, 0.26, 2, 0, [0.8, 0.78, 0.72]));
    colliders.push({ x0: -4.2, z0: 11.5, x1: -3.6, z1: 12.1 });
    // dumpster near the south entrance
    (function () {
      var matDump = ps1Material(PS1.solidTexture(40, 78, 58));
      scene.add(cs(boxMesh(matDump, 3.4, 0.65, 14.6, 1.3, 1.2, 0.85, 1.4)));
      scene.add(cs(boxMesh(matDump, 3.4, 1.32, 14.6, 1.36, 0.12, 0.9, 1.4, 0.06)));
      colliders.push({ x0: 2.7, z0: 14.1, x1: 4.1, z1: 15.1 });
    })();
    // second steam vent mid-alley
    scene.add(boxMesh(matMetal, -1.8, 0.02, -13.5, 0.9, 0.05, 0.6, 1.5));
    var steam2 = PS1.makeParticles({
      mode: 'steam', count: 70, color: [0.36, 0.38, 0.45],
      size: 0.05, speed: 0.85, sway: 0.2,
      area: [-2.25, -1.35, -13.9, -13.1, 2.6]
    });
    scene.add(steam2);
    // extra graffiti + puddles
    decals.wall(-4.16, 1.2, 6.9, true, 1.0, 0.4, PS1.decalMaterial(0.2, 0.7, 0.3, 0.4));
    decals.wall(4.16, 1.1, -9.8, true, 0.9, 0.45, PS1.decalMaterial(0.85, 0.5, 0.1, 0.4));
    decals.oct(-0.8, -6.4, 0.9, PS1.decalMaterial(0.04, 0.04, 0.07, 0.6), 0.004, 96);
    decals.oct(1.0, 9.8, 0.7, PS1.decalMaterial(0.05, 0.05, 0.085, 0.55), 0.004, 97);
    // roof antenna
    scene.add(cs(boxMesh(matMetal, -4.0, 12.4, 12.8, 0.05, 1.6, 0.05, 2)));
    scene.add(boxMesh(matMetal, -4.0, 13.3, 12.8, 0.6, 0.04, 0.04, 2));

    // ---------------- v6 detail pass ------------------------------------
    // posters + graffiti (Bayer-dithered colour patches on the walls)
    var matPoster1 = PS1.decalMaterial(0.68, 0.24, 0.18, 0.88);
    var matPoster2 = PS1.decalMaterial(0.20, 0.56, 0.68, 0.85);
    var matPoster3 = PS1.decalMaterial(0.88, 0.70, 0.16, 0.88);
    var matGraf = PS1.decalMaterial(0.90, 0.25, 0.75, 0.42);
    decals.wall(-4.16, 2.1, 3.0, true, 1.1, 1.4, matPoster1);
    decals.wall(-4.16, 1.6, 10.8, true, 0.9, 1.2, matPoster2);
    decals.wall(-4.16, 2.0, -8.6, true, 1.2, 0.9, matPoster3);
    decals.wall(4.16, 2.3, 9.4, true, 1.2, 0.5, matGraf);
    decals.wall(4.16, 1.7, -3.8, true, 1.0, 1.3, matPoster1);
    // trash bag pile by the west vending machine
    var matBag = ps1Material(PS1.solidTexture(22, 22, 26));
    scene.add(PS1.blobMesh(matBag, -3.55, 0.28, 1.6, 0.30, 0.9, 0.3, function () { return [1, 1, 1]; }));
    scene.add(PS1.blobMesh(matBag, -3.3, 0.22, 2.05, 0.24, 1.0, 0.3, function () { return [0.92, 0.92, 1]; }));
    scene.add(PS1.blobMesh(matBag, -3.6, 0.52, 1.85, 0.22, 0.95, 0.3, function () { return [1, 1, 1.05]; }));
    // flattened cardboard boxes
    var matBox = ps1Material(PS1.solidTexture(122, 92, 58));
    scene.add(cs(boxMesh(matBox, 3.5, 0.12, -12.4, 0.55, 0.22, 0.6, 1.4, 0.18)));
    scene.add(cs(boxMesh(matBox, 3.45, 0.37, -12.3, 0.5, 0.22, 0.55, 1.4, -0.25)));
    colliders.push({ x0: 3.1, z0: -12.8, x1: 3.9, z1: -11.9 });
    // bicycle locked to a power pole
    (function () {
      var matBike = ps1Material(PS1.solidTexture(70, 110, 150));
      var bx = 5.65, bz = -1.6;
      [-0.52, 0.52].forEach(function (w) {
        var wheel = prismMesh(matMetal, 0, 0, 0.30, 0.05, 8, 1.8, 0.3, null, 0);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(bx + w * 0.5, 0.33, bz);
        scene.add(wheel);
      });
      scene.add(boxMesh(matBike, bx - 0.2, 0.60, bz, 0.9, 0.05, 0.05, 2, 0.14));
      scene.add(boxMesh(matBike, bx - 0.2, 0.46, bz, 0.05, 0.42, 0.05, 2));
    })();
    // two extra neon strips (one with a dying ballast)
    var matStripA = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 120, 200)));
    var matStripB = ps1Material(PS1.solidTexture(90, 255, 240));
    scene.add(boxMesh(matStripA, -4.10, 2.05, 6.4, 0.05, 0.08, 1.6, 2, 0, [1.2, 0.45, 0.9]));
    scene.add(boxMesh(matStripB, 4.10, 3.4, -8.4, 0.05, 0.08, 1.2, 2, 0, [0.4, 1.2, 1.1]));
    // satellite dishes on the wall tops
    [[-4.0, 8.6, 7.4], [4.0, 9.4, 8.2]].forEach(function (d) {
      scene.add(cs(boxMesh(matMetal, d[0], d[2] + 0.25, d[1], 0.08, 0.5, 0.08, 2)));
      var dish = prismMesh(matMetal, 0, 0, 0.30, 0.07, 8, 2, 0.3, null, 0);
      dish.rotation.x = -0.9;
      dish.rotation.y = d[0] < 0 ? 0.7 : -0.7;
      dish.position.set(d[0], d[2] + 0.72, d[1]);
      scene.add(dish);
    });
    // stoop: steps + door + slab awning on the west wall
    scene.add(boxMesh(matConcrete, -3.8, 0.09, 12.3, 1.4, 0.18, 1.3, 1.2));
    scene.add(boxMesh(matConcrete, -3.55, 0.25, 12.3, 1.1, 0.14, 1.0, 1.2));
    scene.add(boxMesh(matMetal, -4.13, 1.18, 12.3, 0.10, 2.1, 1.0, 1.6));
    scene.add(boxMesh(matShutter, -3.95, 2.45, 12.3, 0.75, 0.05, 1.35, 1.2));
    colliders.push({ x0: -4.15, z0: 11.6, x1: -3.35, z1: 13.0 });
    // wall vent fan + utility boxes
    (function () {
      var fan = prismMesh(matMetal, 0, 0, 0.34, 0.06, 8, 2, 0.3, null, 0);
      fan.rotation.y = Math.PI / 2;
      fan.position.set(4.14, 3.1, 2.6);
      scene.add(fan);
      decals.wall(4.165, 3.1, 2.6, true, 0.4, 0.4, PS1.decalMaterial(0.02, 0.02, 0.03, 0.85));
    })();
    scene.add(boxMesh(matMetal, -4.12, 1.5, 6.9, 0.10, 0.3, 0.4, 1.4));
    scene.add(boxMesh(matMetal, -4.12, 1.4, -4.9, 0.10, 0.26, 0.34, 1.4));
    // umbrella abandoned by the vending machine
    (function () {
      var matUmb = ps1Material(PS1.solidTexture(198, 60, 88));
      var canopy = prismMesh(matUmb, 0, 0, 0.5, 0.10, 8, 2.2, 0.4, null, 0);
      canopy.rotation.z = 0.5;
      canopy.position.set(-3.15, 0.85, 0.9);
      scene.add(canopy);
      scene.add(boxMesh(matMetal, -3.32, 0.55, 0.83, 0.05, 1.1, 0.05, 2, 0.5));
    })();
    // puddles + neon light pools on wet ground
    decals.oct(-1.6, 6.4, 1.3, PS1.decalMaterial(0.05, 0.05, 0.085, 0.62), 0.004, 90);
    decals.oct(2.2, 4.2, 1.1, PS1.decalMaterial(0.03, 0.09, 0.11, 0.5), 0.004, 91);
    decals.oct(0.4, -3.4, 1.5, PS1.decalMaterial(0.10, 0.045, 0.10, 0.45), 0.004, 92);
    decals.oct(-2.6, -7.2, 1.0, PS1.decalMaterial(0.10, 0.09, 0.03, 0.5), 0.004, 93);
    decals.oct(1.2, 0.5, 1.4, PS1.decalMaterial(0.30, 0.08, 0.07, 0.3), 0.004, 94);      // red pool under sake sign
    decals.oct(2.4, 5.1, 1.2, PS1.decalMaterial(0.04, 0.30, 0.32, 0.3), 0.004, 95);      // cyan pool
    scene.add(decals.blobGroup); scene.add(decals.decalGroup);

    // rain + steam
    var rain = PS1.makeParticles({
      mode: 'rain', count: 520, color: [0.62, 0.70, 0.86],
      size: 0.012, speed: 16, sway: -0.35,
      area: [-4, 4, -18, 16, 11]
    });
    var steam = PS1.makeParticles({
      mode: 'steam', count: 90, color: [0.36, 0.38, 0.45],
      size: 0.05, speed: 0.8, sway: 0.2,
      area: [1.3, 2.3, 3.1, 4.1, 2.6]
    });
    scene.add(rain); scene.add(steam);

    return {
      name: '赛博朋克雨巷',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -3.35, x1: 3.35, z0: -18.2, z1: 16.2 },
      spawn: [0.9, 14.6, Math.atan2(-(-0.6 - 0.9), -(-7 - 14.6)), 0.03],
      idle: { pos: [0.9, 1.62, 14.6], target: [-0.6, 2.3, -7] },
      fog: { color: [0.105, 0.085, 0.15], near: 7, far: 38 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [rain, steam, steam2],
      update: function (t) {
        // the noodle sign has a bad ballast
        var f = (Math.sin(t * 31.7) > 0.92 || Math.sin(t * 7.3) > 0.995) ? 0.25 : 0.92 + 0.08 * Math.sin(t * 47);
        matNeonMen.uniforms.uFlicker.value = f;
        matTube.uniforms.uFlicker.value = 0.9 + 0.1 * Math.sin(t * 13.3);
        matStripA.uniforms.uFlicker.value = Math.sin(t * 17.3) > 0.7 ? 0.2 : (0.8 + 0.2 * Math.sin(t * 5.1));
        marqueeTex.offset.x = -t * 0.22;
        matBulbStr.uniforms.uFlicker.value = 0.88 + 0.12 * Math.sin(t * 11.3) * Math.sin(t * 2.9);
        matCatEye.uniforms.uFlicker.value = ((t * 0.21) % 1 < 0.86) ? 1 : 0.05;
      }
    };
  });
})();
