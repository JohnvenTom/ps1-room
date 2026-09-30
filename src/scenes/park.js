(function () {
  'use strict';
  // ======================= 废弃游乐园 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function asphaltCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 7, 6, 3);
      var crack = vnoise(x / 14 + 4, y / 14, 4, 2);
      var r = 44 + n * 18, g = 44 + n * 18, b = 42 + n * 16;
      if (crack > 0.72) { var k = (crack - 0.72) * 2.2; r *= 1 - k * 0.55; g *= 1 - k * 0.55; b *= 1 - k * 0.5; }
      if (hash2(x, y) < 0.012) { r += 40; g += 44; b += 22; }        // weeds poking through
      return [r, g, b];
    });
  }
  function rustCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 5, 2);
      var rust = vnoise(x / 9 + 7, y / 9, 5, 2);
      var r = 96 + n * 26, g = 92 + n * 24, b = 90 + n * 22;
      if (rust > 0.6) { var k = (rust - 0.6) * 2.0; r = r * (1 - k) + 150 * k; g = g * (1 - k) + 76 * k; b = b * (1 - k) + 42 * k; }
      if (rust < 0.3) { r *= 0.8; g *= 0.8; b *= 0.82; }             // old paint
      return [r, g, b];
    });
  }
  function horseCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 4, 2);
      var r = 190 + n * 40, g = 150 + n * 34, b = 120 + n * 28;
      var peel = hash2(Math.floor(x / 9), Math.floor(y / 9));
      if (peel < 0.22) { r *= 0.5; g *= 0.5; b *= 0.5; }             // peeled patches
      return [r, g, b];
    });
  }

  var asphTex = texFrom(asphaltCanvas());
  var rustTex = texFrom(rustCanvas());
  var horseTex = texFrom(horseCanvas());

  var matAsph = ps1Material(asphTex);
  var matRust = ps1Material(rustTex);
  var matHorse = ps1Material(horseTex);
  var matMarquee = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 220, 130)));   // marquee bulbs
  var matMarqueeD = PS1.privateFlicker(ps1Material(PS1.solidTexture(90, 80, 60)));     // dead bulbs
  var matGlow = PS1.privateFlicker(ps1Material(PS1.solidTexture(160, 255, 190)));      // carousel inner glow

  var MOONP = new THREE.Vector3(-0.2, 0.7, 0.55).normalize();
  var ARCH = [0, 0, 24];     // entrance arch position (behind the spawn view)
  var parkRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOONP.x + ny * MOONP.y + nz * MOONP.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.11 + 0.24 * ndl + 0.07 * hemi;
    var g = 0.12 + 0.25 * ndl + 0.075 * hemi;
    var b = 0.14 + 0.28 * ndl + 0.08 * hemi;
    var gl = 1.1 / (1 + (x * x + y * y + z * z) * 0.004);           // faint dead-neon wash from the centre
    r += gl * 0.14; g += gl * 0.17; b += gl * 0.15;
    return [Math.min(1.1, r), Math.min(1.05, g), Math.min(1.0, b)];
  };

  PS1.registerScene(function () {
    setRelight(parkRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var dim = new THREE.DirectionalLight(0x9db4dd, 0.95);
    dim.position.copy(MOONP).multiplyScalar(36);
    dim.castShadow = true;
    dim.shadow.mapSize.set(1024, 1024);
    dim.shadow.camera.near = 2; dim.shadow.camera.far = 70;
    dim.shadow.camera.left = -24; dim.shadow.camera.right = 24;
    dim.shadow.camera.top = 24; dim.shadow.camera.bottom = -24;
    dim.shadow.bias = -0.004; dim.shadow.normalBias = 0.05;
    scene.add(dim); scene.add(dim.target);

    scene.add(PS1.makeSky({
      top: [0.02, 0.03, 0.05], horizon: [0.07, 0.08, 0.11], bottom: [0.04, 0.05, 0.06],
      sunDir: [-0.2, 0.7, 0.55], sunCol: [0.75, 0.82, 0.95], sunCut: 0.999, sunGlow: 0.35,
      stars: 0.9, meteors: 0.3, radius: 100
    }));

    // ---------------- ground + perimeter fence ---------------------------
    scene.add(PS1.groundGrid(matAsph, 0, 0, 70, 70, 10, 2, 0, 1));
    for (var fz = -30; fz <= 30; fz += 3) {
      if (Math.abs(fz - ARCH[2]) < 3) continue;                      // gate gap
      scene.add(prismMesh(matRust, -33, fz, 0.06, 2.2, 4, 0.4, 1.6, null, 0));
      scene.add(quadCorners(matRust, [-33, 2.0, fz - 1.5], [-33, 2.0, fz + 1.5], [-33, 0, fz + 1.5], [-33, 0, fz - 1.5], 1, 1));
    }

    // ---------------- the dead ferris wheel ------------------------------
    var wheel = new THREE.Group();
    var gondolas = [];
    var badBulbs = [];   // the three loose bulbs that still spark
    (function () {
      var FX = 0, FZ = -20, R = 9, AXLE_Y = R + 2.2;
      wheel.position.set(FX, AXLE_Y, FZ);
      var matBulbDead = ps1Material(PS1.solidTexture(52, 58, 66));
      // twin rims: 24 chords each side, cross-ties every 3rd node
      [-0.55, 0.55].forEach(function (zSide) {
        for (var rg = 0; rg < 24; rg++) {
          var a0 = rg / 24 * Math.PI * 2, a1 = (rg + 1) / 24 * Math.PI * 2;
          var c0 = Math.cos(a0) * R, s0 = Math.sin(a0) * R, c1 = Math.cos(a1) * R, s1 = Math.sin(a1) * R;
          var seg = boxMesh(matRust, 0, 0, 0, 0.42, 0.42, Math.hypot(c1 - c0, s1 - s0) + 0.42, 2, 0);
          seg.position.set((c0 + c1) / 2, (s0 + s1) / 2, zSide);
          seg.rotation.z = Math.atan2(s1 - s0, c1 - c0);
          wheel.add(seg);
          if (rg % 3 === 0) {
            var tie = boxMesh(matRust, 0, 0, 0, 0.2, 0.2, 1.1, 2, 0);
            tie.rotation.x = Math.PI / 2;
            tie.position.set(c0, s0, 0);
            wheel.add(tie);
          }
        }
      });
      // 12 spokes, tips aligned with the gondola mounts
      for (var sp2 = 0; sp2 < 12; sp2++) {
        var sa = sp2 / 12 * Math.PI * 2;
        var spoke = boxMesh(matRust, 0, 0, 0, 0.16, R, 0.16, 2, 0);
        spoke.position.set(Math.cos(sa) * R / 2, Math.sin(sa) * R / 2, 0);
        spoke.rotation.z = sa - Math.PI / 2;
        wheel.add(spoke);
      }
      // hub (axle itself is added to the scene, not the wheel)
      var hub = prismMesh(matRust, 0, 0, 1.3, 1.3, 8, 2, 0.8, null, -0.65);
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);
      var axle = prismMesh(matRust, 0, 0, 0.34, 6.4, 7, 1.2, 1.6, null, -0.17);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(FX, AXLE_Y, FZ);
      scene.add(axle);
      [-2.2, 2.2].forEach(function (az2) {
        scene.add(boxMesh(matRust, FX, AXLE_Y, FZ + az2, 1.1, 1.1, 0.8, 2));
      });
      // 12 gondolas, each on a spoke tip (z=0 between the rims)
      for (var gd = 0; gd < 12; gd++) {
        var ga = gd / 12 * Math.PI * 2;
        var gg = new THREE.Group();
        gg.position.set(Math.cos(ga) * R, Math.sin(ga) * R, 0);
        var arm = prismMesh(matRust, 0, 0, 0.05, 0.9, 4, 0.3, 0.6, null, 0);
        arm.position.y = -0.45;
        gg.add(arm);
        var cab = boxMesh(matHorse, 0, 0, 0, 0.95, 0.8, 0.8, 1.6);
        cab.position.y = -1.05;
        gg.add(cab);
        var roofC = boxMesh(matHorse, 0, 0, 0, 1.05, 0.12, 0.9, 1.6);
        roofC.position.y = -0.62;
        gg.add(roofC);
        var bench = boxMesh(matHorse, 0, 0, 0, 0.7, 0.1, 0.5, 1.4);
        bench.position.y = -1.15;
        gg.add(bench);
        wheel.add(gg);
        gondolas.push(gg);
      }
      scene.add(wheel);
      // dead bulb string around the front rim: outlines the circle at night,
      // three loose bulbs still spark
      for (var bl2 = 0; bl2 < 24; bl2++) {
        var ba = bl2 / 24 * Math.PI * 2;
        var bad = (bl2 === 5 || bl2 === 14 || bl2 === 19);
        var bm = bad ? PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 210, 130))) : matBulbDead;
        var bulb = boxMesh(bm, FX + Math.cos(ba) * R, AXLE_Y + Math.sin(ba) * R, FZ + 0.78,
          0.22, 0.22, 0.14, 1, 0, bad ? [1.9, 1.5, 0.7] : [0.14, 0.16, 0.18]);
        scene.add(bulb);
        if (bad) badBulbs.push({ m: bm, ph: bl2 * 0.7 });
      }
      // A-frames: two planes, legs aimed EXACTLY at the axle bearings
      [-2.2, 2.2].forEach(function (az2) {
        [-1, 1].forEach(function (lx) {
          var foot = 4.6 * lx;
          var len = Math.hypot(foot, AXLE_Y);
          var leg = prismMesh(matRust, 0, 0, 0.3, len, 5, 1, 2.2, null, 0);
          leg.position.set(FX + foot / 2, AXLE_Y / 2, FZ + az2);
          leg.rotation.z = Math.atan2(foot, AXLE_Y);
          scene.add(cs(leg));
        });
        scene.add(boxMesh(matRust, FX, AXLE_Y * 0.42, FZ + az2, 6.8, 0.24, 0.24, 2));
      });
      // longitudinal braces joining front and back frames
      [-3.4, 3.4].forEach(function (lb) {
        var brace = boxMesh(matRust, 0, 0, 0, 0.2, 0.2, 4.4, 2, 0);
        brace.rotation.x = Math.PI / 2;
        brace.position.set(FX + lb, AXLE_Y * 0.7, FZ);
        scene.add(brace);
      });
      colliders.push({ x0: FX - 5.2, z0: FZ - 3.0, x1: FX + 5.2, z1: FZ + 3.0 });
    })();

    // ---------------- the carousel that sputters --------------------------
    var carousel = new THREE.Group();
    var horses = [];
    (function () {
      var CX = 14, CZ = 4;
      carousel.position.set(CX, 0, CZ);
      carousel.add(prismMesh(matRust, 0, 0, 4.4, 0.5, 10, 4, 0.6, null, 0));
      // canopy cone with faded stripes
      var matStripe = ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var stripe = Math.sin(x * 0.98) > 0;
        var n = vnoise(x / 6, y / 10, 4, 2);
        var r = stripe ? 130 + n * 30 : 52 + n * 18, g = stripe ? 60 + n * 22 : 50 + n * 16, b = stripe ? 58 + n * 20 : 54 + n * 18;
        return [r, g, b];
      })));
      var cone = prismMesh(matStripe, 0, 0, 0.2, 1.7, 10, 4.5, 1.4, null, 4.2);
      carousel.add(cone);
      carousel.add(prismMesh(matRust, 0, 0, 0.12, 1.3, 8, 0.6, 0.5, null, 5.9));
      // centre pole + inner glow ring
      carousel.add(prismMesh(matRust, 0, 0, 0.16, 4.2, 6, 0.6, 3, null, 0.5));
      var glowRing = prismMesh(matGlow, 0, 0, 1.5, 0.24, 10, 3.2, 0.5, [0.5, 1.3, 0.9], 3.6);
      carousel.add(glowRing);
      // horses on poles
      for (var hp = 0; hp < 6; hp++) {
        var ha = hp / 6 * Math.PI * 2;
        var hg = new THREE.Group();
        hg.position.set(Math.cos(ha) * 2.7, 1.4 + (hp % 2) * 0.7, Math.sin(ha) * 2.7);
        hg.add(prismMesh(matRust, 0, 0, 0.05, 2.6, 4, 0.3, 2, null, -0.4 - (hp % 2) * 0.7));
        var body = blobMesh(matHorse, 0, 0, 0, 0.5, 1.5, 0.3, function () { return [1, 0.95, 0.85]; });
        body.scale.set(1, 0.8, 1.15);
        hg.add(body);
        var head = blobMesh(matHorse, 0.55, 0.22, 0, 0.22, 1.2, 0.25, function () { return [1, 0.95, 0.85]; });
        hg.add(head);
        hg.add(boxMesh(matRust, -0.5, 0.1, 0, 0.3, 0.4, 0.08, 1.6, 0.4));   // one broken leg
        carousel.add(hg);
        horses.push(hg);
      }
      scene.add(carousel);
      colliders.push({ x0: CX - 4.4, z0: CZ - 4.4, x1: CX + 4.4, z1: CZ + 4.4 });
    })();

    // ---------------- entrance arch + marquee letters ---------------------
    var letters = [];
    (function () {
      var word = 'LUNA';
      var dead = { L: false, U: true, N: false, A: false };          // U is burnt out
      for (var li = 0; li < word.length; li++) {
        var lx = ARCH[0] - 4.2 + li * 2.8;
        scene.add(prismMesh(matRust, lx, ARCH[2] - 0.7, 0.28, 4.6, 5, 1, 3, null, 0));
        scene.add(prismMesh(matRust, lx, ARCH[2] + 0.7, 0.28, 4.6, 5, 1, 3, null, 0));
        var board = boxMesh(matRust, lx, 5.1, ARCH[2], 2.4, 1.3, 0.24, 2);
        scene.add(board);
        var matBulb = dead[word[li]] ? matMarqueeD : PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 220, 130)));
        var bulb = boxMesh(matBulb, lx, 5.1, ARCH[2] + 0.2, 0.5, 0.7, 0.1, 1, 0,
          dead[word[li]] ? [0.25, 0.22, 0.18] : [1.8, 1.45, 0.6]);
        scene.add(bulb);
        letters.push({ m: dead[word[li]] ? null : matBulb, i: li });
      }
      scene.add(boxMesh(matRust, ARCH[0] - 6.4, 3.4, ARCH[2], 1.6, 0.9, 0.8, 2, 0.3));   // ticket booth
      colliders.push({ x0: ARCH[0] - 7.4, z0: ARCH[2] - 0.6, x1: ARCH[0] - 5.4, z1: ARCH[2] + 0.6 });
    })();

    // ---------------- bumper cars + popcorn cart + mascot -----------------
    [[-16, 10, 0.3], [-13.5, 13, 0.9], [-19, 15, 2.1], [18, -12, 0.6]].forEach(function (bc, bi) {
      var car = new THREE.Group();
      var shell = prismMesh(matHorse, 0, 0, 0.9, 0.55, 9, 2.2, 0.5, null, 0);
      car.add(shell);
      var pole = prismMesh(matRust, 0, 0, 0.05, 1.2, 4, 0.3, 0.8, null, 0.55);
      pole.rotation.z = 0.35;
      car.add(pole);
      car.position.set(bc[0], 0.35, bc[1]);
      car.rotation.y = bc[2];
      if (bi === 2) car.rotation.z = 0.7;                            // one tipped over
      scene.add(car);
      colliders.push({ x0: bc[0] - 1.0, z0: bc[1] - 1.0, x1: bc[0] + 1.0, z1: bc[1] + 1.0 });
    });
    (function () {
      var px = -8, pz = 16;
      scene.add(boxMesh(matRust, px, 0.55, pz, 1.8, 1.1, 1.0, 2));
      scene.add(boxMesh(matHorse, px, 1.35, pz, 1.0, 0.55, 0.12, 1.5, 0.35));    // broken awning
      [[-0.7], [0.7]].forEach(function (wg) {
        var w = prismMesh(matRust, 0, 0, 0.34, 0.12, 8, 1.4, 0.4, null, 0);
        w.rotation.x = Math.PI / 2;
        w.position.set(px + wg[0], 0.34, pz);
        scene.add(w);
      });
      colliders.push({ x0: px - 1.0, z0: pz - 0.7, x1: px + 1.0, z1: pz + 0.7 });
    })();
    // mascot: a peeling bear on a stump
    (function () {
      var mx = -14, mz = -6;
      scene.add(cs(prismMesh(matRust, mx, mz, 0.7, 0.7, 8, 1.8, 0.6, null, 0)));
      scene.add(blobMesh(matHorse, mx, 2.0, mz, 0.75, 1.25, 0.3, function () { return [1.05, 0.85, 0.7]; }));
      scene.add(blobMesh(matHorse, mx - 0.5, 2.9, mz, 0.24, 1, 0.2, function () { return [1.05, 0.85, 0.7]; }));
      scene.add(blobMesh(matHorse, mx + 0.5, 2.9, mz, 0.24, 1, 0.2, function () { return [1.05, 0.85, 0.7]; }));
      scene.add(blobMesh(matHorse, mx, 2.9, mz + 0.45, 0.3, 1, 0.2, function () { return [1.0, 0.8, 0.65]; }));
      colliders.push({ x0: mx - 0.9, z0: mz - 0.9, x1: mx + 0.9, z1: mz + 0.9 });
    })();

    // ---------------- weeds + crows + dust --------------------------------
    var weeds = [];
    for (var wd = 0; wd < 34; wd++) {
      var wx = -30 + hash2(wd, 13) * 60, wz = -28 + hash2(wd, 29) * 56;
      if (Math.abs(wx) < 8 && Math.abs(wz) < 10) wx += 14;
      var clump = new THREE.Group();
      clump.position.set(wx, 0, wz);
      for (var bl = 0; bl < 3; bl++) {
        var blade = prismMesh(matHorse, 0, 0, 0.05, 0.5 + hash2(wd, bl) * 0.7, 4, 0.3, 0.8, null, 0);
        blade.position.set((hash2(bl, wd) - 0.5) * 0.3, 0, (hash2(wd * 3, bl) - 0.5) * 0.3);
        blade.rotation.z = (hash2(wd, bl * 7) - 0.5) * 0.5;
        clump.add(blade);
      }
      scene.add(clump);
      weeds.push({ g: clump, ph: hash2(wd, 5) * 6 });
    }
    var crows = [];
    for (var cr = 0; cr < 5; cr++) {
      var crow = new THREE.Group();
      var cb = boxMesh(matRust, 0, 0, 0, 0.15, 0.3, 0.09, 1);
      var cw1 = boxMesh(matRust, 0, 0.06, 0, 0.32, 0.05, 0.1, 1); cw1.position.x = 0.2;
      var cw2 = boxMesh(matRust, 0, 0.06, 0, 0.32, 0.05, 0.1, 1); cw2.position.x = -0.2;
      crow.add(cb); crow.add(cw1); crow.add(cw2);
      crow.userData = { ph: cr / 5 * Math.PI * 2, r: 5 + hash2(cr, 3) * 3, y: 8 + hash2(cr, 5) * 2.5, wings: [cw1, cw2] };
      scene.add(crow);
      crows.push(crow);
    }
    var dust = PS1.makeParticles({
      mode: 'dust', count: 170, color: [0.42, 0.42, 0.40],
      size: 0.05, speed: 0.4, sway: 1.0,
      area: [-24, 24, -22, 18, 2.6], y0: 0.2
    });
    scene.add(dust);

    // power-surge state: every ~26 s the park blinks half-alive then dies
    var surge = { next: 8 };

    return {
      name: '废弃游乐园',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -26, x1: 26, z0: -24, z1: 21 },
      spawn: [0.0, 18.0, Math.PI, 0.04],
      idle: { pos: [-1.6, 2.6, 20.5], target: [7.5, 6.0, -14.0] },   // dead ferris wheel left-of-centre, carousel with its glow cones in from the right
      fog: { color: [0.05, 0.06, 0.08], near: 18, far: 72 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [dust],
      update: function (t) {
        // ferris wheel: rusted bearing - it strains, freezes, then breaks free
        // one 15-degree notch every 4.5 s: slow fight (0-2.5 s), snap (0.5 s), settle (1.5 s)
        var CYC = 4.5, STEP = Math.PI / 12;
        var k = t % CYC;
        var prog = k < 2.5 ? 0.06 * (k / 2.5) : k < 3.0 ? 0.06 + 0.94 * (k - 2.5) / 0.5 : 1 - 0.035 * (1 - (k - 3.0) / 1.5);
        var lurch = Math.floor(t / CYC);
        wheel.rotation.z = -(lurch + prog) * STEP;
        var snap = (k > 2.5 && k < 3.05) ? 1 : 0;
        gondolas.forEach(function (g, i) {
          g.rotation.z = -wheel.rotation.z + 0.09 * Math.sin(t * 0.8 + i * 1.3) + snap * 0.3 * Math.sin(i * 2.1);
        });
        // the three loose bulbs spark, each on its own erratic schedule
        badBulbs.forEach(function (b) {
          var spark = (Math.sin(t * 7.3 + b.ph) > 0.86 || Math.sin(t * 2.1 + b.ph * 3) > 0.965);
          b.m.uniforms.uFlicker.value = spark ? 1.6 : 0.06;
        });
        // carousel sputter: every 19 s it wakes, spins and dies again
        var cyc = (t + 6) % 19;
        var spin = 0;
        if (cyc < 7) {
          var f = cyc / 7;
          spin = (f * f * (3 - 2 * f)) * 2.2;                        // smooth step up
        } else if (cyc < 12) {
          spin = 2.2 + (cyc - 7) * 1.8;
        } else {
          spin = 11.2 + (cyc - 12) * 0.9 * Math.max(0, 1 - (cyc - 12) / 5);
        }
        carousel.rotation.y = spin * 0.9;
        var alive = cyc > 0 && cyc < 12 ? 1 : 0;
        matGlow.uniforms.uFlicker.value = alive ? (0.75 + 0.25 * Math.sin(t * 17.0)) : 0.06 + 0.04 * Math.sin(t * 1.1);
        horses.forEach(function (h, i) {
          h.position.y = 1.4 + (i % 2) * 0.7 + (alive ? 0.18 * Math.sin(t * 2.2 + i * 1.1) : 0);
        });
        // marquee bulbs: slow chase, the dead U stays dark
        letters.forEach(function (lt) {
          if (!lt.m) return;
          var on = ((t * 1.4 + lt.i * 0.9) % 6) < 4.2;               // bulb chase around the sign
          lt.m.uniforms.uFlicker.value = on ? 1.5 : 0.25;
        });
        // whole-park power surge: a brief green-white flash every ~26 s
        var s2 = 0;
        if (t > surge.next) {
          var since = t - surge.next;
          if (since < 0.06) s2 = 0.7;
          else if (since < 0.5) s2 = 0.15;
          else if (since > 1.1) surge.next = t + 20 + Math.random() * 14;
        }
        PS1.shared.uFlash.value = s2 * (0.8 + 0.2 * Math.sin(t * 83.0)) * (s2 > 0 ? 1 : 0);
        weeds.forEach(function (w) {
          w.g.rotation.x = 0.14 * Math.sin(t * 1.6 + w.ph);
          w.g.rotation.z = 0.11 * Math.cos(t * 1.2 + w.ph * 1.7);
        });
        crows.forEach(function (c) {
          var u = c.userData;
          var a = u.ph + t * 0.32;
          c.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.7 + u.ph) * 0.5, -20 + Math.sin(a) * u.r);
          c.rotation.y = -a;
          var flap = Math.sin(t * 6.4 + u.ph * 4) * 0.5;
          u.wings[0].rotation.z = flap;
          u.wings[1].rotation.z = -flap;
        });
      }
    };
  });
})();
