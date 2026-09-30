(function () {
  'use strict';
  // ======================= 巨树神殿 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function barkCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var ridge = Math.sin(x * 0.62 + vnoise(x / 9, y / 26, 5, 2) * 5);
      var n = vnoise(x / 7, y / 18, 6, 3);
      var k = 0.6 + 0.4 * Math.abs(ridge);
      var r = 66 * k + n * 22, g = 54 * k + n * 18, b = 44 * k + n * 14;
      var moss = vnoise(x / 8 + 6, y / 30, 4, 2);
      if (moss > 0.68) { var m = (moss - 0.68) * 1.5; r *= 1 - m * 0.4; g += m * 30; b *= 1 - m * 0.2; }
      return [r, g, b];
    });
  }
  function leafCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 5, y / 5, 6, 3);
      var cl = hash2(x | 0, y | 0);
      var r = 22 + n * 26, g = 44 + n * 44, b = 26 + n * 22;
      if (n > 0.78) { r += 24; g += 34; b += 14; }                     // lit leaf patches (noise-domain, not specks)
      return [r, g, b];
    });
  }
  function plankCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var plank = Math.sin(x * 0.98) * 0.5 + 0.5;
      var n = vnoise(x / 5, y / 16, 5, 2);
      return [76 + plank * 28 + n * 16, 60 + plank * 22 + n * 13, 44 + plank * 16 + n * 10];
    });
  }

  var barkTex = texFrom(barkCanvas());
  var leafTex = texFrom(leafCanvas());
  var plankTex = texFrom(plankCanvas());

  var matBark = ps1Material(barkTex);
  var matLeaf = ps1Material(leafTex);
  var matPlank = ps1Material(plankTex);
  var matLantern = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 190, 100)));

  var TX = 0.0, TZ = -16.0;            // trunk centre
  var MOONWN = new THREE.Vector3(-0.15, 0.70, -0.62).normalize();
  // lantern lights: MUST be fixed at module scope, before any geometry bakes
  var LANTERNS = [
    [TX + 8.0, 26.0, TZ - 10.0], [TX + 14.0, 30.0, TZ + 2.0], [TX + 15.0, 36.0, TZ - 4.0],
    [TX + 13.0, 42.0, TZ - 10.0], [TX + 7.0, 22.0, TZ + 5.0]
  ];   // east-side skirt hangs: clear of trunk AND every leaf blob along the idle sightlines
  var treeRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOONWN.x + ny * MOONWN.y + nz * MOONWN.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.07 + 0.15 * ndl + 0.035 * hemi;
    var g = 0.09 + 0.18 * ndl + 0.045 * hemi;
    var b = 0.11 + 0.22 * ndl + 0.055 * hemi;
    for (var i = 0; i < LANTERNS.length; i++) {
      var lp = LANTERNS[i];
      var dx = lp[0] - x, dy = lp[1] - y, dz = lp[2] - z;
      var d2 = dx * dx + dy * dy + dz * dz;
      var fall = 1.7 / (1 + d2 * 0.014);
      var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) / (Math.sqrt(d2) + 1e-4));
      var w = fall * (0.4 + 0.6 * nd);
      r += w * 1.15; g += w * 0.82; b += w * 0.42;
    }
    return [Math.min(1.15, r), Math.min(1.1, g), Math.min(1.05, b)];
  };

  PS1.registerScene(function () {
    setRelight(treeRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];
    var vines = [];

    var dim = new THREE.DirectionalLight(0x99bbee, 0.9);
    dim.position.copy(MOONWN).multiplyScalar(40);
    scene.add(dim); scene.add(dim.target);

    scene.add(PS1.makeSky({
      top: [0.02, 0.035, 0.07], horizon: [0.10, 0.12, 0.16], bottom: [0.04, 0.05, 0.07],
      sunDir: [-0.15, 0.70, -0.62], sunCol: [0.9, 0.95, 1.0], sunCut: 0.9975, sunGlow: 0.85,
      stars: 1.0, meteors: 0.5, radius: 100
    }));

    // ---------------- ground far below + mist sea --------------------------
    scene.add(PS1.groundGrid(matBark, TX, TZ + 6, 120, 120, 12, 2, 0, 1));
    var mistMat = new THREE.MeshBasicMaterial({ color: 0x33404d, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    [[1.5, 0.34], [3.0, 0.26], [4.6, 0.2]].forEach(function (mq) {
      scene.add(quadCorners(mistMat, [TX - 60, mq[0], TZ - 54], [TX + 60, mq[0], TZ - 54],
        [TX + 60, mq[0], TZ + 66], [TX - 60, mq[0], TZ + 66], 8, 8));
    });

    // ---------------- the trunk (58 m) + root arches ------------------------
    [[7.4, 0, 13], [5.9, 12, 12], [4.5, 24, 11], [3.3, 35, 10], [2.3, 45, 13]].forEach(function (tr) {
      scene.add(cs(prismMesh(matBark, TX, TZ, tr[0], tr[2], 9, 4.5, tr[2], null, tr[1])));
    });
    for (var rt = 0; rt < 6; rt++) {
      var ra = rt / 6 * Math.PI * 2 + 0.4;
      var root = prismMesh(matBark, 0, 0, 1.6, 13, 7, 1.4, 4, null, 0);
      root.rotation.z = Math.cos(ra) > 0 ? -0.62 : 0.62;
      root.rotation.y = -ra + Math.PI / 2;
      root.position.set(TX + Math.cos(ra) * 5.2, 3.4, TZ + Math.sin(ra) * 5.2);
      scene.add(cs(root));
    }

    // ---------------- branches + canopy + lanterns ---------------------------
    // 8 major branches, deterministic from fixed azimuths; canopy blobs at tips
    var BR = [
      [20, 0.3, 10.5], [22, 2.1, 9.0], [24, 3.7, 8.0], [26, 5.2, 9.5],
      [30, 0.9, 9.0], [32, 2.6, 8.0], [36, 4.2, 7.5], [38, 5.6, 8.5]
    ];
    BR.forEach(function (b, bi) {
      var by = b[0], az = b[1], len = b[2];
      var dx = Math.cos(az), dz = Math.sin(az);
      var seg1 = prismMesh(matBark, 0, 0, 1.05, len * 0.55, 7, 1.2, 2.6, null, 0);
      seg1.rotation.z = 0.62;
      seg1.rotation.y = -az + Math.PI / 2;
      seg1.position.set(TX + dx * 2.2, by + 1.2, TZ + dz * 2.2);
      scene.add(cs(seg1));
      var ex = TX + dx * (2.2 + Math.cos(0.62) * len * 0.5), ey = by + 1.2 + Math.sin(0.62) * len * 0.5;
      var seg2 = prismMesh(matBark, 0, 0, 0.72, len * 0.5, 7, 1, 2, null, 0);
      seg2.rotation.z = 0.95;
      seg2.rotation.y = -az + Math.PI / 2;
      seg2.position.set(ex, ey, TZ + dz * (2.2 + Math.cos(0.62) * len * 0.5));
      scene.add(cs(seg2));
      // canopy cluster at the tip
      var tipx = ex + Math.cos(0.95) * len * 0.5 * dx, tipz = TZ + dz * (2.2 + Math.cos(0.62) * len * 0.5) + Math.sin(0.95) * len * 0.5 * dz;
      var tipy = ey + Math.sin(0.95) * len * 0.5;
      scene.add(blobMesh(matLeaf, tipx, tipy, tipz, 4.4 + hash2(bi, 3) * 2.4, 0.75, 0.45, function () { return [1, 1, 1]; }));
      scene.add(blobMesh(matLeaf, tipx + dx * 3, tipy + 1.4, tipz + dz * 3, 3.0 + hash2(bi, 7) * 1.6, 0.7, 0.45, function () { return [1.05, 1.05, 1.0]; }));
      // hanging vine from the tip
      if (bi % 2 === 0) {
        var vine = prismMesh(matLeaf, 0, 0, 0.09, 5 + hash2(bi, 11) * 6, 5, 0.5, 3, null, 0);
        vine.position.set(tipx - dx * 1.5, tipy - 2.5, tipz - dz * 1.5);
        scene.add(vine);
        vines.push(vine);
      }
    });
    // crown cap
    scene.add(blobMesh(matLeaf, TX, 52.5, TZ, 6.4, 0.8, 0.4, function () { return [1, 1, 1]; }));
    scene.add(blobMesh(matLeaf, TX - 4, 49.5, TZ + 3, 4.2, 0.75, 0.45, function () { return [1.05, 1.05, 1]; }));
    scene.add(blobMesh(matLeaf, TX + 4.5, 50.5, TZ - 3.5, 4.0, 0.7, 0.45, function () { return [1, 1.02, 1]; }));
    // lantern pods under the canopy
    LANTERNS.forEach(function (lp) {
      scene.add(prismMesh(matPlank, lp[0], lp[1] + 0.6, lp[2], 0.05, 5.5, 5, 0.4, 3.2, null, 0));   // cord reaches up into the foliage
      scene.add(boxMesh(matLantern, lp[0], lp[1], lp[2], 0.45, 0.62, 0.45, 1, 0, [1.7, 1.25, 0.6]));
      scene.add(boxMesh(matLantern, lp[0], lp[1], lp[2], 1.6, 1.6, 1.6, 1, 0, [1.05, 0.78, 0.36]));   // soft halo cube
    });

    // ---------------- village platforms + rope bridge -----------------------
    function platform(py, az, len) {
      var dx = Math.cos(az), dz = Math.sin(az);
      var cx = TX + dx * (3.4 + len / 2), cz = TZ + dz * (3.4 + len / 2);
      var deck = boxMesh(matPlank, 0, 0, 0, len, 0.22, 3.4, 2.2);
      deck.rotation.y = -az;
      deck.position.set(cx, py, cz);
      scene.add(cs(deck));
      // struts down to the trunk
      scene.add(boxMesh(matPlank, TX + dx * 3.6, py - 1.1, TZ + dz * 3.6, 0.24, 2.6, 0.24, 1.5, dx > 0 ? 0.5 : -0.5));
      // railing posts + rail
      for (var rp = 0; rp <= 4; rp++) {
        var rx = TX + dx * 3.6 + dx * (len / 4) * rp, rz = TZ + dz * 3.6 + dz * (len / 4) * rp;
        scene.add(boxMesh(matPlank, rx - dz * 1.55, py + 0.42, rz + dx * 1.55, 0.09, 0.84, 0.09, 2));
        scene.add(boxMesh(matPlank, rx + dz * 1.55, py + 0.42, rz - dx * 1.55, 0.09, 0.84, 0.09, 2));
      }
      // hut on two of the platforms
      if (len > 5) {
        var hx = TX + dx * (3.4 + len / 2), hz = TZ + dz * (3.4 + len / 2);
        var hut = boxMesh(matPlank, 0, 0, 0, 2.6, 1.6, 2.4, 2);
        hut.rotation.y = 0.2;
        hut.position.set(hx, py + 0.95, hz);
        scene.add(cs(hut));
        scene.add(cs(boxMesh(matPlank, hx, py + 2.1, hz, 3.2, 0.4, 3.0, 2, 0)));
        scene.add(boxMesh(matLantern, hx + dx * 1.35, py + 1.1, hz + dz * 1.35, 0.4, 0.5, 0.4, 1, 0, [1.6, 1.2, 0.6]));
      }
      return { cx: cx, cz: cz, az: az };
    }
    var p1 = platform(22.0, 0.35, 5.6);
    var p2 = platform(30.0, 1.9, 6.4);
    var p3 = platform(38.0, 4.4, 5.0);
    colliders.push(
      { x0: p2.cx - 3.6, z0: p2.cz - 2.0, x1: p2.cx + 3.6, z1: p2.cz + 2.0 },
      { x0: TX - 2.4, z0: TZ - 2.4, x1: TX + 2.4, z1: TZ + 2.4 }
    );
    // rope bridge from p2 back to a small gate deck on the trunk flank
    (function () {
      var gx = TX + 3.9, gz = TZ - 2.2, gy = 25.8;
      var gate = boxMesh(matPlank, 0, 0, 0, 2.4, 0.2, 2.4, 2);
      gate.rotation.y = 0.5;
      gate.position.set(gx, gy, gz);
      scene.add(cs(gate));
      scene.add(boxMesh(matPlank, gx + 1.0, gy - 1.2, gz + 0.5, 0.22, 2.6, 0.22, 1.5, 0.5));
      scene.add(boxMesh(matPlank, gx + 0.2, gy - 1.2, gz - 0.9, 0.22, 2.6, 0.22, 1.5, -0.4));
      scene.add(boxMesh(matLantern, gx - 1.0, gy + 0.5, gz - 0.9, 0.18, 0.24, 0.18, 1, 0, [1.6, 1.2, 0.6]));
    })();
    (function () {
      var ax = TX + Math.cos(p2.az) * 3.6, az2 = TZ + Math.sin(p2.az) * 3.6;
      var bx2 = TX + 3.9, bz2 = TZ - 2.2, by2 = 26.0;
      var ropeMat = ps1Material(PS1.solidTexture(112, 92, 66));
      [-0.5, 0.5].forEach(function (side) {
        scene.add(quadCorners(ropeMat,
          [ax - Math.sin(p2.az) * side * 1.4, 30.0, az2 + Math.cos(p2.az) * side * 1.4],
          [bx2, by2, bz2 + side * 1.4],
          [bx2, by2 + 0.9, bz2 + side * 1.4],
          [ax - Math.sin(p2.az) * side * 1.4, 30.9, az2 + Math.cos(p2.az) * side * 1.4], 3, 0.3));
      });
      for (var bp = 0; bp <= 8; bp++) {
        var f = bp / 8;
        var mx = ax + (bx2 - ax) * f, mz = az2 + (bz2 - az2) * f;
        var my = 30.0 + (by2 - 30.0) * f - Math.sin(f * Math.PI) * 0.9;
        scene.add(boxMesh(matPlank, mx, my, mz, 0.5, 0.06, 2.8 - Math.abs(f - 0.5) * 0.5, 1.5));
      }
    })();

    // ---------------- fireflies + falling leaves + birds --------------------
    var fireflies = PS1.makeParticles({
      mode: 'dust', count: 220, color: [0.65, 0.95, 0.5],
      size: 0.025, speed: 0.5, sway: 0.8,
      area: [TX - 14, TX + 14, TZ - 12, TZ + 12, 12], y0: 24
    });
    var leaves = PS1.makeParticles({
      mode: 'petal', count: 260, color: [0.55, 0.62, 0.35],
      size: 0.05, speed: 1.0, sway: 0.7,
      area: [TX - 15, TX + 15, TZ - 13, TZ + 11, 16], y0: 34
    });
    scene.add(fireflies); scene.add(leaves);
    var birds = [];
    for (var bd = 0; bd < 6; bd++) {
      var bird = new THREE.Group();
      var bb = boxMesh(matBark, 0, 0, 0, 0.1, 0.2, 0.06, 1);
      var w1 = boxMesh(matBark, 0, 0.04, 0, 0.26, 0.04, 0.08, 1); w1.position.x = 0.15;
      var w2 = boxMesh(matBark, 0, 0.04, 0, 0.26, 0.04, 0.08, 1); w2.position.x = -0.15;
      bird.add(bb); bird.add(w1); bird.add(w2);
      bird.userData = { ph: bd / 6 * Math.PI * 2, r: 8 + hash2(bd, 3) * 5, y: 42 + hash2(bd, 5) * 8, wings: [w1, w2] };
      scene.add(bird);
      birds.push(bird);
    }

    return {
      name: '巨树神殿',
      scene: scene,
      colliders: colliders,
      bounds: { x0: p2.cx - 3.4, x1: p2.cx + 3.4, z0: p2.cz - 1.8, z1: p2.cz + 1.8 },
      spawn: [p2.cx, p2.cz, Math.atan2(-(TX - p2.cx), -(TZ - p2.cz)), 0.12],
      eyeY: 31.62,
      idle: { pos: [12.0, 14.0, 4.0], target: [-1.0, 33.0, -18.0] },   // SE of the trunk below the canopy skirt: all five lanterns on verified-clear sightlines, moon upper frame
      fog: { color: [0.07, 0.09, 0.11], near: 18, far: 85 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [fireflies, leaves],
      update: function (t) {
        matLantern.uniforms.uFlicker.value = 0.9 + 0.1 * Math.sin(t * 6.5);
        vines.forEach(function (v, i) {
          v.rotation.x = 0.08 * Math.sin(t * 0.8 + i * 1.7);
          v.rotation.z = 0.08 * Math.cos(t * 0.6 + i * 2.1);
        });
        birds.forEach(function (bd2) {
          var u = bd2.userData;
          var a = u.ph + t * 0.28;
          bd2.position.set(TX + Math.cos(a) * u.r, u.y + Math.sin(t * 0.7 + u.ph) * 0.6, TZ + Math.sin(a) * u.r);
          bd2.rotation.y = -a;
          var flap = Math.sin(t * 6.0 + u.ph * 4) * 0.5;
          u.wings[0].rotation.z = flap;
          u.wings[1].rotation.z = -flap;
        });
      }
    };
  });
})();
