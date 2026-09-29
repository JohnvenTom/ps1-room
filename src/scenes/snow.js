(function () {
  'use strict';
  // ======================= 雪岭驿站（蓝调时分） ========================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function snowCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 7, 9, 3);
      var r = 218 + n * 34, g = 224 + n * 32, b = 236 + n * 24;
      var ripple = Math.sin(y * 0.35 + Math.sin(x * 0.09) * 2.4);
      if (ripple > 0.72) { r *= 0.94; g *= 0.945; b *= 0.97; }       // drift shadows
      else if (ripple < -0.78) { r *= 1.05; g *= 1.05; b *= 1.03; }  // crest glints
      var sp = hash2(x + 5, y + 33);
      if (sp > 0.985) { r = 255; g = 255; b = 255; }                 // sparkles
      return [r, g, b];
    });
  }
  function logCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var log = Math.floor(y / 11);
      var grain = vnoise(x / 26, (y + log * 29) / 3.0, 8, 2);
      var tint = (hash2(log, 13) * 2 - 1) * 10;
      var r = 118 + tint, g = 84 + tint * 0.8, b = 56 + tint * 0.6;
      r *= 0.86 + grain * 0.28; g *= 0.86 + grain * 0.28; b *= 0.86 + grain * 0.28;
      if (y % 11 < 1) { r = 40; g = 30; b = 22; }
      var snowLine = vnoise(x / 10, log * 3 + 4, 4, 2);
      if (snowLine > 0.74 && (y % 11) > 1 && (y % 11) < 4) { r = 225; g = 231; b = 240; }  // snow caught on logs
      return [r, g, b];
    });
  }
  function roofSnowCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 9, 7, 2);
      var snow = y < 34 || n > 0.55;
      if (snow) { var s = 225 + n * 26; return [s, s + 4, s + 16]; }
      var r = 58 + n * 20, g = 46 + n * 16, b = 42 + n * 14;         // dark shingle underside
      if (y % 12 < 1) { r *= 0.6; g *= 0.6; b *= 0.6; }
      return [r, g, b];
    });
  }
  function pineCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 5, y / 5, 8, 2);
      var snow = n > 0.62;
      if (snow) return [222 + n * 26, 228 + n * 22, 240];
      var r = 22 + n * 26, g = 44 + n * 44, b = 34 + n * 30;
      var sp = hash2(x, y + 7);
      if (sp < 0.15) { r *= 0.7; g *= 0.7; b *= 0.7; }
      return [r, g, b];
    });
  }
  function metalColdCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 6, 2);
      var r = 88 + n * 26, g = 94 + n * 26, b = 106 + n * 28;
      if (x % 22 < 1) { r *= 0.72; g *= 0.72; b *= 0.72; }
      var rust = vnoise(x / 11 + 6, y / 11, 5, 2);
      if (rust > 0.76) { var k = (rust - 0.76) * 2.4; r += (96 - r) * k; g += (56 - g) * k; b += (40 - b) * k; }
      return [r, g, b];
    });
  }

  var snowTex = texFrom(snowCanvas());
  var logTex = texFrom(logCanvas());
  var roofSnowTex = texFrom(roofSnowCanvas());
  var pineTex = texFrom(pineCanvas());
  var metalColdTex = texFrom(metalColdCanvas());

  var matSnow = ps1Material(snowTex);
  var matLog = ps1Material(logTex);
  var matRoofSnow = ps1Material(roofSnowTex);
  var matPine = ps1Material(pineTex);
  var matMetalCold = ps1Material(metalColdTex);
  var matWindowWarm = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 205, 120)));
  var matLanternGlow = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 215, 140)));

  var MOON = new THREE.Vector3(0.24, 0.62, -0.32).normalize();
  var snow = { puffs: [] };   // particles created inside prop IIFEs register here
  var snowRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOON.x + ny * MOON.y + nz * MOON.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.50 * ndl + 0.44 + (0.62 - 0.44) * hemi;
    var g = 0.56 * ndl + 0.48 + (0.66 - 0.48) * hemi;
    var b = 0.68 * ndl + 0.56 + (0.76 - 0.56) * hemi;
    return [Math.min(1.12, r), Math.min(1.12, g), Math.min(1.16, b)];
  };

  PS1.registerScene(function () {
    setRelight(snowRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var moon = new THREE.DirectionalLight(0xaabbdd, 1);
    moon.position.copy(MOON).multiplyScalar(32);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 2; moon.shadow.camera.far = 75;
    moon.shadow.camera.left = -20; moon.shadow.camera.right = 20;
    moon.shadow.camera.top = 20; moon.shadow.camera.bottom = -20;
    moon.shadow.bias = -0.004; moon.shadow.normalBias = 0.05;
    scene.add(moon); scene.add(moon.target);

    scene.add(PS1.makeSky({
      top: [0.30, 0.38, 0.50], horizon: [0.66, 0.71, 0.79], bottom: [0.55, 0.60, 0.68],
      sunDir: MOON.toArray(), sunCol: [0, 0, 0], stars: 0, meteors: 0,
      radius: 90
    }));

    scene.add(PS1.groundGrid(matSnow, 0, 0, 38, 32, 11, 1, 0, 1));
    // distant ridge silhouettes (flat haze-tinted, same trick as the shrine)
    setRelight(function (x, y, z) { var k = 0.85 + y * 0.010; return [0.42 * k, 0.45 * k, 0.50 * k]; });
    [[-6, -44, 56, 13], [30, -30, 44, 10], [-38, 8, 40, 9], [8, 44, 52, 11]].forEach(function (m) {
      var mx = m[0], mz = m[1], mw = m[2], mh = m[3];
      scene.add(quadCorners(matSnow,
        [mx - mw / 2, -2, mz], [mx + mw / 2, -2, mz], [mx + mw / 6, mh, mz + mw / 3], [mx - mw / 6, mh * 0.8, mz + mw / 3]));
    });
    setRelight(snowRelight);

    // ---------------- main lodge --------------------------------------
    (function () {
      var lx = 0, lz = -7.5, H1 = 2.7, H2 = 2.4;
      scene.add(cs(boxMesh(matLog, lx, H1 / 2, lz, 9.5, H1, 6.5, 1.0)));
      scene.add(cs(boxMesh(matLog, lx, H1 + H2 / 2, lz, 10.2, H2, 7.0, 1.0)));      // overhung upper floor
      // snow-roofed gables, ridge along x
      var rh = 2.2, ry = H1 + H2;
      scene.add(cs(quadCorners(matRoofSnow,
        [lx - 5.9, ry, lz - 3.9], [lx + 5.9, ry, lz - 3.9],
        [lx + 5.2, ry + rh, lz], [lx - 5.2, ry + rh, lz], 6, 3)));
      scene.add(cs(quadCorners(matRoofSnow,
        [lx - 5.9, ry, lz + 3.9], [lx + 5.9, ry, lz + 3.9],
        [lx + 5.2, ry + rh, lz], [lx - 5.2, ry + rh, lz], 6, 3)));
      // warm windows both floors
      [-3.2, -1.1, 1.1, 3.2].forEach(function (wx) {
        scene.add(boxMesh(matWindowWarm, lx + wx, 1.7, lz + 3.34, 1.1, 1.0, 0.06, 2, 0, [1.5, 1.05, 0.5]));
      });
      [[-2.6], [2.6]].forEach(function (wx) {
        scene.add(boxMesh(matWindowWarm, lx + wx[0], H1 + 1.5, lz + 3.60, 1.2, 1.0, 0.06, 2, 0, [1.5, 1.05, 0.5]));
      });
      scene.add(boxMesh(matLog, lx, 1.05, lz + 3.28, 1.0, 2.0, 0.14, 2));          // door
      // chimney + smoke
      scene.add(cs(boxMesh(matMetalCold, lx + 3.0, ry + 1.5, lz - 0.8, 0.7, 2.2, 0.7, 1.4)));
      var smoke = PS1.makeParticles({
        mode: 'steam', count: 60, color: [0.62, 0.64, 0.68],
        size: 0.09, speed: 0.6, sway: 0.25,
        area: [lx + 2.5, lx + 3.5, lz - 1.3, lz - 0.3, 3.6]
      });
      scene.add(smoke);
      snow.puffs.push(smoke);
      // porch: posts + deck + lantern
      [-4.2, -1.4, 1.4, 4.2].forEach(function (px) {
        scene.add(cs(boxMesh(matLog, lx + px, 1.25, lz + 4.6, 0.16, 2.5, 0.16, 2)));
      });
      scene.add(boxMesh(matLog, lx, 0.18, lz + 4.6, 9.6, 0.36, 2.2, 1.2));
      scene.add(boxMesh(matLanternGlow, lx - 4.9, 2.6, lz + 4.6, 0.16, 0.24, 0.16, 2, 0, [1.7, 1.3, 0.6]));
      colliders.push({ x0: lx - 5.2, z0: lz - 3.6, x1: lx + 5.2, z1: lz + 5.8 });
      // icicles under the eaves
      for (var ic = 0; ic < 9; ic++) {
        var ix = lx - 5.5 + ic * 1.38;
        scene.add(prismMesh(matRoofSnow, 0, 0, 0.045, 0.3 + hash2(ic, 3) * 0.35, 4, 1, 0.5, null, 0)
          .translateX(ix).translateY(ry - 0.15).translateZ(lz + 3.95));
      }
    })();

    // ---------------- stable / barn -----------------------------------
    (function () {
      var bx = -11.5, bz = -2.5, H = 2.6;
      scene.add(cs(boxMesh(matLog, bx, H / 2, bz, 5.5, H, 4.5, 1.0)));
      scene.add(cs(quadCorners(matRoofSnow,
        [bx - 3.3, H, bz - 2.7], [bx + 3.3, H, bz - 2.7],
        [bx + 2.8, H + 1.6, bz], [bx - 2.8, H + 1.6, bz], 4, 2)));
      scene.add(cs(quadCorners(matRoofSnow,
        [bx - 3.3, H, bz + 2.7], [bx + 3.3, H, bz + 2.7],
        [bx + 2.8, H + 1.6, bz], [bx - 2.8, H + 1.6, bz], 4, 2)));
      scene.add(boxMesh(matLog, bx, 1.0, bz + 2.28, 1.4, 1.9, 0.12, 2));           // big door
      scene.add(boxMesh(matWindowWarm, bx + 1.7, 1.9, bz + 2.34, 0.7, 0.6, 0.06, 2, 0, [1.4, 1.0, 0.5]));
      colliders.push({ x0: bx - 2.9, z0: bz - 2.4, x1: bx + 2.9, z1: bz + 2.4 });
      // hay poking from the loft
      scene.add(blobMesh(ps1Material(PS1.solidTexture(206, 176, 86)), bx + 1.2, 2.7, bz + 2.0, 0.4, 0.7, 0.4, function () { return [1, 0.95, 0.8]; }));
    })();

    // ---------------- pines with snow caps ----------------------------
    function pine(x, z, s) {
      scene.add(cs(prismMesh(matLog, x, z, 0.16 * s, 1.2 * s, 6, 1.4, 1.6)));
      for (var t = 0; t < 3; t++) {
        var rr = (1.5 - t * 0.38) * s;
        scene.add(cs(prismMesh(matPine, x, z, rr, 1.25 * s, 7, 2.6, 1.6, null, (1.0 + t * 0.95) * s)));
      }
      scene.add(prismMesh(matRoofSnow, x, z, 0.3 * s, 0.28 * s, 7, 1.4, 0.5, null, 3.95 * s));
      colliders.push({ x0: x - 0.4, z0: z - 0.4, x1: x + 0.4, z1: z + 0.4 });
      decals.oct(x, z, 1.5 * s, PS1.decalMaterial(0.72, 0.75, 0.8, 0.3), 0.006, Math.round(x + z));
    }
    pine(9.5, -8.5, 1.5); pine(13.5, -3.5, 1.2); pine(-14.5, 5.5, 1.35); pine(10.5, 4.5, 1.1); pine(-8.5, 6.5, 0.95); pine(14.5, 9.5, 1.45);

    // ---------------- snowman -----------------------------------------
    (function () {
      var sx = 2.2, sz = 5.8;
      var matSnowman = ps1Material(PS1.solidTexture(238, 242, 248));
      scene.add(blobMesh(matSnowman, sx, 0.5, sz, 0.55, 0.95, 0.15, function () { return [1, 1, 1.02]; }));
      scene.add(blobMesh(matSnowman, sx, 1.35, sz, 0.40, 1.0, 0.15, function () { return [1, 1, 1.02]; }));
      scene.add(blobMesh(matSnowman, sx, 1.95, sz, 0.26, 1.0, 0.15, function () { return [1, 1, 1.02]; }));
      scene.add(boxMesh(ps1Material(PS1.solidTexture(20, 18, 18)), sx, 2.02, sz + 0.24, 0.16, 0.06, 0.05, 2));   // coal eyes+mouth band
      scene.add(boxMesh(ps1Material(PS1.solidTexture(226, 130, 40)), sx, 1.93, sz + 0.30, 0.05, 0.05, 0.22, 2)); // carrot
      scene.add(boxMesh(matLog, sx + 0.55, 1.35, sz, 0.7, 0.07, 0.07, 2, 0.5));                                  // stick arms
      scene.add(boxMesh(matLog, sx - 0.55, 1.45, sz, 0.7, 0.07, 0.07, 2, -0.4));
      scene.add(prismMesh(matLog, sx, 2.3, sz, 0.16, 0.3, 6, 1.4, 0.6, null, 0));                                // bucket hat
      colliders.push({ x0: sx - 0.6, z0: sz - 0.6, x1: sx + 0.6, z1: sz + 0.6 });
    })();

    // ---------------- props --------------------------------------------
    // firewood stack
    for (var w = 0; w < 8; w++) {
      var log = prismMesh(matLog, 0, 0, 0.1, 1.1, 5, 0.7, 1.6, null, 0);
      log.rotation.z = Math.PI / 2;
      log.position.set(4.6, 0.11 + Math.floor(w / 4) * 0.21, -3.4 + (w % 4) * 0.23);
      scene.add(log);
    }
    // sled
    (function () {
      var sx2 = -5.5, sz2 = 5.5;
      scene.add(boxMesh(matLog, sx2, 0.28, sz2, 1.0, 0.1, 1.7, 1.4));
      scene.add(boxMesh(matLog, sx2, 0.42, sz2 - 0.8, 0.9, 0.22, 0.12, 1.4, 0.5));
      [[-0.4, -0.7], [0.4, -0.7], [-0.4, 0.7], [0.4, 0.7]].forEach(function (p) {
        var runner = prismMesh(matMetalCold, 0, 0, 0.05, 1.8, 4, 1.2, 0.6, null, 0);
        runner.rotation.x = Math.PI / 2;
        runner.position.set(sx2 + p[0], 0.06, sz2 + p[1]);
        scene.add(runner);
      });
      colliders.push({ x0: sx2 - 0.6, z0: sz2 - 1.0, x1: sx2 + 0.6, z1: sz2 + 1.0 });
    })();
    // fence with snow caps
    (function () {
      for (var fx = -4; fx <= 4; fx += 1.1) {
        scene.add(cs(boxMesh(matLog, fx, 0.45, 11.5, 0.09, 0.9, 0.09, 2)));
        scene.add(boxMesh(matRoofSnow, fx, 0.93, 11.5, 0.13, 0.07, 0.13, 2));
      }
      scene.add(boxMesh(matLog, 0, 0.62, 11.5, 8.4, 0.07, 0.06, 1.4));
      scene.add(boxMesh(matLog, 0, 0.34, 11.5, 8.4, 0.07, 0.06, 1.4));
    })();
    // well
    (function () {
      scene.add(cs(prismMesh(matMetalCold, 6.5, -4.5, 0.55, 0.7, 8, 2.4, 0.9)));
      scene.add(prismMesh(matRoofSnow, 6.5, -4.5, 0.75, 0.12, 8, 2.4, 0.4, null, 0.7));
      colliders.push({ x0: 5.9, z0: -5.1, x1: 7.1, z1: -3.9 });
    })();
    // lantern posts along the path with warm pools
    [[-3.2, 8.5], [3.2, 4.0]].forEach(function (p) {
      scene.add(cs(prismMesh(matMetalCold, p[0], p[1], 0.07, 2.3, 6, 1.4, 3)));
      scene.add(boxMesh(matLanternGlow, p[0], 2.25, p[1], 0.18, 0.22, 0.18, 2, 0, [1.7, 1.3, 0.6]));
      decals.oct(p[0], p[1], 1.3, PS1.decalMaterial(0.5, 0.38, 0.2, 0.4), 0.005, Math.round(p[0] * 3 + p[1]));
    });
    // trampled path decal to the lodge
    decals.path([[-1.0, 13.5], [-0.6, 10.5], [-0.2, 7.0], [0.1, 3.5], [0.2, 0.5]],
      0.8, 1.1, PS1.decalMaterial(0.62, 0.62, 0.66, 0.55), 0.006);
    // snow drifts against walls
    [[-5.0, -4.2], [5.0, -4.0], [-11.5, 0.4], [-9.2, 6.5], [8.5, 6.0]].forEach(function (d) {
      scene.add(blobMesh(matSnow, d[0], 0.22, d[1], 0.85 + hash2(Math.round(d[0]), 3) * 0.5, 0.45, 0.35,
        function (sd) { return sd > 0.5 ? [1.02, 1.02, 1.03] : [0.98, 0.99, 1.0]; }));
    });


    // ---------------- v8 detail pass ------------------------------------
    // doghouse with a snow cap + name plate
    (function () {
      var dx = 4.0, dz = 9.6;
      scene.add(cs(boxMesh(matLog, dx, 0.4, dz, 1.0, 0.8, 1.2, 1.2)));
      scene.add(cs(quadCorners(matRoofSnow, [dx - 0.65, 0.82, dz - 0.75], [dx + 0.65, 0.82, dz - 0.75],
        [dx + 0.5, 1.25, dz], [dx - 0.5, 1.25, dz], 2, 1.4)));
      scene.add(cs(quadCorners(matRoofSnow, [dx - 0.65, 0.82, dz + 0.75], [dx + 0.65, 0.82, dz + 0.75],
        [dx + 0.5, 1.25, dz], [dx - 0.5, 1.25, dz], 2, 1.4)));
      scene.add(boxMesh(ps1Material(PS1.solidTexture(20, 18, 18)), dx, 0.38, dz - 0.62, 0.4, 0.5, 0.06, 2));
      colliders.push({ x0: dx - 0.7, z0: dz - 0.8, x1: dx + 0.7, z1: dz + 0.8 });
    })();
    // axe stump + axe + more firewood under the porch
    scene.add(prismMesh(matLog, -3.2, 4.2, 0.26, 0.4, 7, 1.4, 0.6, null, 0));
    scene.add(boxMesh(matMetalCold, -3.05, 0.62, 4.14, 0.06, 0.4, 0.03, 2, 0.5));
    scene.add(boxMesh(matLog, -3.05, 0.78, 4.14, 0.24, 0.05, 0.05, 2, 0.5));
    for (var fw = 0; fw < 5; fw++) {
      var log2 = prismMesh(matLog, 0, 0, 0.09, 1.2, 5, 0.7, 1.6, null, 0);
      log2.rotation.z = Math.PI / 2;
      log2.position.set(-2.2 + (fw % 3) * 0.24, 0.55 + Math.floor(fw / 3) * 0.2, 4.4);
      scene.add(log2);
    }
    // clothesline with frozen coats
    (function () {
      var cxx = -7.5, czz = 7.5;
      scene.add(cs(boxMesh(matMetalCold, cxx, 1.0, czz, 0.06, 2.0, 0.06, 2)));
      scene.add(cs(boxMesh(matMetalCold, cxx + 2.6, 1.0, czz, 0.06, 2.0, 0.06, 2)));
      scene.add(boxMesh(matMetalCold, cxx + 1.3, 1.85, czz, 2.7, 0.03, 0.03, 3));
      [[0.2, 0.42, 0.5], [0.9, 0.36, 0.44], [1.7, 0.46, 0.4], [2.3, 0.4, 0.46]].forEach(function (c) {
        var matCoat = ps1Material(PS1.solidTexture(96 + hash2(Math.round(c[0] * 9), 3) * 80, 84, 74));
        scene.add(boxMesh(matCoat, cxx + c[0], 1.85 - c[1] / 2 - 0.02, czz, c[2] * 0.8, c[1], 0.08, 1.6));
      });
    })();
    // snow-piled crates + barrel by the stable
    scene.add(cs(boxMesh(matLog, -13.8, 0.28, 0.8, 0.62, 0.56, 0.62, 1.2, 0.2)));
    scene.add(boxMesh(matRoofSnow, -13.8, 0.6, 0.8, 0.68, 0.1, 0.68, 2));
    scene.add(prismMesh(matMetalCold, -13.0, 0.6, 0.44, 0.9, 8, 1.8, 1));
    scene.add(prismMesh(matRoofSnow, -13.0, 0.44, 0.47, 0.12, 8, 1.8, 0.4, null, 0.44));
    // ski poles + sled skis leaning by the door
    [[-4.35, 0.12], [-4.05, 0.10]].forEach(function (sk) {
      scene.add(boxMesh(matMetalCold, sk[0], 1.0, 4.72, 0.04, 2.0, 0.04, 2, sk[1]));   // leaning on the porch posts
    });
    // frozen footprint trail to the well
    var matPrint = PS1.decalMaterial(0.50, 0.52, 0.56, 0.5);
    for (var fp = 0; fp < 9; fp++) {
      decals.rect(5.2 + fp * 0.16 + (fp % 2) * 0.14, -1.4 - fp * 0.36, 0.22, 0.34, matPrint, 0.008);
    }
    // guide signpost near the path start
    (function () {
      scene.add(cs(boxMesh(matLog, -4.6, 0.8, 9.8, 0.08, 1.6, 0.08, 2)));
      scene.add(boxMesh(matLog, -4.52, 1.3, 9.8, 0.05, 0.2, 0.55, 2));
      scene.add(boxMesh(matLog, -4.52, 1.02, 9.8, 0.05, 0.2, 0.4, 2, 0.1));
    })();
    // hay trough inside the stable + bale
    scene.add(boxMesh(matLog, -11.5, 0.3, -0.6, 1.4, 0.3, 0.5, 1.4));
    scene.add(blobMesh(ps1Material(PS1.solidTexture(200, 172, 90)), -11.5, 0.5, -0.6, 0.3, 0.6, 0.3, function () { return [1, 0.96, 0.85]; }));
    // extra lantern post + warm pool at the stable
    scene.add(cs(prismMesh(matMetalCold, -11.5, 3.4, 0.07, 2.3, 6, 1.4, 3)));
    scene.add(boxMesh(matLanternGlow, -11.5, 2.25, 3.4, 0.18, 0.22, 0.18, 2, 0, [1.7, 1.3, 0.6]));
    decals.oct(-11.5, 3.4, 1.4, PS1.decalMaterial(0.5, 0.38, 0.2, 0.4), 0.005, 77);
    // icicles hanging down from the stable eave
    for (var iv = 0; iv < 5; iv++) {
      var ic2 = prismMesh(matRoofSnow, 0, 0, 0.04, 0.24 + hash2(iv, 9) * 0.3, 4, 1, 0.5, null, 0);
      ic2.rotation.x = Math.PI;   // point downward
      ic2.position.set(-13.6 + iv * 1.05, 2.62, 0.22);
      scene.add(ic2);
    }

    // falling snow
    var snowfall = PS1.makeParticles({
      mode: 'petal', count: 340, color: [0.93, 0.95, 1.0],
      size: 0.022, speed: 0.9, sway: 0.4,
      area: [-15, 15, -13, 14, 9]
    });
    scene.add(snowfall);

    return {
      name: '雪岭驿站',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -13.5, x1: 13.5, z0: -11.5, z1: 13.0 },
      spawn: [-2.5, 13.5, Math.atan2(-(-0.2 - -2.5), -(-6.0 - 13.5)), 0.0],
      idle: { pos: [-2.5, 1.62, 13.5], target: [-0.2, 1.8, -6.0] },
      fog: { color: [0.62, 0.66, 0.72], near: 20, far: 55 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [snowfall].concat(snow.puffs),
      update: function (t) {
        var warm = 0.9 + 0.08 * Math.sin(t * 10.7) + 0.04 * Math.sin(t * 27.1);
        matWindowWarm.uniforms.uFlicker.value = warm;
        matLanternGlow.uniforms.uFlicker.value = warm;
      }
    };
  });

})();
