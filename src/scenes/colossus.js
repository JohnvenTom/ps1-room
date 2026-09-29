(function () {
  'use strict';
  // ======================= 巨像遗迹 ================================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function graniteCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 8, 3);
      var r = 128 + n * 30, g = 126 + n * 28, b = 116 + n * 26;
      var crack = vnoise(x / 16 + 4, y / 16, 5, 2);
      if (crack > 0.74) { var k = (crack - 0.74) * 1.8; r *= 1 - k * 0.6; g *= 1 - k * 0.6; b *= 1 - k * 0.55; }
      var moss = vnoise(x / 12, y / 12, 4, 2);
      if (moss > 0.70) { var m = (moss - 0.70) * 1.8; r *= 1 - m * 0.5; g *= 1 - m * 0.1; b *= 1 - m * 0.4; }
      var chip = Math.floor(x / 22) + Math.floor(y / 22) * 3;
      if (hash2(chip, 7) < 0.25 && (x % 22 < 1 || y % 22 < 1)) { r *= 0.7; g *= 0.7; b *= 0.7; }
      return [r, g, b];
    });
  }
  function plainCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 8, 3);
      var r = 148 + n * 40, g = 138 + n * 36, b = 104 + n * 30;
      var tuft = hash2(Math.floor(x / 3), Math.floor(y / 3));
      if (tuft < 0.16) { var k = 0.75 + tuft; r *= k; g *= k * 1.02; b *= k * 0.9; }
      var path2 = vnoise(x / 20 + 2, y / 20, 4, 2);
      if (path2 > 0.72) { var p = (path2 - 0.72) * 1.5; r = r * (1 - p) + 176 * p; g = g * (1 - p) + 164 * p; b = b * (1 - p) + 132 * p; }
      return [r, g, b];
    });
  }

  var graniteTex = texFrom(graniteCanvas());
  var plainTex = texFrom(plainCanvas());
  var matGranite = ps1Material(graniteTex);
  var matPlain = ps1Material(plainTex);
  var matBrazier = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 140, 50)));

  var SUN = new THREE.Vector3(0.72, 0.30, -0.42).normalize();   // low side sun: the colossus shadow spans the plain
  var SKY_AMB = [0.44, 0.42, 0.38];
  var GND_AMB = [0.36, 0.32, 0.24];
  var colRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 1.16 * ndl + GND_AMB[0] + (SKY_AMB[0] - GND_AMB[0]) * hemi;
    var g = 1.08 * ndl + GND_AMB[1] + (SKY_AMB[1] - GND_AMB[1]) * hemi;
    var b = 0.94 * ndl + GND_AMB[2] + (SKY_AMB[2] - GND_AMB[2]) * hemi;
    return [Math.min(1.2, r), Math.min(1.15, g), Math.min(1.05, b)];
  };

  PS1.registerScene(function () {
    setRelight(colRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var sun = new THREE.DirectionalLight(0xffe8c0, 1);
    sun.position.copy(SUN).multiplyScalar(38);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 4; sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
    sun.shadow.bias = -0.004; sun.shadow.normalBias = 0.06;
    scene.add(sun); scene.add(sun.target);

    scene.add(PS1.makeSky({
      top: [0.42, 0.44, 0.48], horizon: [0.88, 0.80, 0.62], bottom: [0.5, 0.47, 0.4],
      sunDir: SUN.toArray(), sunCol: [1.3, 1.1, 0.8], sunCut: 0.9982, sunGlow: 0.4,
      stars: 0, meteors: 0, radius: 100
    }));

    scene.add(PS1.groundGrid(matPlain, 0, 0, 72, 60, 12, 1, 0, 1));

    // ---------------- THE COLOSSUS --------------------------------------
    (function () {
      var CX = 0, CZ = -18;
      // plinth + shins
      scene.add(cs(boxMesh(matGranite, CX, 1.2, CZ, 17, 2.4, 9, 1.0)));
      scene.add(cs(boxMesh(matGranite, CX, 2.9, CZ + 1.2, 14.5, 1.0, 8.4, 1.0)));
      [-3.2, 3.2].forEach(function (lx) {
        scene.add(cs(boxMesh(matGranite, CX + lx, 7.2, CZ, 3.0, 8.0, 3.4, 0.9)));          // legs
      });
      // robed torso: tapering stack
      scene.add(cs(boxMesh(matGranite, CX, 12.2, CZ, 12.5, 3.4, 5.4, 0.9)));
      scene.add(cs(boxMesh(matGranite, CX, 15.4, CZ, 10.5, 3.0, 4.8, 0.9)));
      // shoulders + chest plate
      scene.add(cs(boxMesh(matGranite, CX, 17.6, CZ, 11.0, 1.8, 4.6, 0.9)));
      // head + crown
      scene.add(cs(boxMesh(matGranite, CX, 19.8, CZ, 3.4, 3.4, 3.4, 0.9)));
      scene.add(cs(boxMesh(matGranite, CX, 21.9, CZ, 4.2, 0.9, 4.2, 0.9)));
      [[-1.4], [1.4]].forEach(function (cx2) {
        scene.add(cs(boxMesh(matGranite, CX + cx2[0], 22.8, CZ, 0.8, 1.0, 0.8, 0.9)));
      });
      // dark visor slit
      scene.add(boxMesh(ps1Material(PS1.solidTexture(18, 17, 16)), CX, 20.3, CZ + 1.76, 2.4, 0.5, 0.06, 2));
      // raised right arm (east) holding the DOWNWARD SWORD
      scene.add(cs(boxMesh(matGranite, CX + 6.0, 18.4, CZ, 1.9, 4.6, 1.9, 0.9, 0.5)));      // upper arm, tilted out
      scene.add(cs(boxMesh(matGranite, CX + 8.3, 20.6, CZ, 1.6, 3.2, 1.6, 0.9, -0.9)));     // forearm rising
      scene.add(cs(boxMesh(matGranite, CX + 9.4, 22.0, CZ, 1.9, 1.6, 1.9, 0.9)));           // fist
      // the sword: guard at the fist, blade slanting down to the ground before the plinth
      var SXT = CX + 8.2, SZT = CZ + 6.5;                                                    // tip position
      var bladeLen = 20.5;
      var midX = (CX + 9.4 + SXT) / 2, midY = 21.6 / 2 + 1.0, midZ = (CZ + SZT) / 2;
      var blade = boxMesh(matGranite, midX, midY, midZ, 1.5, bladeLen, 0.55, 1.1);
      var ang = Math.atan2(SXT - (CX + 9.4), 21.6 - 0.4);
      blade.rotation.z = ang;
      scene.add(cs(blade));
      scene.add(cs(boxMesh(matGranite, CX + 9.15, 21.5, CZ, 3.0, 0.6, 0.9, 1.2, ang)));     // crossguard
      scene.add(cs(prismMesh(matGranite, SXT, SZT, 0.0 + 0.001, 0.001, 4, 1, 0.001, null, 0))); // (tip marker, invisible scale)
      // broken left arm: stump only
      scene.add(cs(boxMesh(matGranite, CX - 6.0, 18.2, CZ, 1.9, 3.0, 1.9, 0.9, -0.4)));
      // tattered banner hanging from the crossguard
      var bannerPivot = new THREE.Group();
      bannerPivot.position.set(CX + 7.0, 19.6, CZ);
      var bn = quadCorners(ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var n = vnoise(x / 9, y / 12, 5, 2);
        var r = 96 + n * 30, g = 42 + n * 16, b = 38 + n * 14;
        if (y > 44 + Math.sin(x * 0.4) * 6) { r *= 0; g *= 0; b *= 0; }   // tattered tail (reads as torn)
        return [r, g, b];
      }))), [0, 0, -0.45], [0, 0, 0.45], [0, -3.4, 0.45], [0, -3.4, -0.45], 0.8, 4);
      bannerPivot.add(bn);
      scene.add(bannerPivot);
      colliders.push({ x0: CX - 9, z0: CZ - 3.5, x1: CX + 9, z1: CZ + 4.5 });
      colliders.push({ x0: SXT - 1.2, z0: SZT - 1.2, x1: SXT + 1.2, z1: SZT + 1.2 });       // sword tip
    })();

    // ---------------- fallen sword shards on the plain -------------------
    [[13.5, 6.0, 0.5, 7.5], [-11.0, 2.5, -0.35, 6.0], [4.0, 13.0, 0.2, 4.2]].forEach(function (sh3, i) {
      var shard = boxMesh(matGranite, sh3[0], 0.35, sh3[1], 1.1, sh3[3], 0.4, 1.2, sh3[2]);
      scene.add(cs(shard));
      colliders.push({ x0: sh3[0] - 1.2, z0: sh3[1] - 1.2, x1: sh3[0] + 1.2, z1: sh3[1] + 1.2 });
      void i;
    });
    // giant fallen fist
    scene.add(cs(boxMesh(matGranite, 16.0, 0.9, -2.0, 2.6, 2.2, 2.4, 1.0, 0.3)));
    colliders.push({ x0: 14.6, z0: -3.4, x1: 17.4, z1: -0.6 });

    // ---------------- ruin colonnade ------------------------------------
    for (var col = 0; col < 5; col++) {
      var cx3 = -14 + col * 3.4;
      var h2 = 2.2 + hash2(col, 5) * 2.6;
      scene.add(cs(prismMesh(matGranite, cx3, -28, 0.85, h2, 7, 1.6, 3)));
      if (hash2(col, 9) > 0.55) {
        scene.add(prismMesh(matGranite, cx3, -28, 1.05, 0.4, 7, 1.6, 0.6, null, h2));
      }
      colliders.push({ x0: cx3 - 1.0, z0: -29, x1: cx3 + 1.0, z1: -27 });
    }
    // broken arch
    (function () {
      scene.add(cs(prismMesh(matGranite, 20, -24, 0.9, 4.2, 7, 1.8, 5)));
      scene.add(cs(quadCorners(matGranite, [18.6, 4.3, -24.6], [21.6, 4.3, -24.6], [21.2, 5.4, -23.4], [18.9, 5.4, -23.4], 3, 1.2)));
      colliders.push({ x0: 19, z0: -25, x1: 21.2, z1: -23 });
    })();

    // ---------------- braziers flanking the approach --------------------
    [[-3.4, 2.0], [3.4, 2.6]].forEach(function (b4) {
      scene.add(cs(prismMesh(matGranite, b4[0], b4[1], 0.4, 1.1, 6, 1.6, 1.4)));
      scene.add(boxMesh(matBrazier, b4[0], b4[1], 0.5, 1.15, 0.3, 1.15, 2, 0, [1.7, 0.8, 0.25]));
      colliders.push({ x0: b4[0] - 0.6, z0: b4[1] - 0.6, x1: b4[0] + 0.6, z1: b4[1] + 0.6 });
    });
    var firePits = [[-3.4, 2.0], [3.4, 2.6]].map(function (b5) {
      var flame = PS1.makeParticles({
        mode: 'steam', count: 40, color: [1.0, 0.55, 0.16],
        size: 0.05, speed: 1.6, sway: 0.1,
        area: [b5[0] - 0.25, b5[0] + 0.25, b5[1] - 0.25, b5[1] + 0.25, 1.8]
      });
      scene.add(flame);
      return flame;
    });

    // ---------------- crows around the head ------------------------------
    var crows = [];
    for (var cr = 0; cr < 5; cr++) {
      var crow = new THREE.Group();
      var matCrow = ps1Material(PS1.solidTexture(22, 20, 24));
      crow.add(boxMesh(matCrow, 0, 0, 0, 0.35, 0.1, 0.1, 2));
      crow.userData = { r: 4.5 + hash2(cr, 3) * 3.5, h: 18 + hash2(cr, 7) * 6, ph: cr * 1.3, sp: 0.5 + hash2(cr, 5) * 0.3 };
      scene.add(crow);
      crows.push(crow);
    }
    var dust = PS1.makeParticles({
      mode: 'dust', count: 150, color: [0.94, 0.88, 0.72],
      size: 0.022, speed: 1, sway: 0.6,
      area: [-24, 24, -20, 16, 3.0]
    });
    scene.add(dust);

    return {
      name: '巨像遗迹',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -22, x1: 22, z0: -24, z1: 18 },
      spawn: [13.0, 10.0, Math.atan2(-(0 - 13.0), -(-14 - 10.0)), 0.06],
      idle: { pos: [13.5, 1.62, 10.5], target: [-1.0, 10.5, -15.0] },
      fog: { color: [0.62, 0.59, 0.50], near: 20, far: 72 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: firePits.concat([dust]),
      update: function (t) {
        matBrazier.uniforms.uFlicker.value = 0.85 + 0.15 * Math.sin(t * 18.0) * Math.sin(t * 6.1);
        crows.forEach(function (c6) {
          var u = c6.userData;
          var a = u.ph + t * u.sp;
          c6.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.9 + u.ph) * 1.2, -18 + Math.sin(a) * u.r);
          c6.rotation.y = -a + Math.PI / 2;
          c6.scale.x = 1 + 0.6 * Math.abs(Math.sin(t * 9 + u.ph));
        });
      }
    };
  });
})();
