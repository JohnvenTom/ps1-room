(function () {
  'use strict';
  // ======================= 暴风灯塔崖 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function cliffCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 7, 8, 3);
      var strata = Math.sin(y * 0.42 + vnoise(x / 12, y / 12, 4, 2) * 3);
      var r = 42 + n * 24 + strata * 8, g = 44 + n * 24 + strata * 8, b = 50 + n * 26 + strata * 9;
      var wet = vnoise(x / 10 + 6, y / 16, 5, 2);
      if (wet > 0.7 && y > 40) { var k = (wet - 0.7) * 1.6; r *= 1 - k * 0.6; g *= 1 - k * 0.6; b *= 1 - k * 0.5; }
      var sp = hash2(x + 3, y + 29);
      if (sp < 0.05) { r *= 1.4; g *= 1.4; b *= 1.35; }
      return [r, g, b];
    });
  }
  function stormSeaCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 9, 6, 3);
      var w1 = Math.sin((x + Math.sin(y * 0.28) * 7) * 0.36);
      var w2 = Math.sin((y + Math.sin(x * 0.24) * 6) * 0.3 + 1.9);
      var k = 0.72 + 0.16 * w1 + 0.14 * w2;
      var r = 20 * k + n * 10, g = 30 * k + n * 12, b = 40 * k + n * 14;
      if (w1 > 0.86 && w2 > 0.5) { r += 120; g += 132; b += 138; }   // whitecaps
      return [r, g, b];
    });
  }
  function towerCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var band = Math.floor(y / 16) % 2 === 0;
      var n = vnoise(x / 8, y / 8, 5, 2);
      var r, g, b;
      if (band) { r = 208 + n * 24; g = 204 + n * 22; b = 196 + n * 20; }
      else { r = 158 + n * 24; g = 44 + n * 12; b = 38 + n * 10; }
      var grime = vnoise(x / 10 + 2, y / 26, 4, 2);
      if (grime > 0.68) { var k = (grime - 0.68) * 1.3; r *= 1 - k * 0.45; g *= 1 - k * 0.42; b *= 1 - k * 0.4; }
      return [r, g, b];
    });
  }

  var cliffTex = texFrom(cliffCanvas());
  var seaTex = texFrom(stormSeaCanvas());
  var towerTex = texFrom(towerCanvas());

  var matCliff = ps1Material(cliffTex);
  var matSea = ps1Material(seaTex);
  var matTower = ps1Material(towerTex);
  var matLantern = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 235, 170)));
  var matBeam = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 244, 190)));
  var matWindowWarm = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 200, 110)));
  var matBlinkG = PS1.privateFlicker(ps1Material(PS1.solidTexture(120, 255, 150)));   // buoy light

  var MOONLESS = new THREE.Vector3(-0.34, 0.52, 0.44).normalize();  // storm glow direction
  var LHOUSE = [-5.0, 16.2, -7.0];                                   // lantern light position
  var stormRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOONLESS.x + ny * MOONLESS.y + nz * MOONLESS.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.10 + 0.14 * ndl + 0.03 * hemi;
    var g = 0.12 + 0.16 * ndl + 0.035 * hemi;
    var b = 0.16 + 0.20 * ndl + 0.045 * hemi;
    var dx = LHOUSE[0] - x, dy = LHOUSE[1] - y, dz = LHOUSE[2] - z;
    var d2 = dx * dx + dy * dy + dz * dz;
    var fall = 1.9 / (1 + d2 * 0.012);
    var inv = 1 / (Math.sqrt(d2) + 1e-4);
    var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
    var w = fall * (0.4 + 0.6 * nd);
    r += w * 1.25; g += w * 1.05; b += w * 0.7;
    return [Math.min(1.15, r), Math.min(1.1, g), Math.min(1.05, b)];
  };

  PS1.registerScene(function () {
    setRelight(stormRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var dim = new THREE.DirectionalLight(0x8899bb, 1);
    dim.position.copy(MOONLESS).multiplyScalar(34);
    dim.castShadow = true;
    dim.shadow.mapSize.set(1024, 1024);
    dim.shadow.camera.near = 2; dim.shadow.camera.far = 60;
    dim.shadow.camera.left = -20; dim.shadow.camera.right = 20;
    dim.shadow.camera.top = 20; dim.shadow.camera.bottom = -20;
    dim.shadow.bias = -0.004; dim.shadow.normalBias = 0.05;
    scene.add(dim); scene.add(dim.target);

    scene.add(PS1.makeSky({
      top: [0.03, 0.04, 0.07], horizon: [0.11, 0.13, 0.18], bottom: [0.05, 0.06, 0.08],
      sunDir: MOONLESS.toArray(), sunCol: [0, 0, 0], stars: 0, meteors: 0.7, radius: 100
    }));

    // ---------------- storm sea -----------------------------------------
    scene.add(PS1.groundGrid(matSea, 0, -28, 170, 130, 10, 2, 0, 1));
    // cliff promontory: stacked rock tiers rising to the platform (y 6)
    (function () {
      scene.add(cs(boxMesh(matCliff, 0, 3.0, -26, 30, 6, 14, 1.0)));      // base tier out at sea
      scene.add(cs(boxMesh(matCliff, 1.5, 6.5, -18, 24, 5, 12, 1.0)));
      scene.add(cs(boxMesh(matCliff, 2.5, 9.0, -10, 18, 4, 10, 1.0)));    // platform tier
      // jagged sea stacks
      [[-16, -34, 9], [12, -40, 11], [-6, -46, 7]].forEach(function (s4) {
        var stack = prismMesh(matCliff, 0, 0, s4[2] / 2, s4[2], 6, 2.4, 4, null, 0);
        stack.position.set(s4[0], 0, s4[1]);
        stack.rotation.z = (hash2(s4[0] | 0, 3) - 0.5) * 0.2;
        scene.add(cs(stack));
      });
    })();
    var PLATFORM = 11.0;   // walkable deck y
    scene.add(PS1.groundGrid(matCliff, 2.5, -10, 18, 10, 4, 1, PLATFORM, 1));

    // ---------------- the lighthouse ------------------------------------
    var beamGroup = new THREE.Group();
    (function () {
      var LX = -5.0, LZ = -7.0;
      // keeper's cottage
      scene.add(cs(boxMesh(matCliff, LX + 4.6, PLATFORM + 1.3, LZ + 0.4, 4.6, 2.6, 3.8, 1.0)));
      scene.add(cs(quadCorners(matTower, [LX + 2.4, PLATFORM + 2.7, LZ - 1.4], [LX + 6.8, PLATFORM + 2.7, LZ - 1.4], [LX + 6.4, PLATFORM + 3.7, LZ + 0.4], [LX + 2.8, PLATFORM + 3.7, LZ + 0.4], 3, 1.6)));
      scene.add(cs(quadCorners(matTower, [LX + 2.4, PLATFORM + 2.7, LZ + 2.2], [LX + 6.8, PLATFORM + 2.7, LZ + 2.2], [LX + 6.4, PLATFORM + 3.7, LZ + 0.4], [LX + 2.8, PLATFORM + 3.7, LZ + 0.4], 3, 1.6)));
      scene.add(boxMesh(matWindowWarm, LX + 4.6, PLATFORM + 1.5, LZ + 2.32, 0.9, 0.8, 0.06, 2, 0, [1.4, 0.95, 0.4]));
      scene.add(boxMesh(matWindowWarm, LX + 6.85, PLATFORM + 1.5, LZ + 0.4, 0.06, 0.8, 0.9, 2, 0, [1.4, 0.95, 0.4]));
      scene.add(cs(boxMesh(matTower, LX + 4.6, PLATFORM + 4.0, LZ + 1.6, 0.5, 1.4, 0.5, 1.4)));      // chimney
      colliders.push({ x0: LX + 2.2, z0: LZ - 1.5, x1: LX + 7.0, z1: LZ + 2.3 });
      // tapered striped tower
      scene.add(cs(prismMesh(matTower, LX, LZ, 1.7, 4.4, 9, 3.2, 6, null, PLATFORM)));
      scene.add(cs(prismMesh(matTower, LX, LZ, 1.45, 4.2, 9, 2.8, 6, null, PLATFORM + 4.4)));
      scene.add(cs(prismMesh(matTower, LX, LZ, 1.2, 3.6, 9, 2.4, 5, null, PLATFORM + 8.6)));
      // gallery ring + railing
      scene.add(prismMesh(matTower, LX, LZ, 1.75, 0.3, 9, 3.2, 0.5, null, PLATFORM + 12.0));
      for (var g2 = 0; g2 < 10; g2++) {
        var ga = g2 / 10 * Math.PI * 2;
        scene.add(boxMesh(matTower, LX + Math.cos(ga) * 1.7, PLATFORM + 12.6, LZ + Math.sin(ga) * 1.7, 0.07, 0.9, 0.07, 2));
      }
      // lantern room + dome
      scene.add(boxMesh(matLantern, LX, PLATFORM + 12.9, LZ, 1.5, 1.5, 1.5, 2, 0, [2.0, 1.8, 1.1]));
      scene.add(prismMesh(matTower, LX, LZ, 1.0, 0.8, 8, 2.4, 1.2, null, PLATFORM + 13.6));
      colliders.push({ x0: LX - 1.9, z0: LZ - 1.9, x1: LX + 1.9, z1: LZ + 1.9 });
      // rotating twin beam
      beamGroup.position.set(LX, PLATFORM + 12.9, LZ);
      var b1 = prismMesh(matBeam, 0, 0, 0.55, 16, 4, 1, 0.6, null, -0.3);
      b1.rotation.z = Math.PI / 2;
      b1.scale.set(1, 1, 1);
      beamGroup.add(b1);
      var b2 = prismMesh(matBeam, 0, 0, 0.55, 16, 4, 1, 0.6, null, -0.3);
      b2.rotation.z = Math.PI / 2;
      b2.position.x = 0;
      beamGroup.add(b2);
      b2.rotation.y = Math.PI;
      scene.add(beamGroup);
    })();

    // ---------------- platform props ------------------------------------
    // railing fence along the east cliff edge
    (function () {
      for (var f2 = 0; f2 < 9; f2++) {
        scene.add(cs(boxMesh(matTower, 10.6, PLATFORM + 0.45, -14.5 + f2 * 1.1, 0.09, 0.9, 0.09, 2)));
      }
      scene.add(boxMesh(matTower, 10.6, PLATFORM + 0.78, -10, 0.06, 0.08, 9.0, 1.4));
    })();
    // wrecked rowboat + crates + bollards + fog horn
    (function () {
      var bx = 6.5, bz = -6.0;
      var hull3 = prismMesh(matTower, 0, 0, 0.7, 0.55, 6, 2, 1, null, 0);
      hull3.scale.set(1, 0.5, 1.6);
      hull3.rotation.z = 0.3;
      hull3.position.set(bx, PLATFORM + 0.3, bz);
      scene.add(cs(hull3));
      colliders.push({ x0: bx - 1.2, z0: bz - 0.8, x1: bx + 1.2, z1: bz + 0.8 });
      scene.add(cs(boxMesh(matTower, 8.4, PLATFORM + 0.4, -8.6, 0.8, 0.8, 0.8, 1.3, 0.3)));
      [[1.6, -13.5], [3.2, -13.2]].forEach(function (bo) {
        scene.add(prismMesh(matTower, bo[0], bo[1], 0.25, 0.4, 7, 1.6, 0.6, null, PLATFORM));
      });
      colliders.push({ x0: 1.2, z0: -14, x1: 3.7, z1: -12.6 });
      // fog horn on the cottage roof
      var horn = prismMesh(matTower, 0, 0, 0.28, 0.9, 6, 1.8, 1.2, null, 0);
      horn.rotation.z = Math.PI / 2 - 0.25;
      horn.position.set(-1.4, PLATFORM + 3.6, -6.2);
      scene.add(horn);
    })();
    // buoy in the sea (bobbing, blinking)
    var buoy = new THREE.Group();
    (function () {
      buoy.add(prismMesh(ps1Material(PS1.solidTexture(190, 60, 40)), 0, 0, 0.5, 0.9, 7, 1.8, 1.2));
      buoy.add(boxMesh(matBlinkG, 0, 1.0, 0, 0.14, 0.14, 0.14, 2, 0, [1.5, 1.8, 1.5]));
      buoy.position.set(16, 0.4, 6);
      scene.add(buoy);
    })();
    // rock rubble + grass tufts on the platform
    [[8.8, -12.4], [-1.0, -13.8], [6.0, -13.0]].forEach(function (rb) {
      scene.add(blobMesh(matCliff, rb[0], PLATFORM + 0.25, rb[1], 0.4 + hash2(rb[0] | 0, 3) * 0.3, 0.7, 0.4, function (sd) { return [0.9, 0.95, 1.0]; }));
    });

    // ---------------- towering waves --------------------------------------
    var matWave = ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 6, 2);
      var k = 0.7 + n * 0.5;
      var r = 16 * k, g = 26 * k, b = 40 * k;
      if (y < 10) { r += 150; g += 160; b += 165; }                 // foam crest along the top
      else if (y < 16) { r += 60; g += 68; b += 72; }
      var streak = hash2(x, Math.floor(y / 6));
      if (streak < 0.18 && y < 26) { r += 70; g += 76; b += 80; }   // streaky foam
      return [r, g, b];
    })));
    var matFoam = ps1Material(PS1.solidTexture(225, 232, 238));
    var waves = [];
    // 7 ridge waves: [len, height, speed, startX, startZ] - big ones further out
    [[34, 6.4, 5.4, -20, -58], [30, 7.0, 4.6, 8, -66], [24, 4.4, 6.2, -32, -48],
     [22, 4.0, 5.8, 26, -44], [20, 3.2, 7.0, -46, -40], [18, 3.0, 6.6, 40, -38],
     [26, 5.2, 5.0, -4, -76]].forEach(function (w, wi) {
      var ridge = blobMesh(matWave, 0, 0, 0, 1, 1.6, 0.32, function () { return [1, 1, 1.05]; });
      ridge.scale.set(w[0], w[1], w[2 !== undefined ? 5 : 5]);
      ridge.userData = { len: w[0], h: w[1], sp: w[2], x: w[3], z: w[4], hit: -9, wi: wi };
      ridge.position.set(w[3], 0.4, w[4]);
      ridge.rotation.z = 0.06 * Math.sin(wi * 2.1);
      scene.add(ridge);
      waves.push(ridge);
      // paired splash blob (hidden until impact)
      var splash = blobMesh(matFoam, 0, 0, 0, 1.6, 1.3, 0.5, function () { return [1, 1, 1]; });
      splash.visible = false;
      splash.userData = { t: -9 };
      scene.add(splash);
      ridge.userData.splash = splash;
    });
    var IMPACT_Z = -23.5;   // middle cliff tier front face

    // wind-whipped flag on the platform
    var flag = new THREE.Group();
    (function () {
      var fx = 7.6, fz = -12.6;
      scene.add(cs(prismMesh(matTower, fx, fz, 0.06, 3.4, 6, 1, 4)));
      flag.position.set(fx, PLATFORM + 3.0, fz);
      flag.add(quadCorners(ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var n = vnoise(x / 8, y / 10, 5, 2);
        var r = 30 + n * 24, g = 34 + n * 22, b = 44 + n * 26;
        if (y > 40 + Math.sin(x * 0.5) * 7) { r *= 0.1; g *= 0.1; b *= 0.1; }   // tattered tail
        return [r, g, b];
      }))), [0, 0, -0.02], [0, 0, 0.55], [0, -0.5, 0.55], [0, -0.5, -0.02], 0.8, 1));
      scene.add(flag);
      colliders.push({ x0: fx - 0.15, z0: fz - 0.15, x1: fx + 0.15, z1: fz + 0.15 });
    })();

    // ---------------- weather -------------------------------------------
    var rain = PS1.makeParticles({
      mode: 'rain', count: 1600, color: [0.68, 0.76, 0.94],
      size: 0.022, speed: 19, sway: -1.1,   // wind-lashed slant
      area: [-26, 26, -74, 12, 26], y0: 3
    });
    var spray1 = PS1.makeParticles({
      mode: 'steam', count: 90, color: [0.72, 0.78, 0.85],
      size: 0.06, speed: 1.4, sway: 0.5,
      area: [4, 8, -25, -21, 5], y0: 0.5
    });
    var spray2 = PS1.makeParticles({
      mode: 'steam', count: 90, color: [0.72, 0.78, 0.85],
      size: 0.06, speed: 1.3, sway: 0.5,
      area: [-8, -4, -26, -22, 4.5], y0: 0.5
    });
    var spindrift = PS1.makeParticles({
      mode: 'dust', count: 160, color: [0.78, 0.83, 0.9],
      size: 0.02, speed: 1, sway: 0.7,
      area: [-8, 12, -16, -4, 2.2], y0: PLATFORM
    });
    scene.add(rain); scene.add(spray1); scene.add(spray2); scene.add(spindrift);

    var strike = { next: 4, until: -1, peak: 0 };
    return {
      name: '暴风灯塔崖',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -6.2, x1: 11.0, z0: -14.5, z1: -5.4 },
      spawn: [8.0, -7.0, Math.atan2(-(-5.0 - 8.0), -(-7.0 - -7.0)), 0.0],
      eyeY: PLATFORM + 1.62,   // BUG FIX: platform deck is y=11, default eye 1.62 put the walker at sea level
      idle: { pos: [-1.8, PLATFORM + 15.0, 5.5], target: [-5.0, 6.5, -58.0] },   // high behind the lantern: dome + beams foreground, wave corridor + stacks below
      fog: { color: [0.10, 0.12, 0.17], near: 16, far: 92 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [rain, spray1, spray2, spindrift],
      update: function (t) {
        seaTex.offset.x = t * 0.05;
        seaTex.offset.y = t * 0.09;
        beamGroup.rotation.y = t * 0.7;   // the sweeping beam
        matLantern.uniforms.uFlicker.value = 0.92 + 0.08 * Math.sin(t * 12.0);
        matBeam.uniforms.uFlicker.value = 0.85 + 0.15 * Math.sin(t * 30.0);
        matWindowWarm.uniforms.uFlicker.value = 0.94 + 0.06 * Math.sin(t * 7.7);
        buoy.position.y = 0.4 + 0.25 * Math.sin(t * 1.1);
        buoy.rotation.z = 0.15 * Math.sin(t * 0.9);
        matBlinkG.uniforms.uFlicker.value = (t % 2.2) < 0.25 ? 1 : 0.08;
        // lightning: double-strike envelope drives the GLOBAL flash uniform
        var f = 0;
        if (t > strike.next) {
          var since = t - strike.next;
          if (since < 0.09) f = 1.0;
          else if (since < 0.16) f = 0.1;
          else if (since < 0.25) f = 0.8;
          else if (since > 0.5) { strike.next = t + 4 + Math.random() * 7; }
        }
        PS1.shared.uFlash.value = f * (0.75 + 0.25 * Math.sin(t * 97.0));
        // towering waves: surge toward the cliff, splash on impact, recycle out at sea
        waves.forEach(function (w) {
          var u = w.userData;
          u.z += u.sp * 0.032;
          w.position.set(u.x, 0.4 + 0.5 * Math.sin(t * 1.3 + u.wi), u.z);
          w.rotation.x = 0.1 * Math.sin(t * 0.9 + u.wi * 1.7);
          if (u.z > IMPACT_Z && u.hit < 0) {
            u.hit = t;
            u.splash.position.set(u.x, 1.4, IMPACT_Z - 0.8);
            u.splash.visible = true;
          }
          if (u.hit > 0) {
            var st2 = (t - u.hit) / 0.7;
            if (st2 < 1) {
              u.splash.scale.set(1 + st2 * 2.2, 1 + Math.sin(st2 * Math.PI) * 2.6, 1 + st2 * 1.4);
            } else {
              u.splash.visible = false;
              u.hit = -9;
              u.z = -34 - Math.random() * 46;
              u.x = -48 + Math.random() * 96;
            }
          }
        });
        flag.rotation.x = 0.5 + 0.28 * Math.sin(t * 5.1);   // whipped flat by the gale
        flag.rotation.z = 0.15 * Math.sin(t * 6.3);
      }
    };
  });
})();
