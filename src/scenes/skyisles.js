(function () {
  'use strict';
  // ======================= 天空浮岛群 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function skyGrassCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 5, y / 5, 9, 3);
      var r = 92 + n * 54, g = 132 + n * 62, b = 66 + n * 40;
      var rock = vnoise(x / 12 + 4, y / 12, 5, 2);
      if (rock > 0.72) { var k = (rock - 0.72) * 2; r = r * (1 - k) + 128 * k; g = g * (1 - k) + 124 * k; b = b * (1 - k) + 118 * k; }
      var fl = hash2(x, y);
      if (fl > 0.985) { r = 250; g = 240; b = 180; }               // tiny flowers
      return [r, g, b];
    });
  }
  function skyRockCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 8, 3);
      var strata = Math.sin(y * 0.5 + vnoise(x / 10, y / 10, 4, 2) * 4);
      var r = 122 + n * 34 + strata * 10, g = 104 + n * 30 + strata * 8, b = 96 + n * 28 + strata * 8;
      var moss = vnoise(x / 14, y / 14, 4, 2);
      if (moss > 0.70 && y < 26) { var k = (moss - 0.70) * 2; r *= 1 - k * 0.5; g *= 1 - k * 0.05; b *= 1 - k * 0.45; }
      return [r, g, b];
    });
  }
  function cloudSeaCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 6, 3);
      var r = 225 + n * 30, g = 230 + n * 26, b = 240 + n * 16;
      var shade = vnoise(x / 16 + 3, y / 16, 4, 2);
      if (shade > 0.66) { var k = (shade - 0.66) * 1.6; r *= 1 - k * 0.22; g *= 1 - k * 0.2; b *= 1 - k * 0.14; }
      return [r, g, b];
    });
  }
  function balloonCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var stripe = Math.floor(y / 9) % 2 === 0;
      var n = vnoise(x / 10, y / 10, 5, 2);
      var r = stripe ? 196 + n * 24 : 228 + n * 20;
      var g = stripe ? 70 + n * 18 : 226 + n * 18;
      var b = stripe ? 60 + n * 14 : 218 + n * 16;
      return [r, g, b];
    });
  }
  function crystalCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 5, y / 8, 7, 2);
      var facet = Math.floor(x / 9);
      var base = 120 + (facet % 2) * 60 + n * 50;
      return [base * 0.5, base, base * 1.05];
    });
  }

  var skyGrassTex = texFrom(skyGrassCanvas());
  var skyRockTex = texFrom(skyRockCanvas());
  var cloudTex = texFrom(cloudSeaCanvas());
  var balloonTex = texFrom(balloonCanvas());
  var crystalTex = texFrom(crystalCanvas());

  var matGrass = ps1Material(skyGrassTex);
  var matRock = ps1Material(skyRockTex);
  var matCloud = ps1Material(cloudTex);
  var matBalloon = ps1Material(balloonTex);
  var matCrystal = PS1.privateFlicker(ps1Material(crystalTex));

  var SUN = new THREE.Vector3(0.5, 0.62, 0.32).normalize();
  var SKY_AMB = [0.40, 0.42, 0.48];
  var GND_AMB = [0.34, 0.30, 0.26];
  var skyRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 1.15 * ndl + GND_AMB[0] + (SKY_AMB[0] - GND_AMB[0]) * hemi;
    var g = 1.08 * ndl + GND_AMB[1] + (SKY_AMB[1] - GND_AMB[1]) * hemi;
    var b = 0.98 * ndl + GND_AMB[2] + (SKY_AMB[2] - GND_AMB[2]) * hemi;
    return [Math.min(1.2, r), Math.min(1.16, g), Math.min(1.1, b)];
  };

  PS1.registerScene(function () {
    setRelight(skyRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var sun = new THREE.DirectionalLight(0xfff4dd, 1);
    sun.position.copy(SUN).multiplyScalar(34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -19; sun.shadow.camera.right = 19;
    sun.shadow.camera.top = 19; sun.shadow.camera.bottom = -19;
    sun.shadow.bias = -0.004; sun.shadow.normalBias = 0.05;
    scene.add(sun); scene.add(sun.target);

    scene.add(PS1.makeSky({
      top: [0.28, 0.48, 0.86], horizon: [0.82, 0.89, 0.99], bottom: [0.75, 0.82, 0.94],
      sunDir: SUN.toArray(), sunCol: [1.35, 1.28, 1.1], sunCut: 0.9985, sunGlow: 0.5,
      stars: 0, meteors: 0, radius: 100
    }));

    // ---------------- cloud sea far below ------------------------------
    scene.add(PS1.groundGrid(matCloud, 0, -16, 170, 170, 8, 3, -16, 1));

    // ---------------- main island --------------------------------------
    scene.add(PS1.groundGrid(matGrass, 0, 0, 27, 27, 9, 1, 0, 1));
    // rocky tapering underside + hanging roots
    [[13, -1.8, 2.6], [10.2, -4.4, 2.4], [7.2, -7.0, 2.2], [4.4, -9.6, 2.0], [2.4, -12.0, 2.2]].forEach(function (d) {
      var disc = prismMesh(matRock, 0, 0, d[0], d[2], 12, 6.4, 0.8, null, d[1]);
      scene.add(disc);
    });
    for (var rt = 0; rt < 8; rt++) {
      var ra = rt / 8 * Math.PI * 2 + 0.4;
      var root = boxMesh(matRock, 0, 0, 0, 0.14, 3 + hash2(rt, 5) * 3.5, 0.14, 2, 0);
      root.position.set(Math.cos(ra) * 8.5, -8 - hash2(rt, 3) * 2, Math.sin(ra) * 8.5);
      root.rotation.x = (hash2(rt, 7) - 0.5) * 0.5;
      root.rotation.z = (hash2(rt, 9) - 0.5) * 0.5;
      scene.add(root);
    }
    // rim rocks around the edge
    for (var rr2 = 0; rr2 < 14; rr2++) {
      var ea = rr2 / 14 * Math.PI * 2;
      var edge = prismMesh(matRock, 0, 0, 0.5 + hash2(rr2, 3) * 0.6, 0.7 + hash2(rr2, 8) * 1.1, 6, 1.4, 1, null, 0);
      edge.position.set(Math.cos(ea) * 12.8, 0, Math.sin(ea) * 12.8);
      edge.rotation.z = (hash2(rr2, 5) - 0.5) * 0.6;
      scene.add(cs(edge));
    }

    // ---------------- great central tree --------------------------------
    (function () {
      var tx = 1.5, tz = -2.0;
      scene.add(cs(prismMesh(matRock, tx, tz, 1.3, 3.2, 8, 2.4, 4)));
      scene.add(cs(prismMesh(matRock, tx, tz, 0.8, 4.5, 8, 2, 6, null, 3.0)));
      for (var fl = 0; fl < 5; fl++) {
        var fa = fl / 5 * Math.PI * 2;
        scene.add(cs(boxMesh(matRock, tx + Math.cos(fa) * 1.3, 0.8, tz + Math.sin(fa) * 1.3, 0.5, 1.6, 0.5, 2, Math.cos(fa) * 0.5)));
      }
      scene.add(cs(blobMesh(ps1Material(PS1.solidTexture(88, 142, 64)), tx, 9.0, tz, 4.6, 0.7, 0.4,
        function (sd) { return sd > 0.55 ? [1.05, 1.05, 0.95] : [0.9, 1.0, 0.85]; })));
      scene.add(cs(blobMesh(ps1Material(PS1.solidTexture(110, 158, 72)), tx - 2.6, 7.2, tz + 2.0, 2.8, 0.75, 0.4,
        function () { return [1.0, 1.02, 0.9]; })));
      scene.add(cs(blobMesh(ps1Material(PS1.solidTexture(80, 132, 62)), tx + 2.8, 7.6, tz - 1.6, 3.0, 0.72, 0.4,
        function () { return [0.95, 1.0, 0.88]; })));
      // hanging vines
      for (var v2 = 0; v2 < 6; v2++) {
        var va = v2 / 6 * Math.PI * 2;
        scene.add(boxMesh(ps1Material(PS1.solidTexture(70, 118, 58)), tx + Math.cos(va) * 4.4, 6.6, tz + Math.sin(va) * 4.4, 0.06, 2.2 + hash2(v2, 4) * 2, 0.06, 3));
      }
      colliders.push({ x0: tx - 1.5, z0: tz - 1.5, x1: tx + 1.5, z1: tz + 1.5 });
    })();

    // ---------------- moored airship ------------------------------------
    var airship = new THREE.Group();
    (function () {
      var ax = 9.0, ay = 6.2, az = -5.0;
      var balloon = blobMesh(matBalloon, 0, 0, 0, 3.4, 0.78, 0.12, function (sd) { return [1, 1, 1]; });
      balloon.scale.set(1.9, 1, 1);
      airship.add(balloon);
      airship.add(boxMesh(matRock, 0, -3.1, 0, 2.6, 1.2, 1.3, 1.4));
      airship.add(boxMesh(matBalloon, -6.2, 0, 0, 1.6, 2.0, 0.15, 1.6));
      airship.add(boxMesh(matBalloon, 0, 3.3, 0, 1.2, 0.9, 0.12, 1.6));
      // mooring ropes down to the mast
      airship.add(boxMesh(ps1Material(PS1.solidTexture(90, 82, 70)), -2.0, -2.0, 0, 0.03, 3.0, 0.03, 3, 0.3));
      airship.add(boxMesh(ps1Material(PS1.solidTexture(90, 82, 70)), 2.0, -2.0, 0, 0.03, 3.0, 0.03, 3, -0.3));
      airship.position.set(ax, ay, az);
      scene.add(airship);
      // mast on the island
      scene.add(cs(prismMesh(matRock, ax - 4.6, az, 0.14, 3.2, 6, 1.2, 4)));
      colliders.push({ x0: ax - 4.9, z0: az - 0.3, x1: ax - 4.3, z1: az + 0.3 });
    })();

    // ---------------- ruins + crystals on the main island ---------------
    (function () {
      var rx = -4.5, rz = 4.5;
      [[-1.6, 0], [1.6, 0]].forEach(function (c) {
        scene.add(cs(prismMesh(matRock, rx + c[0], rz + c[1], 0.5, 3.4, 7, 1.6, 4)));
      });
      scene.add(cs(quadCorners(matRock, [rx - 2.3, 3.5, rz - 0.5], [rx + 2.3, 3.5, rz - 0.5], [rx + 1.9, 4.2, rz + 0.4], [rx - 1.9, 4.2, rz + 0.4], 3, 1)));
      colliders.push({ x0: rx - 2.1, z0: rz - 0.6, x1: rx + 2.1, z1: rz + 0.6 });
    })();
    [[-7.5, -6.0], [-6.3, -6.8]].forEach(function (c2) {
      var cry = prismMesh(matCrystal, 0, 0, 0.45 + hash2(c2[0] | 0, 3) * 0.4, 1.4 + hash2(c2[1] | 0, 7) * 1.4, 6, 1.6, 2, null, 0);
      cry.position.set(c2[0], 0, c2[1]);
      cry.rotation.z = (hash2(c2[0] | 0, 5) - 0.5) * 0.7;
      scene.add(cry);
    });

    // ---------------- satellite islands ---------------------------------
    function satIsland(x, y, z, r, build) {
      scene.add(PS1.groundGrid(matGrass, x, z, r * 2, r * 2, 3, 1, y, 1));   // groundGrid bakes world coords: no translate needed
      [[r * 0.96, -0.8], [r * 0.72, -1.6], [r * 0.45, -2.4]].forEach(function (d) {
        scene.add(prismMesh(matRock, x, z, d[0], 0.9, 10, 4.4, 0.6, null, y + d[1]));
      });
      build(x, y, z);
    }
    satIsland(27, -3, -19, 5, function (x, y, z) {           // ruin isle
      scene.add(cs(prismMesh(matRock, x - 1.2, z, 0.4, 2.6, 6, 1.4, 3)));
      scene.add(cs(prismMesh(matRock, x + 1.2, z - 1.0, 0.4, 1.8, 6, 1.4, 2.4)));
    });
    satIsland(-24, 2, -23, 4.5, function (x, y, z) {         // crystal isle
      for (var c3 = 0; c3 < 4; c3++) {
        var cry2 = prismMesh(matCrystal, 0, 0, 0.4 + hash2(c3, 3) * 0.3, 1.2 + hash2(c3, 7) * 1.6, 6, 1.6, 2, null, 0);
        cry2.position.set(x - 1.5 + c3 * 0.9, y, z + (c3 % 2) * 1.2 - 0.5);
        cry2.rotation.z = (hash2(c3, 5) - 0.5) * 0.8;
        scene.add(cry2);
      }
    });
    satIsland(20, -6, 22, 3.5, function (x, y, z) {          // waterfall isle
      scene.add(cs(prismMesh(matRock, x, z, 0.4, 2.8, 6, 1.6, 4)));
      scene.add(cs(blobMesh(ps1Material(PS1.solidTexture(96, 148, 70)), x, y + 4.4, z, 1.7, 0.7, 0.4, function () { return [1, 1.02, 0.9]; })));
    });

    // ---------------- rope bridge from the spawn islet ------------------
    (function () {
      var sx = -19.5, sz = 13.0, ex = -12.4, ez = 9.2;
      for (var p3 = 0; p3 <= 10; p3++) {
        var t = p3 / 10;
        var bx = sx + (ex - sx) * t, bz = sz + (ez - sz) * t;
        var by = 0.28 - Math.sin(Math.PI * t) * 0.5;
        scene.add(boxMesh(matRock, bx, by, bz, 1.0, 0.09, 0.75, 1.4, 0.9));
      }
      [-0.5, 0.5].forEach(function (ox) {
        for (var rs = 0; rs < 5; rs++) {
          var t2 = 0.1 + rs * 0.2;
          scene.add(boxMesh(ps1Material(PS1.solidTexture(120, 100, 76)), sx + (ex - sx) * t2 + ox * 0.6, 0.6 - Math.sin(Math.PI * t2) * 0.45, sz + (ez - sz) * t2, 0.05, 0.7, 0.05, 2));
        }
      });
    })();
    // spawn islet
    scene.add(PS1.groundGrid(matGrass, -20.5, 14.5, 5, 5, 2, 1, 0, 1).translateX(-0.0001));
    scene.add(prismMesh(matRock, -20.5, 14.5, 2.7, 1.2, 9, 4.4, 0.8, null, -1.2));

    // ---------------- waterfalls off the edges --------------------------
    var falls = [
      { x: 12.6, z: 3.5 }, { x: 6.5, z: -12.4 }, { x: -4.0, z: 13.0 }, { x: 21.5, z: 24.5 }
    ].map(function (f) {
      var w = PS1.makeParticles({
        mode: 'petal', count: 110, color: [0.82, 0.9, 0.98],
        size: 0.05, speed: 5.5, sway: 0.12,
        area: [f.x - 0.7, f.x + 0.7, f.z - 0.7, f.z + 0.7, 14], y0: -14
      });
      scene.add(w);
      return w;
    });
    // feeder stream decal on the island feeding the east fall
    decals.path([[8.5, 4.2], [10.5, 3.9], [12.2, 3.5]], 0.7, 0.9, PS1.decalMaterial(0.5, 0.62, 0.72, 0.55), 0.008);

    // ---------------- birds + pollen ------------------------------------
    var birds = [];
    for (var bd = 0; bd < 3; bd++) {
      var bird = new THREE.Group();
      var matBird = ps1Material(PS1.solidTexture(40, 38, 42));
      bird.add(boxMesh(matBird, 0, 0, 0, 0.3, 0.08, 0.08, 2));
      bird.userData = { r: 16 + bd * 5, h: 7 + bd * 2.4, ph: bd * 2.1, sp: 0.24 + bd * 0.06 };
      scene.add(bird);
      birds.push(bird);
    }
    var pollen = PS1.makeParticles({
      mode: 'dust', count: 130, color: [1.0, 0.96, 0.72],
      size: 0.02, speed: 1, sway: 0.5,
      area: [-12, 12, -12, 12, 4.5]
    });
    scene.add(pollen);

    return {
      name: '天空浮岛',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -13.0, x1: 13.0, z0: -13.0, z1: 13.0 },
      spawn: [-20.0, 13.6, Math.atan2(-(1.5 - -20.0), -(-2.0 - 13.6)), 0.0],
      idle: { pos: [-18.5, 3.4, 15.5], target: [2.0, 3.0, -5.0] },
      fog: { color: [0.80, 0.86, 0.96], near: 34, far: 95 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: falls.concat([pollen]),
      update: function (t) {
        airship.position.y = 6.2 + 0.25 * Math.sin(t * 0.6);
        airship.rotation.z = 0.02 * Math.sin(t * 0.44);
        matCrystal.uniforms.uFlicker.value = 0.85 + 0.15 * Math.sin(t * 2.3) * Math.sin(t * 0.7);
        birds.forEach(function (b) {
          var u = b.userData;
          var a = u.ph + t * u.sp;
          b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.8 + u.ph) * 0.8, Math.sin(a) * u.r);
          b.rotation.y = -a + Math.PI / 2;
          b.scale.x = 1 + 0.5 * Math.abs(Math.sin(t * 7 + u.ph));   // wing flap
        });
      }
    };
  });
})();
