(function () {
  'use strict';
  // ======================= 彩窗大教堂 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function stoneCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 7, 6, 3);
      var block = (Math.floor(y / 16) % 2 === 0) ? 0 : 6;
      var mortar = (y % 16 < 1.5 || (x + block) % 32 < 1.5);
      var r = 96 + n * 30, g = 92 + n * 28, b = 86 + n * 26;
      if (mortar) { r *= 0.72; g *= 0.72; b *= 0.72; }
      return [r, g, b];
    });
  }
  function woodCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var grain = Math.sin(x * 0.55 + vnoise(x / 5, y / 18, 5, 2) * 4) * 0.5 + 0.5;
      var n = vnoise(x / 6, y / 14, 5, 2);
      var r = 74 + grain * 34 + n * 14, g = 50 + grain * 24 + n * 10, b = 32 + grain * 16 + n * 8;
      return [r, g, b];
    });
  }
  function glassCanvas(hue) {
    return pixelLoop(newCanvas(64), function (x, y) {
      var lead = (x % 16 < 2 || y % 21 < 2);                       // lead came grid
      var n = vnoise(x / 5, y / 5, 5, 2);
      var k = 0.7 + n * 0.6;
      var r = hue[0] * k, g = hue[1] * k, b = hue[2] * k;
      if (lead) { r = 18; g = 18; b = 20; }
      if (vnoise(x / 9 + 3, y / 9, 4, 2) > 0.74) { r *= 1.35; g *= 1.35; b *= 1.35; }   // jewel highlights
      return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
    });
  }

  var stoneTex = texFrom(stoneCanvas());
  var woodTex = texFrom(woodCanvas());
  var matStone = ps1Material(stoneTex);
  var matWood = ps1Material(woodTex);
  var matGold = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 214, 120)));    // altar gold
  var matCandle = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 196, 96)));   // candle flame

  // the six aisle windows: hue per window, light pools on the floor echo them
  var WINDOWS = [
    { p: [-9.4, 5.2, -6], hue: [90, 190, 255], pool: [-6.2, -4.4] },
    { p: [-9.4, 5.2, -14], hue: [255, 120, 90], pool: [-6.2, -12.4] },
    { p: [9.4, 5.2, -6], hue: [255, 200, 90], pool: [6.2, -4.4] },
    { p: [9.4, 5.2, -14], hue: [140, 255, 160], pool: [6.2, -12.4] },
    { p: [-9.4, 5.2, -22], hue: [200, 130, 255], pool: [-6.2, -20.4] },
    { p: [9.4, 5.2, -22], hue: [255, 160, 220], pool: [6.2, -20.4] }
  ];
  var LAMP = [0, 5.4, -13];    // chandelier crown position

  var cathedralRelight = function (x, y, z, nx, ny, nz) {
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.10 + 0.05 * hemi, g = 0.10 + 0.05 * hemi, b = 0.12 + 0.06 * hemi;
    for (var i = 0; i < WINDOWS.length; i++) {                    // cool tint from each window
      var w = WINDOWS[i];
      var dx = w.p[0] - x, dy = w.p[1] - y, dz = w.p[2] - z;
      var d2 = dx * dx + dy * dy + dz * dz;
      var fall = 0.5 / (1 + d2 * 0.02);
      var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) / (Math.sqrt(d2) + 1e-4));
      var ww = fall * (0.35 + 0.65 * nd);
      r += ww * w.hue[0] / 255 * 0.35; g += ww * w.hue[1] / 255 * 0.35; b += ww * w.hue[2] / 255 * 0.35;
    }
    var dx = LAMP[0] - x, dy = LAMP[1] - y, dz = LAMP[2] - z;
    var d2 = dx * dx + dy * dy + dz * dz;
    var fall = 3.0 / (1 + d2 * 0.026);
    var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) / (Math.sqrt(d2) + 1e-4));
    var w = fall * (0.4 + 0.6 * nd);
    r += w * 1.1; g += w * 0.85; b += w * 0.5;
    return [Math.min(1.15, r), Math.min(1.1, g), Math.min(1.05, b)];
  };

  PS1.registerScene(function () {
    setRelight(cathedralRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var lamp = new THREE.PointLight(0xffd9a0, 1);
    lamp.position.set(LAMP[0], LAMP[1], LAMP[2]);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(256, 256);
    lamp.shadow.camera.near = 0.2; lamp.shadow.camera.far = 13;
    scene.add(lamp); scene.add(lamp.target);

    scene.add(PS1.makeSky({
      top: [0.02, 0.02, 0.04], horizon: [0.05, 0.05, 0.08], bottom: [0.02, 0.02, 0.03],
      sunDir: [0.3, 0.8, 0.4], sunCol: [0, 0, 0], stars: 0, meteors: 0, radius: 60
    }));

    // ---------------- the shell: nave 19 x 9 x 34 ------------------------
    var W2 = 9.5, H = 11, Z0 = 3, Z1 = -30;
    scene.add(PS1.groundGrid(matStone, 0, -13.5, 19, 34, 9, 2, 0, 1));
    scene.add(cs(quadCorners(matStone, [-W2, 0, Z0], [W2, 0, Z0], [W2, H, Z0], [-W2, H, Z0], 5, 3)));
    scene.add(cs(quadCorners(matStone, [-W2, 0, Z1], [W2, 0, Z1], [W2, H, Z1], [-W2, H, Z1], 5, 3)));   // apse wall (rose window covers centre)
    scene.add(cs(quadCorners(matStone, [-W2, 0, Z0], [-W2, 0, Z1], [-W2, H, Z1], [-W2, H, Z0], 8, 3)));
    scene.add(cs(quadCorners(matStone, [W2, 0, Z0], [W2, 0, Z1], [W2, H, Z1], [W2, H, Z0], 8, 3)));
    scene.add(cs(quadCorners(matStone, [-W2, H, Z0], [W2, H, Z0], [W2, H, Z1], [-W2, H, Z1], 5, 8)));   // vault ceiling
    // ceiling ribs + transverse arches
    for (var zc = Z0 - 2; zc > Z1; zc -= 4) {
      scene.add(cs(boxMesh(matStone, -3.4, H - 0.5, zc, 0.5, 1.0, 0.5, 1.5)));
      scene.add(cs(boxMesh(matStone, 3.4, H - 0.5, zc, 0.5, 1.0, 0.5, 1.5)));
      scene.add(cs(quadCorners(matStone, [-3.6, H - 0.9, zc], [3.6, H - 0.9, zc], [3.6, H - 0.2, zc - 0.6], [-3.6, H - 0.2, zc - 0.6], 2, 0.5)));
    }
    // aisle colonnade
    for (var col = Z0 - 2; col > Z1 + 2; col -= 4) {
      [-5.8, 5.8].forEach(function (cx) {
        scene.add(cs(prismMesh(matStone, cx, col, 0.55, 8.4, 8, 1.6, 6, null, 0)));
        scene.add(prismMesh(matStone, cx, col, 0.72, 0.5, 8, 1.9, 0.6, null, 0));
        scene.add(prismMesh(matStone, cx, col, 0.68, 0.55, 8, 1.8, 0.7, null, 8.4));
        colliders.push({ x0: cx - 0.8, z0: col - 0.8, x1: cx + 0.8, z1: col + 0.8 });
      });
      scene.add(cs(boxMesh(matStone, 0, 8.7, col, 11.2, 0.5, 0.6, 3)));   // architrave beam
    }

    // ---------------- stained glass + rose window -------------------------
    WINDOWS.forEach(function (w, wi) {
      var matGlass = ps1Material(texFrom(glassCanvas(w.hue)));
      var sx = w.p[0] < 0 ? -W2 + 0.06 : W2 - 0.06;
      var nrm = w.p[0] < 0 ? 1 : -1;
      scene.add(quadCorners(matGlass,
        [sx, 1.4, w.p[2] - 1.7], [sx, 1.4, w.p[2] + 1.7], [sx, 6.4, w.p[2] + 1.7], [sx, 6.4, w.p[2] - 1.7], 2, 2));
      // pointed arch top
      scene.add(quadCorners(matGlass,
        [sx, 6.4, w.p[2] - 1.7], [sx, 6.4, w.p[2] + 1.7], [sx, 8.6, w.p[2]], [sx, 8.6, w.p[2]], 2, 1));
      void nrm;
      // coloured light pool on the floor, angled from the window
      var poolMat = PS1.decalMaterial(w.hue[0] / 255, w.hue[1] / 255, w.hue[2] / 255, 0.55, 1.1);
      decals.rect(w.pool[0], w.pool[1], 3.6, 5.4, poolMat, 0.02, w.p[0] < 0 ? 0.5 : -0.5);
    });
    // rose window on the apse wall
    (function () {
      var roseMat = ps1Material(texFrom(glassCanvas([255, 170, 90])));
      var cx = 0, cy = 7.4, cz = Z1 + 0.08;
      for (var rp = 0; rp < 12; rp++) {
        var a = rp / 12 * Math.PI * 2;
        var px = cx + Math.cos(a) * 2.2, py = cy + Math.sin(a) * 2.2;
        scene.add(quadCorners(roseMat, [px - 0.5, py - 0.5, cz], [px + 0.5, py - 0.5, cz], [px + 0.5, py + 0.5, cz], [px - 0.5, py + 0.5, cz], 1, 1));
      }
      scene.add(quadCorners(roseMat, [cx - 1.0, cy - 1.0, cz], [cx + 1.0, cy - 1.0, cz], [cx + 1.0, cy + 1.0, cz], [cx - 1.0, cy + 1.0, cz], 1, 1));
    })();

    // ---------------- altar + chancel --------------------------------------
    (function () {
      scene.add(cs(boxMesh(matStone, 0, 0.4, -27.5, 4.4, 0.8, 1.6, 2)));
      scene.add(boxMesh(matGold, 0, 1.05, -27.5, 1.5, 0.5, 0.9, 1.6, 0, [1.5, 1.15, 0.55]));
      colliders.push({ x0: -2.4, z0: -28.4, x1: 2.4, z1: -26.6 });
      // reredos panels
      [[-3.1, -29.4], [3.1, -29.4]].forEach(function (rr) {
        scene.add(cs(boxMesh(matGold, rr[0], 2.6, rr[1], 1.5, 4.4, 0.3, 1.5, 0, [0.6, 0.5, 0.28])));
      });
      // organ pipes flank BOTH sides of the apse
      for (var op = 0; op < 7; op++) {
        var ph2 = 2.2 + Math.abs(3 - op) * 0.9 + hash2(op, 5) * 0.7;
        scene.add(cs(prismMesh(matGold, -6.8 + op * 0.62, -28.8, 0.22, ph2, 6, 0.5, ph2, null, 9.6)));
        scene.add(cs(prismMesh(matGold, 6.8 - op * 0.62, -28.8, 0.22, 2.0 + Math.abs(3 - op) * 0.8 + hash2(op, 9) * 0.7, 6, 0.5, 2.4, null, 9.6)));
      }
      // candle banks on the altar steps
      [[-1.6, -26.6], [1.6, -26.6], [-0.8, -26.2], [0.8, -26.2]].forEach(function (cd) {
        scene.add(prismMesh(matWood, cd[0], cd[1], 0.06, 0.5, 6, 0.4, 0.5, null, 0.8));
        scene.add(boxMesh(matCandle, cd[0], 1.5, cd[1], 0.14, 0.3, 0.14, 1, 0, [1.8, 1.35, 0.6]));
      });
    })();

    // ---------------- pews + chandelier + censer ---------------------------
    for (var pz = -2; pz > -21; pz -= 1.8) {
      [-3.2, 3.2].forEach(function (px) {
        scene.add(cs(boxMesh(matWood, px, 0.45, pz, 5.2, 0.16, 0.6, 2.5)));
        scene.add(cs(boxMesh(matWood, px, 0.8, pz + 0.22, 5.2, 0.7, 0.1, 2.5)));   // backrest
        scene.add(boxMesh(matWood, px, 0.22, pz, 4.9, 0.44, 0.5, 2.5));
      });
      colliders.push({ x0: -5.9, z0: pz - 0.35, x1: -0.5, z1: pz + 0.35 });
      colliders.push({ x0: 0.5, z0: pz - 0.35, x1: 5.9, z1: pz + 0.35 });
    }
    // chandelier crown: ring + candles + hanging chains
    var chandelier = new THREE.Group();
    (function () {
      chandelier.position.set(LAMP[0], LAMP[1], LAMP[2]);
      var ring = prismMesh(matGold, 0, 0, 1.1, 0.16, 10, 2.4, 0.4, null, 0);
      chandelier.add(ring);
      for (var cc = 0; cc < 8; cc++) {
        var ca = cc / 8 * Math.PI * 2;
        var cxx = Math.cos(ca) * 1.1, czz = Math.sin(ca) * 1.1;
        var st2 = prismMesh(matWood, 0, 0, 0.05, 0.42, 5, 0.4, 0.5, null, 0);
        st2.position.set(cxx, 0.2, czz);
        chandelier.add(st2);
        var flame = boxMesh(matCandle, 0, 0, 0, 0.11, 0.26, 0.11, 1, 0, [1.9, 1.4, 0.62]);
        flame.position.set(cxx, 0.62, czz);
        chandelier.add(flame);
      }
      for (var ch = 0; ch < 3; ch++) {
        var cha = ch / 3 * Math.PI * 2;
        var chain = prismMesh(matWood, 0, 0, 0.03, 4.7, 4, 0.3, 3.2, null, 0);
        chain.position.set(Math.cos(cha) * 0.9, 1.4, Math.sin(cha) * 0.9);
        chain.rotation.z = Math.cos(cha) * 0.32;
        chandelier.add(chain);
      }
      scene.add(chandelier);
    })();
    // swinging censer on the chancel arch
    var censer = new THREE.Group();
    (function () {
      var cx0 = 0, cz0 = -23.5;
      scene.add(prismMesh(matWood, cx0, cz0, 0.035, 4.2, 4, 0.3, 3, null, 8.8));
      censer.position.set(cx0, 5.4, cz0);
      censer.add(prismMesh(matGold, 0, 0, 0.22, 0.5, 6, 0.8, 0.5, null, -0.4));
      scene.add(censer);
    })();
    var smoke = PS1.makeParticles({
      mode: 'steam', count: 60, color: [0.75, 0.75, 0.78],
      size: 0.045, speed: 0.7, sway: 0.5,
      area: [-0.4, 0.4, -24.4, -22.8, 2.6], y0: 4.8
    });
    var motes = PS1.makeParticles({
      mode: 'dust', count: 260, color: [0.9, 0.85, 0.7],
      size: 0.014, speed: 0.25, sway: 0.45,
      area: [-8, 8, -26, 2, 8.6], y0: 0.4
    });
    scene.add(smoke); scene.add(motes);
    // banners on the aisle pillars
    var banners = [];
    [[-5.8, -10], [5.8, -10], [-5.8, -18], [5.8, -18]].forEach(function (bp) {
      var pivot = new THREE.Group();
      pivot.position.set(bp[0], 7.0, bp[1]);
      pivot.add(quadCorners(matWood, [-0.55, 0, -0.01], [0.55, 0, -0.01], [0.55, -2.8, -0.01], [-0.55, -2.8, -0.01], 1, 2));
      scene.add(pivot);
      banners.push(pivot);
    });
    // doves nesting on the architrave, one occasionally flies the nave
    var dove = new THREE.Group();
    (function () {
      var db = boxMesh(matWood, 0, 0, 0, 0.14, 0.24, 0.1, 1);
      var dw1 = boxMesh(matWood, 0, 0.05, 0, 0.3, 0.04, 0.09, 1); dw1.position.x = 0.16;
      var dw2 = boxMesh(matWood, 0, 0.05, 0, 0.3, 0.04, 0.09, 1); dw2.position.x = -0.16;
      dove.add(db); dove.add(dw1); dove.add(dw2);
      dove.userData = { wings: [dw1, dw2] };
      scene.add(dove);
    })();

    return {
      name: '彩窗大教堂',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -4.9, x1: 4.9, z0: -25.2, z1: 1.8 },
      spawn: [0.0, 1.4, 0.0, 0.0],
      idle: { pos: [0.0, 2.2, 1.2], target: [0.0, 5.8, -28.0] },   // straight down the nave: pews, chandelier, altar, rose window
      fog: { color: [0.03, 0.03, 0.05], near: 16, far: 52 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [smoke, motes],
      update: function (t) {
        matCandle.uniforms.uFlicker.value = 0.86 + 0.14 * Math.abs(Math.sin(t * 9.0) * Math.sin(t * 2.3));
        matGold.uniforms.uFlicker.value = 0.95 + 0.05 * Math.sin(t * 3.1);
        lamp.intensity = 0.94 + 0.06 * Math.sin(t * 8.6) * Math.sin(t * 2.1);
        chandelier.rotation.y = 0.03 * Math.sin(t * 0.4);            // slow draft drift
        censer.rotation.z = 0.55 * Math.sin(t * 0.9);                // pendulum swing
        censer.position.x = 0 + 1.4 * Math.sin(t * 0.9) * 0.39;      // arc of the swing
        banners.forEach(function (b, i) {
          b.rotation.x = 0.06 * Math.sin(t * 1.1 + i * 1.4);
          b.rotation.z = 0.04 * Math.sin(t * 0.8 + i * 2.2);
        });
        // the dove: perches on a beam, every ~14 s it flies a slow loop down the nave
        var cyc = t % 14;
        if (cyc < 9) {
          dove.position.set(3.1, 9.0, -14 + Math.sin(t * 0.5) * 0.2);
          dove.rotation.y = Math.PI / 2;
          dove.userData.wings[0].rotation.z = 0;
          dove.userData.wings[1].rotation.z = 0;
        } else {
          var f = (cyc - 9) / 5;
          dove.position.set(3.1 - 6.6 * Math.sin(f * Math.PI), 9.0 - 5.2 * Math.sin(f * Math.PI), -14 - 10 * f);
          dove.rotation.y = Math.PI / 2 + f * 0.9;
          var flap = Math.sin(t * 14) * 0.7;
          dove.userData.wings[0].rotation.z = flap;
          dove.userData.wings[1].rotation.z = -flap;
        }
      }
    };
  });
})();
