(function () {
  'use strict';
  // ======================= 屋顶之夜 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function roofCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 8, 5, 2);
      var shingle = Math.sin(y * 0.9) * 0.5 + 0.5;
      var r = 52 + n * 24 + shingle * 10, g = 46 + n * 22 + shingle * 9, b = 48 + n * 20 + shingle * 8;
      if (hash2(x + 5, y + 9) < 0.02) { r += 40; g += 38; b += 30; }   // bird lime
      return [r, g, b];
    });
  }
  function brickCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 8);
      var off = (row % 2) * 8;
      var mortar = (y % 8 < 1) || ((x + off) % 16 < 1);
      var n = vnoise(x / 6, y / 6, 5, 2);
      if (mortar) return [58 + n * 14, 54 + n * 12, 50 + n * 10];
      return [108 + n * 34, 54 + n * 20, 42 + n * 14];
    });
  }
  function cityCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 9, 5, 2);
      var r = 16 + n * 10, g = 15 + n * 9, b = 20 + n * 12;
      var wx = Math.floor(x / 7), wy = Math.floor(y / 6);
      if (x % 7 > 1 && x % 7 < 5 && y % 6 > 1 && y % 6 < 4 && hash2(wx, wy) > 0.55) {
        var warm = hash2(wx * 3, wy * 5);
        r += 70 + warm * 130; g += 55 + warm * 100; b += 32 + warm * 55;
      }
      if (hash2(wx * 7, wy * 11) > 0.985) { r += 60; g += 130; b += 90; }   // the odd TV-green window
      return [r, g, b];
    });
  }

  var roofTex = texFrom(roofCanvas());
  var brickTex = texFrom(brickCanvas());
  var cityTex = texFrom(cityCanvas());

  var matRoof = ps1Material(roofTex);
  var matBrick = ps1Material(brickTex);
  var matCity = ps1Material(cityTex);
  var matCloth = ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
    var n = vnoise(x / 7, y / 9, 5, 2);
    var stripe = Math.sin(x * 0.5) > 0;
    var r = stripe ? 120 + n * 40 : 60 + n * 20, g = stripe ? 72 + n * 24 : 56 + n * 18, b = stripe ? 66 + n * 22 : 62 + n * 20;
    return [r, g, b];
  })));
  var matTV = PS1.privateFlicker(ps1Material(PS1.solidTexture(150, 200, 255)));    // skylight TV glow
  var matBlinkR = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 70, 60)));  // antenna aircraft light

  var MOONR = new THREE.Vector3(0.3, 0.72, -0.42).normalize();
  var roofRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOONR.x + ny * MOONR.y + nz * MOONR.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.09 + 0.19 * ndl + 0.05 * hemi;
    var g = 0.10 + 0.21 * ndl + 0.055 * hemi;
    var b = 0.12 + 0.25 * ndl + 0.065 * hemi;
    var up = Math.max(0, -ny);                                     // street glow from below
    r += up * 0.40; g += up * 0.23; b += up * 0.12;
    return [Math.min(1.1, r), Math.min(1.05, g), Math.min(1.0, b)];
  };

  PS1.registerScene(function () {
    setRelight(roofRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var dim = new THREE.DirectionalLight(0x9db4dd, 1);
    dim.position.copy(MOONR).multiplyScalar(34);
    dim.castShadow = true;
    dim.shadow.mapSize.set(1024, 1024);
    dim.shadow.camera.near = 2; dim.shadow.camera.far = 60;
    dim.shadow.camera.left = -18; dim.shadow.camera.right = 18;
    dim.shadow.camera.top = 18; dim.shadow.camera.bottom = -18;
    dim.shadow.bias = -0.004; dim.shadow.normalBias = 0.05;
    scene.add(dim); scene.add(dim.target);

    scene.add(PS1.makeSky({
      top: [0.015, 0.025, 0.05], horizon: [0.13, 0.115, 0.13], bottom: [0.12, 0.085, 0.075],
      sunDir: [0.3, 0.72, -0.42], sunCol: [0.85, 0.9, 1.0], sunCut: 0.9988, sunGlow: 0.4,
      stars: 1.0, meteors: 0.4, radius: 90
    }));

    // ---------------- the roof cluster ------------------------------------
    var ROOF = 12;
    scene.add(PS1.groundGrid(matRoof, 0, 0, 18, 13, 6, 2, ROOF, 1));          // home roof
    scene.add(PS1.groundGrid(matRoof, -14, 4, 13, 14, 5, 2, ROOF - 2.4, 1));  // west lower roof
    scene.add(PS1.groundGrid(matRoof, 15, -6, 14, 16, 5, 2, ROOF + 1.8, 1));  // east higher roof
    // roof-edge parapets
    [[0, -6.4, 18, 0.4], [0, 6.4, 18, 0.4]].forEach(function (pp) {
      scene.add(cs(boxMesh(matBrick, pp[0], ROOF + 0.25, pp[1], pp[2], 0.5, pp[3], 2)));
    });
    // the city below: textured slabs filling the lower view
    [[-9, 26, -6, 22, 16], [10, 28, 8, 24, 20], [-26, 10, -18, 20, 14], [24, -8, 16, 22, 17],
     [-2, -26, 8, 24, 19], [26, 24, 20, 20, 22]].forEach(function (b) {
      scene.add(boxMesh(matCity, b[0], b[4] / 2 - 4, b[1], b[2], b[4], b[3], 3));
    });
    // chimneys
    [[-6.2, -3.8], [6.8, 4.2], [-2.4, 5.4]].forEach(function (cm) {
      scene.add(cs(boxMesh(matBrick, cm[0], ROOF + 1.1, cm[1], 1.0, 2.2, 1.0, 2)));
      scene.add(boxMesh(matBrick, cm[0], ROOF + 2.3, cm[1], 1.2, 0.2, 1.2, 2));
      colliders.push({ x0: cm[0] - 0.6, z0: cm[1] - 0.6, x1: cm[0] + 0.6, z1: cm[1] + 0.6 });
    });
    // water tank on legs
    (function () {
      var tx = 5.6, tz = -4.4;
      [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(function (lg) {
        scene.add(boxMesh(matBrick, tx + lg[0], ROOF + 0.8, tz + lg[1], 0.16, 1.6, 0.16, 2));
      });
      scene.add(cs(prismMesh(matBrick, tx, tz, 1.25, 2.0, 9, 3, 1.6, null, ROOF + 1.6)));
      scene.add(prismMesh(matBrick, tx, tz, 1.35, 0.5, 9, 3.2, 0.5, null, ROOF + 3.6));
      colliders.push({ x0: tx - 1.4, z0: tz - 1.4, x1: tx + 1.4, z1: tz + 1.4 });
    })();
    // ventilation ducts
    [[-4.0, 2.8, 0.4], [-3.2, 2.4, 0.3], [2.6, 3.6, 0.5]].forEach(function (dv) {
      var duct = boxMesh(matBrick, 0, 0, 0, dv[2] * 2, 0.5, dv[2] * 2.4, 2, 0);
      duct.rotation.y = hash2(dv[0] * 3 | 0, 7) * 1.5;
      duct.position.set(dv[0], ROOF + 0.25, dv[1]);
      scene.add(cs(duct));
    });
    // skylight box with TV glow inside
    (function () {
      var sx = -1.2, sz = -3.4;
      scene.add(cs(boxMesh(matBrick, sx, ROOF + 0.3, sz, 1.6, 0.6, 1.2, 2)));
      scene.add(boxMesh(matTV, sx, ROOF + 0.18, sz, 1.3, 0.1, 0.9, 1, 0, [0.7, 1.0, 1.35]));
      colliders.push({ x0: sx - 0.9, z0: sz - 0.7, x1: sx + 0.9, z1: sz + 0.7 });
    })();
    // TV antenna forest on the east roof + one big mast on ours with blinker
    var antennas = [];
    for (var an = 0; an < 5; an++) {
      var ax = 10 + hash2(an, 3) * 9, az = -13 + hash2(an, 7) * 14;
      var mast = prismMesh(matBrick, 0, 0, 0.05, 2.4 + hash2(an, 5) * 2, 5, 0.4, 2, null, 0);
      mast.position.set(ax, ROOF + 1.8 + 0.9, az);
      antennas.push(mast);
      scene.add(mast);
      for (var cb = 0; cb < 3; cb++) {
        scene.add(boxMesh(matBrick, ax, ROOF + 2.6 + cb * 0.75, az, 0.9 + cb * 0.35, 0.05, 0.05, 2));
      }
    }
    var blinker = boxMesh(matBlinkR, -8.3, ROOF + 5.3, 2.6, 0.16, 0.16, 0.16, 1, 0, [1.6, 0.35, 0.3]);
    scene.add(cs(prismMesh(matBrick, -8.3, 2.6, 0.07, 4.6, 5, 0.5, 3.4, null, ROOF)));
    scene.add(blinker);

    // ---------------- laundry lines ----------------------------------------
    var laundry = [];
    [[-7.4, 1.2, -4.4, 1.2], [2.8, -5.4, 6.4, -5.4]].forEach(function (ln, li) {
      scene.add(prismMesh(matBrick, ln[0], ln[1], 0.05, 2.1, 5, 0.4, 1.6, null, ROOF));
      scene.add(prismMesh(matBrick, ln[2], ln[3], 0.05, 2.1, 5, 0.4, 1.6, null, ROOF));
      scene.add(quadCorners(matBrick, [ln[0], ROOF + 2.0, ln[1] + 0.05], [ln[2], ROOF + 1.92, ln[3] + 0.05],
        [ln[2], ROOF + 1.88, ln[3] + 0.05], [ln[0], ROOF + 1.96, ln[1] + 0.05], 1.5, 0.1));
      var n = 4;
      for (var cl = 1; cl <= n; cl++) {
        var f = cl / (n + 1);
        var pivot = new THREE.Group();
        pivot.position.set(ln[0] + (ln[2] - ln[0]) * f, ROOF + 1.9, ln[1] + (ln[3] - ln[1]) * f);
        var cw = 0.5 + hash2(li, cl) * 0.3, chh = 0.7 + hash2(cl, li) * 0.5;
        pivot.add(quadCorners(matCloth, [-cw / 2, 0, 0.012], [cw / 2, 0, 0.012], [cw / 2, -chh, 0.012], [-cw / 2, -chh, 0.012], 0.8, 1));
        scene.add(pivot);
        laundry.push({ g: pivot, ph: hash2(li * 3, cl) * 6 });
      }
    });

    // ---------------- pigeons: pecking on the roof + one circling flock ----
    var perch = [];
    [[-2.2, 2.4], [-1.6, 2.9], [3.4, -2.6], [7.2, 2.2]].forEach(function (pp, pi) {
      var pg = new THREE.Group();
      var body = blobMesh(matBrick, 0, 0, 0, 0.13, 1.35, 0.25, function () { return [0.85, 0.82, 0.8]; });
      var head = blobMesh(matBrick, 0.1, 0.09, 0.02, 0.07, 1, 0.2, function () { return [0.6, 0.58, 0.6]; });
      pg.add(body); pg.add(head);
      pg.position.set(pp[0], ROOF + 0.16, pp[1]);
      pg.rotation.y = hash2(pi, 11) * Math.PI * 2;
      scene.add(pg);
      perch.push({ g: pg, head: head, ph: pi * 1.7 });
    });
    var flock = [];
    for (var fb = 0; fb < 7; fb++) {
      var bird = new THREE.Group();
      var bb = boxMesh(matBrick, 0, 0, 0, 0.12, 0.2, 0.07, 1);
      var w1 = boxMesh(matBrick, 0, 0.04, 0, 0.3, 0.04, 0.08, 1); w1.position.x = 0.15;
      var w2 = boxMesh(matBrick, 0, 0.04, 0, 0.3, 0.04, 0.08, 1); w2.position.x = -0.15;
      bird.add(bb); bird.add(w1); bird.add(w2);
      bird.userData = { ph: fb / 7 * Math.PI * 2, r: 6 + hash2(fb, 3) * 4, y: ROOF + 5 + hash2(fb, 5) * 3, wings: [w1, w2] };
      scene.add(bird);
      flock.push(bird);
    }
    // drifting smog + one distant plane light
    var smog = PS1.makeParticles({
      mode: 'dust', count: 150, color: [0.30, 0.28, 0.30],
      size: 0.09, speed: 0.3, sway: 1.2,
      area: [-20, 20, -16, 10, 3.5], y0: 6
    });
    scene.add(smog);
    var plane = boxMesh(matBlinkR, 0, 0, 0, 0.22, 0.06, 0.06, 1, 0, [1.5, 0.4, 0.35]);
    scene.add(plane);

    return {
      name: '屋顶之夜',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -8.6, x1: 8.6, z0: -6.0, z1: 6.0 },
      spawn: [4.0, 4.5, Math.atan2(-(-8.3 - 4.0), -(2.6 - 4.5)), 0.08],
      eyeY: ROOF + 1.62,
      idle: { pos: [-3.4, ROOF + 2.4, 4.8], target: [6.5, ROOF + 1.0, -8.5] },   // across the roofs: laundry foreground, antenna masts, city glow below
      fog: { color: [0.05, 0.05, 0.07], near: 22, far: 80 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [smog],
      update: function (t) {
        matTV.uniforms.uFlicker.value = 0.55 + 0.45 * Math.abs(Math.sin(t * 13.0) * Math.sin(t * 3.7) + 0.3 * Math.sin(t * 31.0)) * 0.9;
        matBlinkR.uniforms.uFlicker.value = (t % 2.6) < 0.3 ? 1.4 : 0.1;
        laundry.forEach(function (c) {
          c.g.rotation.z = 0.16 * Math.sin(t * 1.9 + c.ph) + 0.06 * Math.sin(t * 5.1 + c.ph * 2);
          c.g.rotation.x = 0.08 * Math.cos(t * 1.3 + c.ph);
        });
        perch.forEach(function (p) {
          p.head.position.y = 0.09 + (Math.sin(t * 2.0 + p.ph) > 0.6 ? -0.05 : 0);   // peck bob
          p.g.rotation.y += 0.002;
        });
        flock.forEach(function (b) {
          var u = b.userData;
          var a = u.ph + t * 0.3;
          b.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.6 + u.ph) * 0.8, Math.sin(a) * u.r * 0.7);
          b.rotation.y = -a + Math.PI / 2;
          var flap = Math.sin(t * 7.5 + u.ph * 4) * 0.55;
          u.wings[0].rotation.z = flap;
          u.wings[1].rotation.z = -flap;
        });
        antennas.forEach(function (m, i) {
          m.rotation.z = 0.02 * Math.sin(t * 2.2 + i * 1.9);   // wind wobble
        });
        plane.position.set(-50 + (t * 3.5) % 110, 34 + Math.sin(t * 0.2) * 1.5, -42);
      }
    };
  });
})();
