(function () {
  'use strict';
  // ======================= 血月古战场 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function mudCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 8, 6, 3);
      var rut = Math.sin(y * 0.32 + vnoise(x / 12, y / 12, 4, 2) * 4);
      var r = 44 + n * 22 + rut * 9, g = 32 + n * 16 + rut * 6, b = 26 + n * 12 + rut * 5;
      var blood = vnoise(x / 15 + 9, y / 15, 4, 2);
      if (blood > 0.76) { var k = (blood - 0.76) * 1.8; r += k * 52; g += k * 8; b += k * 4; }   // old blood pools
      var bone = hash2(x + 23, y + 61);
      if (bone > 0.988) { r += 90; g += 84; b += 70; }
      return [r, g, b];
    });
  }
  function woodCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 14, 5, 2);
      var r = 52 + n * 20, g = 38 + n * 15, b = 28 + n * 11;
      return [r, g, b];
    });
  }
  function bannerCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 9, 5, 2);
      var r = 132 + n * 40, g = 40 + n * 18, b = 32 + n * 14;
      var sig = vnoise(x / 20 + 4, y / 20, 3, 2);
      if (sig > 0.66) { r *= 0.5; g *= 0.5; b *= 0.55; }             // faded device
      if (y > 42 + Math.sin(x * 0.45) * 10) { r *= 0.14; g *= 0.14; b *= 0.14; }   // shot-torn edge
      return [r, g, b];
    });
  }

  var mudTex = texFrom(mudCanvas());
  var woodTex = texFrom(woodCanvas());
  var bannerTex = texFrom(bannerCanvas());

  var matMud = ps1Material(mudTex);
  var matWood = ps1Material(woodTex);
  var matSpear = ps1Material(PS1.solidTexture(74, 58, 44));
  var matBanner = ps1Material(bannerTex);
  var matWill = PS1.privateFlicker(ps1Material(PS1.solidTexture(120, 255, 150)));    // ghost-fire
  var matEmber = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 150, 60)));    // ember pit

  var BLOODMOON = new THREE.Vector3(0.06, 0.20, -0.98).normalize();
  var WILL1 = [-5.4, 1.1, -7.0], WILL2 = [5.8, 1.1, -9.5], EMBER = [0.5, 0.6, -19.0];
  function pointW(x, y, z, nx, ny, nz, lp, cr, cg, cb, pk) {
    var dx = lp[0] - x, dy = lp[1] - y, dz = lp[2] - z;
    var d2 = dx * dx + dy * dy + dz * dz;
    var fall = pk / (1 + d2 * 0.02);
    var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) / (Math.sqrt(d2) + 1e-4));
    var w = fall * (0.4 + 0.6 * nd);
    return [w * cr, w * cg, w * cb];
  }
  var warRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * BLOODMOON.x + ny * BLOODMOON.y + nz * BLOODMOON.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.16 + 0.25 * ndl + 0.08 * hemi;
    var g = 0.07 + 0.10 * ndl + 0.055 * hemi;
    var b = 0.06 + 0.09 * ndl + 0.06 * hemi;
    var w1 = pointW(x, y, z, nx, ny, nz, WILL1, 0.25, 1.0, 0.35, 1.5);
    var w2 = pointW(x, y, z, nx, ny, nz, WILL2, 0.25, 1.0, 0.35, 1.5);
    var e1 = pointW(x, y, z, nx, ny, nz, EMBER, 1.1, 0.6, 0.22, 1.9);
    r += w1[0] + w2[0] + e1[0]; g += w1[1] + w2[1] + e1[1]; b += w1[2] + w2[2] + e1[2];
    return [Math.min(1.15, r), Math.min(1.1, g), Math.min(1.05, b)];
  };

  PS1.registerScene(function () {
    setRelight(warRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var dim = new THREE.DirectionalLight(0xcc5533, 1);
    dim.position.copy(BLOODMOON).multiplyScalar(38);
    dim.castShadow = true;
    dim.shadow.mapSize.set(1024, 1024);
    dim.shadow.camera.near = 2; dim.shadow.camera.far = 64;
    dim.shadow.camera.left = -20; dim.shadow.camera.right = 20;
    dim.shadow.camera.top = 20; dim.shadow.camera.bottom = -20;
    dim.shadow.bias = -0.004; dim.shadow.normalBias = 0.05;
    scene.add(dim); scene.add(dim.target);

    scene.add(PS1.makeSky({
      top: [0.08, 0.03, 0.04], horizon: [0.34, 0.10, 0.055], bottom: [0.10, 0.04, 0.03],
      sunDir: BLOODMOON.toArray(), sunCol: [1.2, 0.22, 0.08], sunCut: 0.9986, sunGlow: 2.4,
      stars: 0.4, meteors: 0, radius: 100
    }));

    // ---------------- the plain ------------------------------------------
    scene.add(PS1.groundGrid(matMud, 0, -18, 110, 100, 12, 2, 0, 1));
    // low ridgelines to cup the horizon
    scene.add(cs(boxMesh(matMud, -34, 1.2, -44, 44, 2.4, 14, 3)));
    scene.add(cs(boxMesh(matMud, 30, 1.6, -50, 52, 3.2, 16, 3)));

    // ---------------- the spear forest ------------------------------------
    // hundreds of planted spears marching into the fog; some still fly banners
    var banners = [];
    for (var sp = 0; sp < 170; sp++) {
      var ang = hash2(sp, 3) * Math.PI * 2;
      var rr = 6 + Math.pow(hash2(sp, 7), 0.65) * 38;
      var px = Math.cos(ang) * rr, pz = -8 - Math.abs(Math.sin(ang)) * rr * 0.9 - hash2(sp, 11) * 10;
      if (Math.abs(px) < 4.5 && pz > -14) continue;                    // keep the near stage clear
      var h = 2.1 + hash2(sp, 13) * 1.1;
      var spear = prismMesh(matSpear, 0, 0, 0.035, h, 5, 0.4, 1.6, null, 0);
      spear.rotation.z = (hash2(sp, 17) - 0.5) * 0.55;
      spear.rotation.x = (hash2(sp, 19) - 0.5) * 0.35;
      spear.position.set(px, h * 0.42, pz);
      scene.add(cs(spear));
      if (hash2(sp, 23) > 0.84) {
        var bw = 0.7 + hash2(sp, 29) * 0.5;
        var pivot = new THREE.Group();
        pivot.position.set(px, h * 0.92, pz);
        pivot.add(quadCorners(matBanner,
          [0, 0, -0.02], [0, 0, bw],
          [0, -bw * 1.35, bw * 0.92], [0, -bw * 1.35, -0.02], 0.8, 1));
        scene.add(pivot);
        banners.push(pivot);
      }
    }
    // spent arrows studding the near ground
    for (var ar = 0; ar < 40; ar++) {
      var ax = -14 + hash2(ar, 31) * 28, az = -16 + hash2(ar, 37) * 26;
      var arrow = prismMesh(matSpear, 0, 0, 0.016, 0.55, 4, 0.3, 0.6, null, 0);
      arrow.rotation.z = 0.9 + hash2(ar, 41) * 0.5;
      arrow.rotation.y = hash2(ar, 43) * Math.PI * 2;
      arrow.position.set(ax, 0.14, az);
      scene.add(arrow);
    }
    // fallen helms + shields half-buried
    for (var hd = 0; hd < 12; hd++) {
      var hx = -16 + hash2(hd, 47) * 32, hz = -20 + hash2(hd, 51) * 26;
      scene.add(blobMesh(matWood, hx, 0.16, hz, 0.34, 0.55, 0.35, function () { return [0.7, 0.62, 0.5]; }));
    }

    // ---------------- the shield wall (near stage) ------------------------
    for (var sw = 0; sw < 9; sw++) {
      var sx = -4.4 + sw * 1.1;
      var shield = prismMesh(matWood, 0, 0, 0.5, 0.09, 9, 1.4, 0.4, null, 0);
      shield.rotation.x = -Math.PI / 2 + (hash2(sw, 55) - 0.5) * 0.2;
      shield.position.set(sx, 1.05, -1.6 + hash2(sw, 57) * 0.5);
      scene.add(cs(shield));
    }
    colliders.push({ x0: -5.2, z0: -2.2, x1: 5.2, z1: -0.9 });

    // ---------------- broken catapult ------------------------------------
    (function () {
      var cx = 9.5, cz = -6.5;
      scene.add(cs(boxMesh(matWood, cx, 0.5, cz, 3.2, 0.5, 2.0, 2)));
      [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]].forEach(function (w) {
        var wheel = prismMesh(matWood, 0, 0, 0.62, 0.14, 9, 1.6, 0.4, null, 0);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(cx + w[0], 0.62, cz + w[1]);
        scene.add(wheel);
      });
      var arm = boxMesh(matWood, 0, 0, 0, 0.28, 5.2, 0.28, 2, 0);
      arm.rotation.z = 0.85;
      arm.position.set(cx, 2.0, cz);
      scene.add(cs(arm));
      scene.add(boxMesh(matWood, cx - 1.35, 3.6, cz, 0.9, 0.5, 0.9, 1.6, 0.5));   // released spoon
      colliders.push({ x0: cx - 1.9, z0: cz - 1.3, x1: cx + 1.9, z1: cz + 1.3 });
    })();

    // ---------------- the dead tree + crow flock -------------------------
    var crows = [];
    (function () {
      var tx = -8.5, tz = -13.0;
      scene.add(cs(prismMesh(matWood, tx, tz, 0.4, 5.5, 7, 1.6, 3, null, 0)));
      [[0.5, -0.6], [-0.7, 0.4], [0.3, 1.2]].forEach(function (b, bi) {
        scene.add(boxMesh(matWood, tx + b[0] * 1.6, 4.9 + b[1], tz, 2.6, 0.18, 0.16, 2, b[0] > 0 ? 0.45 : -0.45 + bi * 0.1));
      });
      colliders.push({ x0: tx - 0.7, z0: tz - 0.7, x1: tx + 0.7, z1: tz + 0.7 });
      for (var cr = 0; cr < 7; cr++) {
        var crow = new THREE.Group();
        var cbody = boxMesh(matWood, 0, 0, 0, 0.16, 0.3, 0.09, 1);
        var cwing1 = boxMesh(matWood, 0, 0.06, 0, 0.34, 0.05, 0.1, 1);
        var cwing2 = boxMesh(matWood, 0, 0.06, 0, 0.34, 0.05, 0.1, 1);
        cwing1.position.x = 0.2; cwing2.position.x = -0.2;
        crow.add(cbody); crow.add(cwing1); crow.add(cwing2);
        crow.userData = { ph: cr / 7 * Math.PI * 2, r: 2.4 + hash2(cr, 9) * 2.2, y: 4.6 + hash2(cr, 5) * 2.4, wings: [cwing1, cwing2] };
        scene.add(crow);
        crows.push(crow);
      }
    })();

    // ---------------- ghost-fires + ember pit ------------------------------
    (function () {
      [WILL1, WILL2].forEach(function (lp) {
        scene.add(blobMesh(matWood, lp[0], 0.3, lp[2], 0.5, 0.5, 0.4, function () { return [0.5, 0.45, 0.4]; }));   // bone pile
        scene.add(blobMesh(matWill, lp[0], lp[1] + 0.15, lp[2], 0.2, 1.7, 0.25, function () { return [1.4, 1.9, 1.5]; }));
        for (var st = 0; st < 4; st++) {
          var stake = prismMesh(matSpear, 0, 0, 0.05, 1.6, 5, 0.4, 1, null, 0);
          stake.rotation.z = 0.35 + st * 0.12;
          stake.position.set(lp[0] - 0.6 + st * 0.4, 0.7, lp[2] + 0.55);
          scene.add(stake);
        }
      });
      scene.add(blobMesh(matWood, EMBER[0], 0.22, EMBER[2], 1.5, 0.4, 0.5, function () { return [0.35, 0.22, 0.15]; }));
      scene.add(blobMesh(matEmber, EMBER[0], EMBER[1], EMBER[2], 1.1, 0.35, 0.5, function () { return [1.9, 1.2, 0.5]; }));
    })();

    // ---------------- drifting particles -----------------------------------
    var embers = PS1.makeParticles({
      mode: 'steam', count: 160, color: [1.0, 0.55, 0.25],
      size: 0.025, speed: 1.6, sway: 0.8,
      area: [EMBER[0] - 2, EMBER[0] + 2, EMBER[2] - 2, EMBER[2] + 2, 6], y0: 0.4
    });
    var mist = PS1.makeParticles({
      mode: 'dust', count: 200, color: [0.4, 0.22, 0.16],
      size: 0.06, speed: 0.5, sway: 1.1,
      area: [-26, 26, -34, 6, 2.2], y0: 0.3
    });
    scene.add(embers); scene.add(mist);

    return {
      name: '血月古战场',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -13.5, x1: 13.5, z0: -9.5, z1: 8.5 },
      spawn: [0.0, 5.5, 0.0, 0.06],
      idle: { pos: [2.2, 2.4, 9.5], target: [0.0, 3.4, -40.0] },   // over the shield wall, down the spear rows to the blood moon
      fog: { color: [0.24, 0.08, 0.05], near: 9, far: 46 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [embers, mist],
      update: function (t) {
        matWill.uniforms.uFlicker.value = 0.7 + 0.3 * Math.abs(Math.sin(t * 2.3) * Math.sin(t * 0.7));
        matEmber.uniforms.uFlicker.value = 0.8 + 0.2 * Math.sin(t * 9.0) * Math.sin(t * 2.1);
        banners.forEach(function (b, i) {
          b.rotation.y = 0.12 * Math.sin(t * 1.9 + i * 1.3);
        });
        crows.forEach(function (c) {
          var u = c.userData;
          var a = u.ph + t * 0.35;
          c.position.set(-8.5 + Math.cos(a) * u.r, u.y + Math.sin(t * 0.8 + u.ph) * 0.4, -13.0 + Math.sin(a) * u.r);
          c.rotation.y = -a;
          var flap = Math.sin(t * 7.0 + u.ph * 3) * 0.55;
          u.wings[0].rotation.z = flap;
          u.wings[1].rotation.z = -flap;
        });
      }
    };
  });
})();
