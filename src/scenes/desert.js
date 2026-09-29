(function () {
  'use strict';
  // ======================= 大漠驿站（正午硬光） ========================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function sandCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 8, 9, 3);
      var rip = Math.sin((y + Math.sin(x * 0.16) * 7) * 0.42);
      var r = 216 + n * 30 + rip * 7, g = 182 + n * 26 + rip * 6, b = 134 + n * 22 + rip * 5;
      var sp = hash2(x + 11, y + 4);
      if (sp > 0.99) { r = 250; g = 236; b = 200; }               // quartz glints
      else if (sp < 0.02) { r *= 0.8; g *= 0.78; b *= 0.74; }      // pebbles
      return [r, g, b];
    });
  }
  function sandstoneCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var band = Math.floor(y / 13);
      var n = vnoise(x / 7, y / 7, 7, 2);
      var base = 158 + band * 6 % 30;
      var r = base * 1.06 + n * 24, g = base * 0.78 + n * 18, b = base * 0.58 + n * 14;
      if (y % 13 < 1) { r *= 0.7; g *= 0.68; b *= 0.62; }
      var sp = hash2(x + 21, y + 9);
      if (sp < 0.06) { r *= 0.82; g *= 0.82; b *= 0.8; }
      return [r, g, b];
    });
  }
  function tentCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var stripe = Math.floor((x + Math.floor(y / 64) * 0) / 11) % 2 === 0;
      var n = vnoise(x / 9, y / 9, 6, 2);
      var r, g, b;
      if (stripe) { r = 205 + n * 26; g = 172 + n * 22; b = 116 + n * 18; }
      else { r = 146 + n * 24; g = 74 + n * 16; b = 52 + n * 12; }
      var worn = vnoise(x / 14 + 3, y / 14, 4, 2);
      if (worn > 0.72) { var k = (worn - 0.72) * 1.4; r *= 1 - k * 0.35; g *= 1 - k * 0.35; b *= 1 - k * 0.3; }
      return [r, g, b];
    });
  }
  function palmTrunkCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var seg = Math.floor(y / 9);
      var n = vnoise(x / 5, y / 6, 7, 2);
      var r = 122 + n * 26, g = 92 + n * 20, b = 58 + n * 14;
      if (y % 9 < 1) { r *= 0.6; g *= 0.58; b *= 0.52; }
      var tint = (hash2(seg, 7) * 2 - 1) * 8;
      return [r + tint, g + tint * 0.8, b + tint * 0.6];
    });
  }
  function frondCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 4, y / 6, 8, 2);
      var r = 40 + n * 40, g = 92 + n * 66, b = 36 + n * 30;
      if (y % 7 < 1) { r *= 0.6; g *= 0.62; b *= 0.6; }
      return [r, g, b];
    });
  }
  function carpetCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var diamond = (Math.abs(((x + y) % 32) - 16) + Math.abs(((x - y + 64) % 32) - 16)) < 9;
      var border = (x < 6 || x > 57 || y < 6 || y > 57);
      if (border) return [148, 44, 40];
      if (diamond) return [196, 158, 62];
      return [42, 58, 96];
    });
  }

  var sandTex = texFrom(sandCanvas());
  var sandstoneTex = texFrom(sandstoneCanvas());
  var tentTex = texFrom(tentCanvas());
  var palmTrunkTex = texFrom(palmTrunkCanvas());
  var frondTex = texFrom(frondCanvas());
  var carpetTex = texFrom(carpetCanvas());

  var matSand = ps1Material(sandTex);
  var matStone = ps1Material(sandstoneTex);
  var matTent = ps1Material(tentTex);
  var matPalm = ps1Material(palmTrunkTex);
  var matFrond = ps1Material(frondTex);
  var matCarpet = ps1Material(carpetTex);

  var SUN = new THREE.Vector3(0.12, 0.95, 0.18).normalize();   // near-zenith: short hard shadows
  var SUN_COL = [1.38, 1.22, 0.94];
  var SKY_AMB = [0.38, 0.40, 0.44];
  var GND_AMB = [0.52, 0.44, 0.33];                             // sand bounce is warm
  var desertRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = SUN_COL[0] * ndl * 0.92 + GND_AMB[0] + (SKY_AMB[0] - GND_AMB[0]) * hemi;
    var g = SUN_COL[1] * ndl * 0.92 + GND_AMB[1] + (SKY_AMB[1] - GND_AMB[1]) * hemi;
    var b = SUN_COL[2] * ndl * 0.92 + GND_AMB[2] + (SKY_AMB[2] - GND_AMB[2]) * hemi;
    return [Math.min(1.25, r), Math.min(1.2, g), Math.min(1.1, b)];
  };

  PS1.registerScene(function () {
    setRelight(desertRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var sun = new THREE.DirectionalLight(0xfff2d0, 1);
    sun.position.copy(SUN).multiplyScalar(34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 75;
    sun.shadow.camera.left = -21; sun.shadow.camera.right = 21;
    sun.shadow.camera.top = 21; sun.shadow.camera.bottom = -21;
    sun.shadow.bias = -0.004; sun.shadow.normalBias = 0.05;
    scene.add(sun); scene.add(sun.target);

    scene.add(PS1.makeSky({
      top: [0.22, 0.44, 0.76], horizon: [0.82, 0.74, 0.55], bottom: [0.66, 0.56, 0.42],
      sunDir: SUN.toArray(), sunCol: [1.4, 1.35, 1.1], sunCut: 0.9993, sunGlow: 0.22,
      stars: 0, meteors: 0, radius: 90
    }));

    scene.add(PS1.groundGrid(matSand, 0, 0, 40, 34, 12, 1, 0, 1));

    // ---------------- sandstone mesas (backdrop) -----------------------
    function mesa(x, z, w, h) {
      for (var lv = 0; lv < 3; lv++) {
        var s = 1 - lv * 0.26;
        scene.add(cs(boxMesh(matStone, x, h * (0.22 + lv * 0.3), z, w * s, h * 0.34, w * 0.7 * s, 0.9)));
      }
      scene.add(cs(boxMesh(matStone, x, h * 1.06, z, w * 0.38, h * 0.14, w * 0.26, 0.9)));  // cap rock
    }
    mesa(-22, -18, 9, 7.5); mesa(24, -14, 7, 5.5); mesa(-26, 10, 6, 4.5); mesa(20, 16, 8, 6);

    // ---------------- oasis pool + reeds -------------------------------
    (function () {
      var ox = -8.5, oz = 2.0;
      scene.add(PS1.groundGrid(ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var w1 = Math.sin((x + Math.sin(y * 0.3) * 5) * 0.4) + Math.sin((y + Math.sin(x * 0.24) * 6) * 0.3 + 1.8);
        var k = 0.8 + 0.12 * w1;
        var r = 36 * k, g = 92 * k, b = 86 * k;
        if (w1 > 1.6) { r += 60; g += 90; b += 82; }
        return [r, g, b];
      }))), ox, oz, 4.4, 3.4, 2, 0.8, 0.06, 1));
      [[-2.4, -1.5], [-2.6, 0.6], [-2.2, 1.4], [2.5, -1.2], [2.3, 1.0]].forEach(function (rr) {
        for (var rd = 0; rd < 4; rd++) {
          scene.add(boxMesh(matFrond, ox + rr[0] + (rd % 2) * 0.1, 0.55, oz + rr[1], 0.05, 1.1, 0.05, 3, (rd - 1.5) * 0.14));
        }
      });
      colliders.push({ x0: ox - 2.4, z0: oz - 1.8, x1: ox + 2.4, z1: oz + 1.8 });
    })();

    // ---------------- palm trees --------------------------------------
    function palm(x, z, s, lean) {
      var segs = 3;
      for (var sg = 0; sg < segs; sg++) {
        var hh = 1.5 * s;
        var px = x + lean * sg * 0.5 * s, py = 0.15 + sg * hh, pz = z;
        var trunk = prismMesh(matPalm, 0, 0, 0.15 * s, hh, 6, 1.4, 2, null, 0);
        trunk.position.set(px, py, pz);
        trunk.rotation.z = lean * 0.24;
        scene.add(cs(trunk));
      }
      var topX = x + lean * segs * 0.5 * s, topY = 0.15 + segs * 1.5 * s;
      for (var f = 0; f < 7; f++) {
        var holder = boxMesh(matFrond, 0.85 * s, 0, 0, 1.7 * s, 0.05, 0.34 * s, 1.4, 0.28);  // geometry at origin
        holder.position.set(topX, topY + 0.1, z);
        holder.rotation.y = f / 7 * Math.PI * 2;
        holder.rotation.z = 0.28;
        scene.add(cs(holder));
      }
      // coconuts
      [[0.14, 0], [-0.1, 0.12], [-0.06, -0.14]].forEach(function (c) {
        scene.add(blobMesh(ps1Material(PS1.solidTexture(96, 74, 48)), topX + c[0], topY - 0.08, z + c[1], 0.11, 1.0, 0.2, function () { return [1, 0.9, 0.8]; }));
      });
      colliders.push({ x0: x - 0.3, z0: z - 0.3, x1: x + 0.3, z1: z + 0.3 });
    }
    palm(-5.4, 5.6, 1.0, 0.22); palm(-10.6, 0.2, 0.9, -0.3); palm(-10.4, -2.2, 1.05, 0.1); palm(6.8, -6.2, 0.95, -0.2);

    // ---------------- bedouin camp ------------------------------------
    function bigTent(x, z, rot) {
      // ridge tent: two sloped canvas sides + back wall, striped fabric
      var g = new THREE.Group();
      g.add(cs(quadCorners(matTent,
        [x - 2.6, 0, z], [x + 2.6, 0, z], [x + 2.6, 2.4, z - 2.2], [x - 2.6, 2.4, z - 2.2], 3, 2)));
      g.add(cs(quadCorners(matTent,
        [x - 2.6, 0, z - 4.4], [x + 2.6, 0, z - 4.4], [x + 2.6, 2.4, z - 2.2], [x - 2.6, 2.4, z - 2.2], 3, 2)));
      // poles + ridge
      g.add(cs(boxMesh(matPalm, x - 2.2, 1.2, z - 2.2, 0.1, 2.4, 0.1, 2)));
      g.add(cs(boxMesh(matPalm, x + 2.2, 1.2, z - 2.2, 0.1, 2.4, 0.1, 2)));
      g.add(boxMesh(matPalm, x, 2.42, z - 2.2, 4.9, 0.09, 0.09, 2));
      scene.add(g);
      void rot;
      colliders.push({ x0: x - 2.7, z0: z - 4.5, x1: x + 2.7, z1: z + 0.1 });
    }
    bigTent(0.5, -5.5, 0);
    // small shade awning on poles + carpet + cushions
    (function () {
      var ax = 3.5, az = 1.5;
      [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]].forEach(function (p) {
        scene.add(cs(boxMesh(matPalm, ax + p[0], 1.05, az + p[1], 0.09, 2.1, 0.09, 2)));
      });
      scene.add(cs(quadCorners(matTent, [ax - 2.0, 2.12, az - 1.3], [ax + 2.0, 2.12, az - 1.3],
        [ax + 2.0, 1.98, az + 1.3], [ax - 2.0, 1.98, az + 1.3], 4, 2)));
      var rug = PS1.quadMesh(matCarpet, 0, 0, 0, 0, 1, 0, 3.0, 2.0, 1, 1);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(ax, 0.02, az);
      scene.add(rug);
      [[-0.8, 0], [0.1, 0.4], [0.9, -0.2]].forEach(function (c) {
        scene.add(blobMesh(matCarpet, ax + c[0], 0.14, az + c[1], 0.26, 0.55, 0.25, function (sd) { return sd > 0.5 ? [1.1, 0.9, 0.5] : [0.5, 0.35, 0.55]; }));
      });
      colliders.push({ x0: ax - 1.8, z0: az - 1.3, x1: ax + 1.8, z1: az + 1.3 });
    })();
    // low table with brass pot + cups
    (function () {
      var tx = 3.5, tz = 0.2;
      scene.add(boxMesh(matPalm, tx, 0.24, tz, 1.1, 0.08, 0.7, 1.4));
      var matBrass = ps1Material(PS1.solidTexture(196, 150, 66));
      scene.add(prismMesh(matBrass, tx, tz, 0.14, 0.26, 8, 1.8, 0.6, null, 0.28));
      scene.add(prismMesh(matBrass, tx - 0.35, tz + 0.1, 0.06, 0.1, 6, 1.4, 0.4, null, 0.28));
      scene.add(prismMesh(matBrass, tx + 0.35, tz + 0.1, 0.06, 0.1, 6, 1.4, 0.4, null, 0.28));
    })();

    // ---------------- camels ------------------------------------------
    function camel(x, z, resting) {
      var matCamel = ps1Material(PS1.solidTexture(196, 158, 106));
      var bodyY = resting ? 0.62 : 1.05;
      scene.add(blobMesh(matCamel, x, bodyY, z, 0.62, 0.75, 0.2, function (sd) { return [1, 0.95, 0.85]; }));
      scene.add(blobMesh(matCamel, x - 0.22, bodyY + 0.42, z, 0.26, 1.0, 0.25, function () { return [0.98, 0.9, 0.8]; }));
      scene.add(blobMesh(matCamel, x + 0.25, bodyY + 0.4, z, 0.26, 1.0, 0.25, function () { return [0.98, 0.9, 0.8]; }));
      // neck + head
      scene.add(boxMesh(matCamel, x + 0.72, bodyY + 0.5, z, 0.18, 0.9, 0.22, 2, 0.35));
      scene.add(boxMesh(matCamel, x + 1.02, bodyY + 0.92, z, 0.34, 0.22, 0.2, 2));
      var legH = resting ? 0.28 : 0.72;
      [[-0.38, -0.2], [0.42, -0.2], [-0.38, 0.2], [0.42, 0.2]].forEach(function (l) {
        scene.add(boxMesh(matCamel, x + l[0], legH / 2 + (resting ? 0.02 : 0.08), z + l[1], 0.13, legH, 0.13, 1.4, resting ? (l[0] < 0 ? 1.35 : -1.35) * 0.35 : 0));
      });
      colliders.push({ x0: x - 0.9, z0: z - 0.45, x1: x + 1.2, z1: z + 0.45 });
    }
    camel(-3.6, 3.6, true); camel(5.8, 3.4, false);

    // ---------------- caravan goods ------------------------------------
    // amphorae
    [[-1.6, -8.6], [-1.1, -8.9], [-1.4, -8.2]].forEach(function (a) {
      var matClay = ps1Material(PS1.solidTexture(178, 96, 58));
      scene.add(prismMesh(matClay, a[0], a[1], 0.22, 0.62, 8, 2, 0.9));
      scene.add(prismMesh(matClay, a[0], a[1], 0.10, 0.14, 6, 1.2, 0.4, null, 0.62));
    });
    // rolled carpets
    for (var rc = 0; rc < 3; rc++) {
      var roll = prismMesh(matCarpet, 0, 0, 0.14, 1.5, 6, 1.4, 2, null, 0);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(1.8, 0.15 + rc * 0.3, -8.4);
      scene.add(roll);
    }
    // sacks + fire pit with kettle
    [[2.6, -8.8], [3.1, -8.5]].forEach(function (sb) {
      scene.add(blobMesh(ps1Material(PS1.solidTexture(196, 172, 130)), sb[0], 0.26, sb[1], 0.3, 1.0, 0.25, function () { return [1, 0.96, 0.9]; }));
    });
    (function () {
      var fx = 6.0, fz = -3.4;
      for (var st = 0; st < 7; st++) {
        var a = st / 7 * Math.PI * 2;
        scene.add(boxMesh(matStone, fx + Math.cos(a) * 0.5, 0.08, fz + Math.sin(a) * 0.5, 0.22, 0.16, 0.18, 1.2, a));
      }
      scene.add(prismMesh(ps1Material(PS1.solidTexture(40, 34, 30)), fx, fz, 0.24, 0.16, 6, 1.6, 0.4, null, 0.02));
      var matKettle = ps1Material(PS1.solidTexture(60, 58, 56));
      scene.add(prismMesh(matKettle, fx, fz, 0.16, 0.22, 7, 1.6, 0.5, null, 0.2));
    })();
    // dry shrubs
    [[11.5, 2.5], [-13.5, -6.5], [13.0, 8.5], [-4.5, 9.5]].forEach(function (sh) {
      scene.add(blobMesh(ps1Material(PS1.solidTexture(158, 132, 74)), sh[0], 0.24, sh[1], 0.34, 0.7, 0.5, function (sd) { return [1, 0.92, 0.75]; }));
    });
    // trampled campground
    decals.oct(0.5, -3.0, 4.6, PS1.decalMaterial(0.66, 0.52, 0.36, 0.5), 0.006, 50);


    // ---------------- v8 detail pass ------------------------------------
    // caravan cart loaded with wares
    (function () {
      var cx2 = -4.5, cz2 = -6.5;
      scene.add(cs(boxMesh(matPalm, cx2, 0.55, cz2, 1.5, 0.14, 2.4, 1.5)));
      [[-0.62, -0.95], [0.62, -0.95], [-0.62, 0.95], [0.62, 0.95]].forEach(function (w2) {
        scene.add(boxMesh(matPalm, cx2 + w2[0], 0.28, cz2 + w2[1], 0.09, 0.55, 0.09, 2));
      });
      var wheel3 = prismMesh(matPalm, 0, 0, 0.5, 0.1, 8, 2.2, 0.5, null, 0);
      wheel3.rotation.z = Math.PI / 2;
      wheel3.position.set(cx2 - 0.85, 0.5, cz2);
      scene.add(cs(wheel3));
      var wheel4 = prismMesh(matPalm, 0, 0, 0.5, 0.1, 8, 2.2, 0.5, null, 0);
      wheel4.rotation.z = Math.PI / 2;
      wheel4.position.set(cx2 + 0.85, 0.5, cz2);
      scene.add(cs(wheel4));
      scene.add(prismMesh(matCarpet, cx2 - 0.3, 0.72, cz2, 0.3, 6, 1.6, 0.6, null, 0));       // rolled cargo
      scene.add(blobMesh(ps1Material(PS1.solidTexture(196, 172, 130)), cx2 + 0.35, 0.72, cz2, 0.28, 0.8, 0.3, function () { return [1, 0.96, 0.9]; }));
      colliders.push({ x0: cx2 - 1.0, z0: cz2 - 1.35, x1: cx2 + 1.0, z1: cz2 + 1.35 });
    })();
    // flat spice display blanket + cone piles
    (function () {
      var sx = 1.6, sz = -7.6;
      var rug2 = PS1.quadMesh(matTent, 0, 0, 0, 0, 1, 0, 1.9, 1.3, 1, 1);
      rug2.rotation.x = -Math.PI / 2;
      rug2.position.set(sx, 0.015, sz);
      scene.add(rug2);
      var cols3 = [[188, 72, 40], [90, 120, 60], [200, 160, 60], [130, 60, 110]];
      [[-0.5, -0.25], [-0.1, 0.2], [0.35, -0.2], [0.6, 0.3]].forEach(function (sp, i3) {
        var m = ps1Material(PS1.solidTexture(cols3[i3][0], cols3[i3][1], cols3[i3][2]));
        var pile = prismMesh(m, 0, 0, 0.16, 0.24, 7, 1.4, 0.5, null, 0);
        pile.position.set(sx + sp[0], 0.015, sz + sp[1]);
        scene.add(pile);
      });
    })();
    // goats tethered by the oasis
    function goat(x, z) {
      var matGoat = ps1Material(PS1.solidTexture(168, 150, 122));
      scene.add(blobMesh(matGoat, x, 0.36, z, 0.26, 0.85, 0.25, function () { return [1, 0.97, 0.9]; }));
      scene.add(boxMesh(matGoat, x + 0.3, 0.5, z, 0.2, 0.18, 0.16, 2));
      [[-0.16, -0.1], [0.2, -0.1], [-0.16, 0.1], [0.2, 0.1]].forEach(function (l) {
        scene.add(boxMesh(matGoat, x + l[0], 0.14, z + l[1], 0.05, 0.28, 0.05, 2));
      });
    }
    goat(-4.6, 5.2); goat(-5.6, 5.8);
    // flat-bread pile + teapot set on a low tray
    (function () {
      var matBread2 = ps1Material(PS1.solidTexture(216, 178, 110));
      [[0, 0], [0.16, 0.1], [-0.15, 0.08]].forEach(function (b, i4) {
        var flat = prismMesh(matBread2, 0, 0, 0.13, 0.05, 8, 1.6, 0.3, null, 0);
        flat.position.set(4.15 + b[0], 0.29 + i4 * 0.05, -7.9 + b[1]);
        scene.add(flat);
      });
      var matBrass2 = ps1Material(PS1.solidTexture(200, 154, 70));
      scene.add(prismMesh(matBrass2, 4.7, -7.4, 0.09, 0.2, 7, 1.5, 0.5, null, 0.26));
      scene.add(prismMesh(matBrass2, 4.45, -7.5, 0.05, 0.09, 6, 1.3, 0.4, null, 0.26));
    })();
    // woven baskets
    [[-1.9, -6.6], [-2.5, -6.2], [7.6, -7.4]].forEach(function (bk) {
      scene.add(prismMesh(matCarpet, bk[0], bk[1], 0.24, 0.3, 7, 1.8, 0.6, null, 0));
    });
    // water skins hanging on a rack
    (function () {
      var rx = 6.8, rz = -6.6;
      scene.add(cs(boxMesh(matPalm, rx, 0.8, rz, 0.08, 1.6, 0.08, 2)));
      scene.add(boxMesh(matPalm, rx, 1.5, rz, 1.1, 0.08, 0.08, 2));
      [[-0.35, 0], [0.25, 0]].forEach(function (h2) {
        scene.add(blobMesh(ps1Material(PS1.solidTexture(122, 92, 62)), rx + h2[0], 1.2, rz, 0.13, 1.2, 0.25, function () { return [1, 0.9, 0.75]; }));
      });
    })();
    // falcon perch
    (function () {
      var px2 = 8.6, pz2 = 4.8;
      scene.add(cs(boxMesh(matPalm, px2, 0.6, pz2, 0.08, 1.2, 0.08, 2)));
      scene.add(boxMesh(matPalm, px2, 1.24, pz2, 0.09, 0.09, 0.4, 2));
      var matFalcon = ps1Material(PS1.solidTexture(110, 90, 70));
      scene.add(blobMesh(matFalcon, px2, 1.36, pz2 - 0.1, 0.07, 1.0, 0.2, function () { return [1, 0.95, 0.85]; }));
      scene.add(boxMesh(matFalcon, px2, 1.38, pz2 - 0.17, 0.05, 0.045, 0.08, 2));
    })();
    // saddle rack by the tents + waterskin on sand
    scene.add(boxMesh(matPalm, -0.5, 0.5, -8.6, 0.9, 0.1, 0.35, 1.4, 0.2));
    scene.add(boxMesh(matPalm, -0.5, 0.25, -8.7, 0.5, 0.5, 0.08, 1.4));
    scene.add(blobMesh(ps1Material(PS1.solidTexture(122, 92, 62)), 2.9, 0.1, -6.7, 0.16, 0.5, 0.3, function () { return [0.95, 0.85, 0.7]; }));
    // small dunes (half-buried sand blobs) breaking the flat foreground
    [[-3.0, 9.0], [4.5, 8.0], [8.5, 1.5], [-8.0, -7.5]].forEach(function (d2, i5) {
      scene.add(blobMesh(matSand, d2[0], 0.1 + hash2(i5, 4) * 0.08, d2[1], 1.1 + hash2(i5, 8) * 0.6, 0.42, 0.4, function (sd) { return sd > 0.55 ? [1.04, 1.02, 1.0] : [1.0, 0.99, 0.97]; }));
    });

    // heat dust
    var dust = PS1.makeParticles({
      mode: 'dust', count: 140, color: [1.0, 0.95, 0.75],
      size: 0.026, speed: 1, sway: 0.5,
      area: [-13, 13, -11, 11, 2.2]
    });
    scene.add(dust);

    return {
      name: '大漠驿站',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -14.5, x1: 14.5, z0: -12.0, z1: 12.5 },
      spawn: [10.5, 10.2, Math.atan2(-(-2.5 - 10.5), -(-3.0 - 10.2)), 0.02],
      idle: { pos: [10.5, 1.62, 10.2], target: [-2.5, 1.7, -3.0] },
      fog: { color: [0.80, 0.72, 0.56], near: 30, far: 70 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [dust],
      update: function () {}
    };
  });
})();
