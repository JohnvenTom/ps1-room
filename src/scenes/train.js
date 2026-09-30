(function () {
  'use strict';
  // ======================= 午夜列车 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function wallCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 8, 5, 2);
      var seam = (x % 32 < 1.2);
      var r = 96 + n * 26, g = 88 + n * 24, b = 78 + n * 20;
      if (y < 6) { r *= 1.12; g *= 1.1; b *= 1.0; }                 // trim strip
      if (y > 56) { r *= 0.7; g *= 0.7; b *= 0.72; }                // scuffed skirt
      if (seam) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }
  function seatCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 5, 3);
      var weave = Math.sin(x * 1.7) * Math.sin(y * 1.7) * 0.5 + 0.5;
      var r = 64 + n * 22 + weave * 12, g = 40 + n * 16 + weave * 8, b = 46 + n * 16 + weave * 9;
      if (y > 50 && hash2(x, y) < 0.05) { r += 50; g += 40; b += 30; }   // worn patches
      return [r, g, b];
    });
  }
  function floorCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 4, 2);
      var plank = (Math.floor(x / 21) % 2 === 0) ? 3 : -3;
      var r = 52 + n * 14 + plank, g = 40 + n * 12 + plank, b = 36 + n * 10 + plank;
      return [r, g, b];
    });
  }
  // the world outside: night city strip - windows, poles, station lights
  function outsideCanvas() {
    return pixelLoop(newCanvas(128), function (x, y) {
      var n = vnoise(x / 10, y / 12, 5, 2);
      var r = 10 + n * 8, g = 12 + n * 9, b = 16 + n * 11;
      var building = Math.floor(x / 14);
      var lit = hash2(building, Math.floor(y / 8));
      if (y > 14 && y < 46 && x % 14 > 2 && x % 14 < 11 && lit > 0.62) {
        var warm = hash2(building * 3, Math.floor(y / 8) * 7);
        r += 90 + warm * 120; g += 70 + warm * 95; b += 40 + warm * 50;   // apartment windows
      }
      if (Math.abs(y - 54) < 1 && x % 40 < 2) { r += 160; g += 150; b += 110; }   // pole lights
      if (y > 60) { r = 18 + n * 6; g = 16 + n * 5; b = 18 + n * 6; }     // ground rush
      return [r, g, b];
    });
  }

  var wallTex = texFrom(wallCanvas());
  var seatTex = texFrom(seatCanvas());
  var floorTex = texFrom(floorCanvas());
  var outTex = texFrom(outsideCanvas());

  var matWall = ps1Material(wallTex);
  var matSeat = ps1Material(seatTex);
  var matFloor = ps1Material(floorTex);
  var matOut = ps1Material(outTex);
  var matLampShade = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 226, 160)));
  var matDoorLight = PS1.privateFlicker(ps1Material(PS1.solidTexture(200, 230, 255)));

  var LAMPS = [[-1.15, 2.5, -5.6], [1.15, 2.5, -5.6], [-1.15, 2.5, 0], [1.15, 2.5, 0], [-1.15, 2.5, 5.6], [1.15, 2.5, 5.6]];

  var trainRelight = function (x, y, z, nx, ny, nz) {
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.10 + 0.04 * hemi, g = 0.10 + 0.04 * hemi, b = 0.12 + 0.05 * hemi;
    for (var i = 0; i < LAMPS.length; i++) {
      var lp = LAMPS[i];
      var dx = lp[0] - x, dy = lp[1] - y, dz = lp[2] - z;
      var d2 = dx * dx + dy * dy + dz * dz;
      var fall = 1.35 / (1 + d2 * 0.10);
      var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) / (Math.sqrt(d2) + 1e-4));
      var w = fall * (0.4 + 0.6 * nd);
      r += w * 1.15; g += w * 0.95; b += w * 0.6;
    }
    return [Math.min(1.15, r), Math.min(1.1, g), Math.min(1.05, b)];
  };

  PS1.registerScene(function () {
    setRelight(trainRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var lamp = new THREE.PointLight(0xffe0b0, 0.9);
    lamp.position.set(0, 2.5, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(256, 256);
    lamp.shadow.camera.near = 0.15; lamp.shadow.camera.far = 9;
    scene.add(lamp); scene.add(lamp.target);

    scene.add(PS1.makeSky({
      top: [0.01, 0.02, 0.04], horizon: [0.04, 0.05, 0.08], bottom: [0.01, 0.01, 0.02],
      sunDir: [0, 1, 0], sunCol: [0, 0, 0], stars: 0, meteors: 0, radius: 60
    }));

    // ---------------- carriage shell: 2.6 wide x 3.1 high x 18 long ------
    var W2 = 1.35, H = 3.1, ZA = 9, ZB = -9;
    scene.add(PS1.groundGrid(matFloor, 0, 0, 2.8, 18.4, 8, 2, 0, 1));
    scene.add(cs(quadCorners(matWall, [-W2, 0, ZA], [W2, 0, ZA], [W2, H, ZA], [-W2, H, ZA], 3, 1.5)));
    scene.add(cs(quadCorners(matWall, [-W2, 0, ZB], [W2, 0, ZB], [W2, H, ZB], [-W2, H, ZB], 3, 1.5)));
    scene.add(cs(quadCorners(matWall, [-W2, H, ZA], [W2, H, ZA], [W2, H, ZB], [-W2, H, ZB], 3, 6)));   // ceiling
    // window band: glass + frames on both sides, then the scrolling world outside
    var winY0 = 1.1, winY1 = 2.4;
    [-1, 1].forEach(function (side) {
      var wx = side * W2;
      for (var wz = ZA - 1.2; wz > ZB + 1.2; wz -= 2.2) {
        // glass (dark, faintly reflective) with frame
        scene.add(quadCorners(matWall, [wx, winY0, wz - 0.8], [wx, winY0, wz + 0.8], [wx, winY1, wz + 0.8], [wx, winY1, wz - 0.8], 1, 1));
        scene.add(boxMesh(matWall, wx, (winY0 + winY1) / 2, wz - 0.84, 0.06, 1.44, 0.08, 1.2));
        scene.add(boxMesh(matWall, wx, (winY0 + winY1) / 2, wz + 0.84, 0.06, 1.44, 0.08, 1.2));
      }
      scene.add(boxMesh(matWall, wx, winY0 - 0.06, (ZA + ZB) / 2, 0.08, 0.1, 17.6, 6));
      scene.add(boxMesh(matWall, wx, winY1 + 0.06, (ZA + ZB) / 2, 0.08, 0.1, 17.6, 6));
      // lower wall panels between windows and floor
      scene.add(cs(quadCorners(matWall, [wx, 0.06, ZA - 0.9], [wx, 0.06, ZB + 0.9], [wx, winY0, ZB + 0.9], [wx, winY0, ZA - 0.9], 7, 1)));
      // upper wall band above windows
      scene.add(cs(quadCorners(matWall, [wx, winY1 + 0.1, ZA - 0.9], [wx, winY1 + 0.1, ZB + 0.9], [wx, H - 0.1, ZB + 0.9], [wx, H - 0.1, ZA - 0.9], 7, 1)));
    });
    // the scrolling outside world (both sides, far enough for parallax)
    var outsideL = quadCorners(matOut, [-6.5, -0.4, 26], [-6.5, -0.4, -26], [-6.5, 6.2, -26], [-6.5, 6.2, 26], 6, 2);
    var outsideR = quadCorners(matOut, [6.5, -0.4, 26], [6.5, -0.4, -26], [6.5, 6.2, -26], [6.5, 6.2, 26], 6, 2);
    scene.add(outsideL); scene.add(outsideR);

    // ---------------- seats: facing pairs down both sides -----------------
    for (var sz = 7; sz >= -7; sz -= 2.3) {
      [-1, 1].forEach(function (side) {
        var sx = side * 0.92;
        scene.add(cs(boxMesh(matSeat, sx, 0.5, sz, 1.0, 0.18, 1.0, 1.6)));
        scene.add(cs(boxMesh(matSeat, sx, 0.86, sz - 0.42 * side, 1.0, 0.75, 0.14, 1.6)));   // backrest faces aisle
        scene.add(boxMesh(matSeat, sx, 0.25, sz, 0.85, 0.5, 0.85, 1.5));
        colliders.push({ x0: sx - 0.55, z0: sz - 0.55, x1: sx + 0.55, z1: sz + 0.55 });
        // headrest cushion
        scene.add(boxMesh(matSeat, sx, 1.16, sz - 0.46 * side, 0.9, 0.16, 0.12, 1.4));
      });
    }
    // one occupied table seat: fold-down table, coffee cup with steam, book
    (function () {
      scene.add(boxMesh(matWall, 0.92, 0.98, 3.4, 0.55, 0.06, 0.8, 1.4));
      scene.add(prismMesh(matWall, 0.92, 3.4, 0.09, 0.13, 7, 0.5, 0.4, null, 0.86));
      scene.add(blobMesh(matWall, 0.92, 1.10, 3.4, 0.09, 0.75, 0.2, function () { return [1.3, 1.25, 1.15]; }));
      scene.add(boxMesh(matSeat, 0.6, 1.06, 3.15, 0.34, 0.05, 0.24, 1.2, 0.3));
      colliders.push({ x0: 0.6, z0: 3.1, x1: 1.25, z1: 3.7 });
    })();
    var coffee = PS1.makeParticles({
      mode: 'steam', count: 26, color: [0.8, 0.8, 0.82],
      size: 0.028, speed: 0.5, sway: 0.3,
      area: [0.8, 1.05, 3.3, 3.5, 0.9], y0: 1.14
    });
    scene.add(coffee);

    // ---------------- luggage rack + bags ---------------------------------
    [-1, 1].forEach(function (side) {
      scene.add(boxMesh(matWall, side * 1.18, 2.62, 0, 0.5, 0.07, 15.8, 4));
      for (var rb = 0; rb < 6; rb++) scene.add(boxMesh(matWall, side * 1.18, 2.48, -6.5 + rb * 2.6, 0.06, 0.3, 0.06, 2));
    });
    var bags = [];
    [[-1.18, -5.2], [1.18, -1.4], [1.18, 4.6], [-1.18, 6.8]].forEach(function (bg, bi) {
      var bag = boxMesh(matSeat, 0, 0, 0, 0.55, 0.4, 0.34, 1.4, 0.1 + bi * 0.07);
      bag.position.set(bg[0], 2.86, bg[1]);
      scene.add(bag);
      bags.push(bag);
      if (bi % 2 === 0) {
        var strap = boxMesh(matSeat, 0, 0, 0, 0.06, 0.3, 0.3, 2);
        strap.position.set(bg[0], 3.02, bg[1]);
        scene.add(strap);
      }
    });

    // ---------------- pendant lamps (swaying with the rail rhythm) --------
    var pendants = [];
    LAMPS.forEach(function (lp) {
      var g = new THREE.Group();
      g.position.set(lp[0], lp[1], lp[2]);
      var cord = prismMesh(matWall, 0, 0, 0.025, 0.35, 4, 0.3, 0.4, null, 0);
      g.add(cord);
      var shade = prismMesh(matLampShade, 0, 0, 0.17, 0.14, 8, 0.9, 0.4, [1.9, 1.6, 0.95], -0.14);
      g.add(shade);
      scene.add(g);
      pendants.push(g);
    });

    // ---------------- end doors: corridor gap leaking cold light ----------
    (function () {
      scene.add(boxMesh(matWall, 0, 1.1, ZA - 0.05, 2.4, 2.2, 0.1, 2.2));
      scene.add(boxMesh(matDoorLight, 0, 0.5, ZA - 0.02, 2.3, 0.12, 0.06, 2, 0, [0.55, 0.75, 1.05]));
      scene.add(boxMesh(matWall, 0, 1.1, ZB + 0.05, 2.4, 2.2, 0.1, 2.2));
      scene.add(boxMesh(matDoorLight, 0, 0.5, ZB + 0.02, 2.3, 0.12, 0.06, 2, 0, [0.55, 0.75, 1.05]));
    })();

    // ticket stub + newspaper on a seat
    scene.add(boxMesh(matWall, -0.92, 0.61, -2.5, 0.3, 0.02, 0.2, 1.2, 0.4));
    scene.add(boxMesh(matWall, -0.92, 0.61, -4.8, 0.42, 0.02, 0.3, 1.4, -0.2));

    return {
      name: '午夜列车',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -0.42, x1: 0.42, z0: -8.3, z1: 8.3 },
      spawn: [0.0, 0.0, 0.0, 0.0],
      idle: { pos: [0.35, 1.75, 7.6], target: [0.0, 1.9, -7.0] },   // down the aisle: seats, pendant lamps, far door light
      fog: { color: [0.02, 0.02, 0.04], near: 7, far: 16 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [coffee],
      update: function (t) {
        // the world rushes past (offset drives the strip texture)
        outTex.offset.y = -(t * 0.55) % 1;
        matLampShade.uniforms.uFlicker.value = 0.93 + 0.07 * Math.sin(t * 6.0);
        matDoorLight.uniforms.uFlicker.value = 0.9 + 0.1 * Math.sin(t * 4.4);
        // rail rhythm: pendants swing and tick with the sleeper frequency
        var sway = Math.sin(t * 5.2), tick = Math.sin(t * 24.0) * 0.015;
        pendants.forEach(function (p, i) {
          p.rotation.z = sway * 0.08 + tick * (i % 2 ? 1 : -1);
          p.rotation.x = Math.sin(t * 5.2 + 0.7) * 0.04;
        });
        // bags shuffle on the rack
        bags.forEach(function (b, i) {
          b.rotation.z = 0.1 + i * 0.07 + Math.sin(t * 5.2 + i) * 0.012;
        });
        // passing lights: brief warm pulses when apartment blocks flash by the windows
        var cyc = t % 6.3;
        var pulse = cyc < 0.5 ? (1 - Math.abs(cyc - 0.25) * 4) : 0;
        PS1.shared.uFlash.value = Math.max(0, pulse) * 0.28;
        lamp.intensity = 0.86 + 0.06 * Math.sin(t * 6.0) + pulse * 0.1;
        floorTex.offset.y = (t * 0.02) % 1;
      }
    };
  });
})();
