(function () {
  'use strict';
  // ======================= 深海遗都 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function sandCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 5, 2);
      var ripple = Math.sin((y + vnoise(x / 14, y / 14, 4, 2) * 9) * 0.55);
      var r = 52 + n * 20 + ripple * 7, g = 62 + n * 22 + ripple * 8, b = 58 + n * 18 + ripple * 7;
      var rub = hash2(x + 11, y + 4);
      if (rub < 0.03) { r *= 0.55; g *= 0.6; b *= 0.6; }             // rubble specks
      if (rub > 0.985) { r += 60; g += 62; b += 58; }                 // shell glints
      return [r, g, b];
    });
  }
  function stoneCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 7, 6, 3);
      var crack = vnoise(x / 16 + 3, y / 16, 4, 2);
      var r = 62 + n * 26, g = 74 + n * 28, b = 76 + n * 28;
      if (crack > 0.72) { var k = (crack - 0.72) * 2.2; r *= 1 - k * 0.6; g *= 1 - k * 0.6; b *= 1 - k * 0.55; }
      var alg = vnoise(x / 10, y / 22 + 8, 5, 2);                     // algae creeping from below
      if (alg > 0.62 && y > 26) { var a = (alg - 0.62) * 1.4; r *= 1 - a * 0.5; g += a * 26; b *= 1 - a * 0.15; }
      return [r, g, b];
    });
  }
  function kelpCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var st = Math.sin(x * 0.9 + vnoise(x / 12, y / 20, 4, 2) * 4);
      var n = vnoise(x / 6, y / 6, 4, 2);
      var k = 0.55 + 0.45 * Math.abs(st);
      return [22 * k + n * 10, 58 * k + n * 16, 40 * k + n * 12];
    });
  }

  var sandTex = texFrom(sandCanvas());
  var stoneTex = texFrom(stoneCanvas());
  var kelpTex = texFrom(kelpCanvas());

  var matSand = ps1Material(sandTex);
  var matStone = ps1Material(stoneTex);
  var matKelp = ps1Material(kelpTex);
  var matPearl = PS1.privateFlicker(ps1Material(PS1.solidTexture(190, 235, 235)));   // clam pearl
  var matRune = PS1.privateFlicker(ps1Material(PS1.solidTexture(120, 210, 200)));    // temple doorway glow

  var DOWN = new THREE.Vector3(0.22, 0.82, 0.30).normalize();   // surface light filtering down
  var PEARL = [1.5, 2.2, -30.5];                                // altar pearl position
  var deepRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * DOWN.x + ny * DOWN.y + nz * DOWN.z) * 1.15;
    var depth = Math.max(0, 1 - y * 0.040);                     // darker the deeper
    var r = (0.09 + 0.22 * ndl) * depth, g = (0.15 + 0.36 * ndl) * depth, b = (0.18 + 0.40 * ndl) * depth;
    var dx = PEARL[0] - x, dy = PEARL[1] - y, dz = PEARL[2] - z;
    var d2 = dx * dx + dy * dy + dz * dz;
    var fall = 3.4 / (1 + d2 * 0.008);
    var inv = 1 / (Math.sqrt(d2) + 1e-4);
    var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
    var w = fall * (0.35 + 0.65 * nd);
    r += w * 0.55; g += w * 0.95; b += w * 0.95;
    return [Math.min(1.1, r), Math.min(1.1, g), Math.min(1.1, b)];
  };

  PS1.registerScene(function () {
    setRelight(deepRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var dim = new THREE.DirectionalLight(0x7fc8c8, 0.6);
    dim.position.copy(DOWN).multiplyScalar(40);
    scene.add(dim); scene.add(dim.target);

    scene.add(PS1.makeSky({
      top: [0.24, 0.50, 0.54], horizon: [0.08, 0.20, 0.24], bottom: [0.02, 0.05, 0.07],
      sunDir: [0.22, 0.82, 0.30], sunCol: [0.25, 0.55, 0.55], sunCut: 0.995, sunGlow: 0.8,
      stars: 0, meteors: 0, radius: 100
    }));

    // ---------------- sea floor + ruins avenue ---------------------------
    scene.add(PS1.groundGrid(matSand, 0, -14, 90, 90, 11, 2, 0, 1));
    // colonnade: both sides of the avenue, some columns toppled
    var FULL = [];   // z of intact columns (carry the architrave)
    for (var c2 = 4; c2 >= -36; c2 -= 4) {
      [-4.2, 4.2].forEach(function (cx) {
        var broke = hash2(cx * 7 | 0, c2 | 0);
        var h = broke < 0.28 ? 1.2 + broke * 6 : 6.0;
        scene.add(cs(prismMesh(matStone, cx, c2, 0.45, h, 8, 1.4, 4, null, 0)));
        scene.add(prismMesh(matStone, cx, c2, 0.62, 0.5, 8, 1.8, 0.6, null, 0));   // base drum
        scene.add(prismMesh(matStone, cx, c2, 0.58, 0.4, 8, 1.7, 0.5, null, h));    // capital
        if (h < 6 && hash2(cx | 0, c2 * 3 | 0) > 0.5) {
          var fallen = prismMesh(matStone, 0, 0, 0.42, 4.6, 8, 1.3, 4, null, 0);
          fallen.rotation.x = Math.PI / 2 - 0.12;
          fallen.position.set(cx + (cx > 0 ? -1.6 : 1.6), 0.45, c2 + 1.2);
          scene.add(cs(fallen));
        }
        if (h >= 6) FULL.push([cx, c2]);
      });
    }
    for (var a2 = 0; a2 < FULL.length - 2; a2++) {   // architrave over intact pairs
      if (FULL[a2][1] !== FULL[a2 + 2][1] + 4) continue;
      [-4.2, 4.2].forEach(function (cx) {
        var z0 = FULL[a2][1];
        scene.add(cs(boxMesh(matStone, cx, 6.35, z0 - 2, 1.0, 0.55, 4.4, 1.5)));
      });
      scene.add(cs(boxMesh(matStone, 0, 6.75, FULL[a2][1] - 2, 9.4, 0.4, 4.4, 1.5)));
    }
    // temple front: stepped platform + pediment + glowing doorway
    [0.5, 1.0, 1.5].forEach(function (sy, i) {
      scene.add(cs(boxMesh(matStone, 0, sy - 0.25, -32.5 - i * 0.0, 14 - i * 0.6, 0.5, 7 - i * 0.4, 2.4)));
    });
    for (var tc = -3; tc <= 3; tc++) {
      if (Math.abs(tc) === 3) continue;
      scene.add(cs(prismMesh(matStone, tc * 1.9, -31.4, 0.55, 7.2, 8, 1.6, 5, null, 1.5)));
    }
    scene.add(cs(boxMesh(matStone, 0, 9.4, -31.4, 12.4, 0.6, 6.4, 2.2)));
    scene.add(cs(quadCorners(matStone, [-6.6, 9.7, -34.6], [6.6, 9.7, -34.6], [5.4, 12.6, -30.9], [-5.4, 12.6, -30.9], 4, 2)));
    scene.add(boxMesh(matRune, 0, 4.6, -34.55, 3.4, 6.2, 0.12, 1, 0, [0.35, 0.75, 0.7]));
    colliders.push({ x0: -7.2, z0: -36.2, x1: 7.2, z1: -29.4 });
    // leaning colossus face half-buried by the temple
    var face = blobMesh(matStone, 0, 0, 0, 4.4, 1.15, 0.5, function (sd) { return [0.92, 1.0, 1.02]; });
    face.position.set(11.5, 3.2, -38);
    face.rotation.z = -0.35;
    scene.add(cs(face));
    colliders.push({ x0: 7.0, z0: -42, x1: 16, z1: -34 });

    // ---------------- kelp + amphorae + wreck debris --------------------
    for (var k2 = 0; k2 < 26; k2++) {
      var kx = -30 + hash2(k2, 17) * 60, kz = -44 + hash2(k2, 53) * 58;
      if (Math.abs(kx) < 6.5 && kz > -30) kx += kx > 0 ? 9 : -9;    // keep the avenue clear
      var kh = 2.2 + hash2(k2, 91) * 2.6;
      for (var s2 = 0; s2 < 3; s2++) {
        scene.add(prismMesh(matKelp, kx + s2 * 0.5 - 0.5, kz + s2 * 0.4, 0.07, kh * (1 - s2 * 0.15), 5, 0.5, 3, null, 0));
      }
    }
    [[-6.8, -10], [-7.4, -9.2], [6.9, -16], [-6.2, -22.5]].forEach(function (am, ai) {
      scene.add(prismMesh(matStone, am[0], am[1], 0.22, 0.5, 7, 1, 0.8, null, 0));
      if (ai % 2 === 0) {
        var tipped = prismMesh(matStone, 0, 0, 0.22, 0.5, 7, 1, 0.8, null, 0);
        tipped.rotation.x = Math.PI / 2;
        tipped.position.set(am[0] + 0.7, 0.22, am[1] + 0.3);
        scene.add(tipped);
      }
    });
    // snapped mast + spar from an old wreck, lying across the avenue side
    var mast = prismMesh(matStone, 0, 0, 0.16, 9, 7, 1, 3, null, 0);
    mast.rotation.z = Math.PI / 2 - 0.06;
    mast.position.set(8.2, 0.18, -12);
    scene.add(cs(mast));
    // giant clam with the glowing pearl (the light source of the avenue)
    scene.add(blobMesh(matStone, PEARL[0], 0.45, PEARL[2], 1.15, 0.55, 0.35, function () { return [0.8, 0.95, 1.0]; }));
    scene.add(blobMesh(matPearl, PEARL[0], PEARL[1] - 1.9, PEARL[2], 0.42, 0.85, 0.15, function () { return [2.2, 2.0, 1.9]; }));
    colliders.push({ x0: PEARL[0] - 1.3, z0: PEARL[2] - 1.3, x1: PEARL[0] + 1.3, z1: PEARL[2] + 1.3 });
    // anchor + chain dropping into a trench
    (function () {
      scene.add(boxMesh(matStone, -9.5, 0.7, 4.5, 1.5, 0.28, 2.1, 1.2));   // stock
      scene.add(boxMesh(matStone, -9.5, 0.35, 4.5, 0.24, 1.3, 0.24, 2));   // shank
      for (var li = 0; li < 7; li++) scene.add(boxMesh(matStone, -9.5, 1.8 + li * 0.42, 4.5 + li * 0.1, 0.16, 0.3, 0.1, 2));
    })();

    // ---------------- light shafts + motes + bubbles ---------------------
    var shaftMat = new THREE.MeshBasicMaterial({
      color: 0xbfe8e4, transparent: true, opacity: 0.27, depthWrite: false, side: THREE.DoubleSide
    });
    var shafts = [];
    for (var sh = 0; sh < 6; sh++) {
      var sx = -14 + sh * 5.4 + hash2(sh, 5) * 3, sz = -40 + hash2(sh, 9) * 44;
      var qu = quadCorners(shaftMat, [sx, 26, sz], [sx + 2.6, 26, sz - 1.2],
        [sx + 5.2, 0.5, sz - 2.6], [sx + 2.6, 0.5, sz - 1.4], 1, 1);
      scene.add(qu);
      shafts.push(qu);
    }
    var plankton = PS1.makeParticles({
      mode: 'dust', count: 240, color: [0.55, 0.72, 0.72],
      size: 0.015, speed: 0.4, sway: 0.5,
      area: [-20, 20, -34, 10, 9], y0: 1
    });
    var school = PS1.makeParticles({
      mode: 'dust', count: 130, color: [0.62, 0.82, 0.85],
      size: 0.05, speed: 1.6, sway: 0.9,
      area: [-16, 16, -26, -4, 2.4], y0: 5.4
    });
    var bubbles = PS1.makeParticles({
      mode: 'steam', count: 120, color: [0.7, 0.88, 0.9],
      size: 0.03, speed: 2.6, sway: 0.35,
      area: [-12, 4, -33, -27, 9], y0: 1
    });
    scene.add(plankton); scene.add(school); scene.add(bubbles);

    // ---------------- the whale + the manta --------------------------------
    var whale = new THREE.Group();
    (function () {
      var body = prismMesh(matStone, 0, 0, 1.9, 7.4, 9, 3, 2, null, 0);
      whale.add(body);
      whale.add(boxMesh(matStone, 0, 0, 3.9, 2.6, 0.9, 2.2, 1.5));           // head block
      var fl = boxMesh(matStone, 0, -0.8, 0.6, 4.6, 0.28, 2.4, 1.5);          // fluke
      fl.position.z = -0.6; whale.add(fl);
      var p1 = boxMesh(matStone, 0, 0, 0, 2.8, 0.22, 1.5, 1.2);               // flipper
      p1.position.set(1.6, -0.9, 0.9); p1.rotation.z = 0.5; whale.add(p1);
      whale.rotation.z = Math.PI / 2;
      whale.position.set(-70, 12, -22);
      scene.add(whale);
    })();
    var manta = new THREE.Group();
    (function () {
      manta.add(prismMesh(matStone, 0, 0, 1.15, 1.3, 7, 1, 0.8, null, 0));
      var w1 = boxMesh(matStone, 0, 0, 0, 3.6, 0.14, 1.7, 1); w1.position.set(1.8, 0.1, 0.3); w1.rotation.z = 0.34; manta.add(w1);
      var w2 = boxMesh(matStone, 0, 0, 0, 3.6, 0.14, 1.7, 1); w2.position.set(-1.8, 0.1, 0.3); w2.rotation.z = -0.34; manta.add(w2);
      manta.rotation.z = Math.PI / 2;
      manta.position.set(40, 6.5, -8);
      scene.add(manta);
    })();

    return {
      name: '深海遗都',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -5.8, x1: 5.8, z0: -28.6, z1: 12.0 },
      spawn: [0.0, 8.0, 0.0, 0.04],
      eyeY: 2.3,   // drifting just above the sand
      idle: { pos: [0.5, 4.2, 9.5], target: [0.0, 4.2, -34.0] },   // straight down the sunken avenue to the glowing door
      fog: { color: [0.045, 0.13, 0.16], near: 7, far: 56 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [plankton, school, bubbles],
      update: function (t) {
        sandTex.offset.x = t * 0.012;
        sandTex.offset.y = t * 0.02;
        matPearl.uniforms.uFlicker.value = 0.9 + 0.1 * Math.sin(t * 2.1);
        matRune.uniforms.uFlicker.value = 0.85 + 0.15 * Math.sin(t * 3.3 + 1.0);
        whale.position.x = -85 + ((t * 3.1) % 210);
        whale.position.y = 12 + Math.sin(t * 0.4) * 1.2;
        whale.rotation.y = Math.sin(t * 0.13) * 0.12;
        manta.position.x = 55 - ((t * 2.2) % 120);
        manta.position.y = 6.5 + Math.sin(t * 0.9) * 0.8;
        manta.rotation.z = Math.PI / 2 + Math.sin(t * 1.1) * 0.18;
        for (var i = 0; i < shafts.length; i++) {
          shafts[i].material.opacity = 0.13 + 0.06 * Math.sin(t * 0.6 + i * 1.9);
        }
      }
    };
  });
})();
