(function () {
  'use strict';
  // ======================= 极光冰渊 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function snowCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 8, 6, 3);
      var sp = hash2(x + 7, y + 19);
      var r = 148 + n * 46, g = 156 + n * 48, b = 172 + n * 48;
      if (sp < 0.05) { r -= 60; g -= 58; b -= 46; }                 // wind-scoured patches
      return [r, g, b];
    });
  }
  function iceCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 6, 3);
      var strata = Math.sin(y * 0.5 + vnoise(x / 11, y / 11, 4, 2) * 3);
      var r = 108 + n * 44 + strata * 24, g = 158 + n * 48 + strata * 26, b = 186 + n * 46 + strata * 22;
      var crev = vnoise(x / 18 + 5, y / 26, 4, 2);
      if (crev > 0.74) { var k = (crev - 0.74) * 2.6; r *= 1 - k * 0.8; g *= 1 - k * 0.8; b *= 1 - k * 0.7; }   // crevasse veins
      var dirt = hash2(x * 3 | 0, y + 41);
      if (dirt < 0.02) { r *= 0.6; g *= 0.65; b *= 0.7; }           // moraine grit
      return [r, g, b];
    });
  }
  function woodCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var plank = Math.sin(x * 0.98) * 0.5 + 0.5;
      var n = vnoise(x / 5, y / 16, 5, 2);
      var r = 68 + plank * 26 + n * 18, g = 52 + plank * 20 + n * 14, b = 40 + plank * 14 + n * 10;
      return [r, g, b];
    });
  }
  function waterCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 9, 5, 3);
      var w = Math.sin((x + Math.sin(y * 0.3) * 5) * 0.33);
      var k = 0.7 + 0.2 * w;
      var r = 14 * k + n * 8, g = 44 * k + n * 14, b = 58 * k + n * 16;
      if (w > 0.9) { r += 50; g += 95; b += 105; }                  // aurora shimmer bands
      return [r, g, b];
    });
  }

  var snowTex = texFrom(snowCanvas());
  var iceTex = texFrom(iceCanvas());
  var woodTex = texFrom(woodCanvas());
  var waterTex = texFrom(waterCanvas());

  var matSnow = ps1Material(snowTex);
  var matIce = ps1Material(iceTex);
  var matWood = ps1Material(woodTex);
  var matWater = ps1Material(waterTex);
  var matIceGlow = PS1.privateFlicker(ps1Material(PS1.solidTexture(150, 235, 235)));   // pulsing ice veins
  var matLamp = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 205, 120)));      // expedition lantern

  var MOON = new THREE.Vector3(0.18, 0.55, 0.60).normalize();
  var GLOW = [0.0, 7.0, -24.0];        // heart of the glacier
  var LAMP = [7.2, 1.1, 9.4];          // camp lantern
  var glacierRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * MOON.x + ny * MOON.y + nz * MOON.z);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.10 + 0.16 * ndl + 0.04 * hemi;
    var g = 0.14 + 0.22 * ndl + 0.05 * hemi;
    var b = 0.20 + 0.28 * ndl + 0.06 * hemi;
    var dx = GLOW[0] - x, dy = GLOW[1] - y, dz = GLOW[2] - z;
    var d2 = dx * dx + dy * dy + dz * dz;
    var fall = 2.0 / (1 + d2 * 0.012);
    var inv = 1 / (Math.sqrt(d2) + 1e-4);
    var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
    var w = fall * (0.4 + 0.6 * nd);
    r += w * 0.4; g += w * 0.85; b += w * 0.95;
    dx = LAMP[0] - x; dy = LAMP[1] - y; dz = LAMP[2] - z;
    d2 = dx * dx + dy * dy + dz * dz;
    var w2 = 1.3 / (1 + d2 * 0.05) * (0.4 + 0.6 * Math.max(0, (dx * nx + dy * ny + dz * nz) / (Math.sqrt(d2) + 1e-4)));
    r += w2 * 1.1; g += w2 * 0.8; b += w2 * 0.45;
    return [Math.min(1.1, r), Math.min(1.1, g), Math.min(1.1, b)];
  };

  PS1.registerScene(function () {
    setRelight(glacierRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var dim = new THREE.DirectionalLight(0xaaccdd, 1);
    dim.position.copy(MOON).multiplyScalar(36);
    dim.castShadow = true;
    dim.shadow.mapSize.set(1024, 1024);
    dim.shadow.camera.near = 2; dim.shadow.camera.far = 70;
    dim.shadow.camera.left = -22; dim.shadow.camera.right = 22;
    dim.shadow.camera.top = 22; dim.shadow.camera.bottom = -22;
    dim.shadow.bias = -0.004; dim.shadow.normalBias = 0.05;
    scene.add(dim); scene.add(dim.target);

    scene.add(PS1.makeSky({
      top: [0.02, 0.05, 0.10], horizon: [0.10, 0.16, 0.22], bottom: [0.05, 0.08, 0.11],
      sunDir: [0.18, 0.55, 0.60], sunCol: [0.55, 0.62, 0.7], sunCut: 0.9988, sunGlow: 0.35,
      stars: 1.0, meteors: 0.3, aurora: 1.0, radius: 100
    }));

    // ---------------- fjord layout ---------------------------------------
    scene.add(PS1.groundGrid(matSnow, 0, 12, 44, 26, 7, 2, 0, 1));          // frozen lake shore
    scene.add(PS1.groundGrid(matWater, 0, -8, 44, 24, 7, 2, -0.12, 1));     // tidal water strip
    // the glacier face: stacked banded tiers with a blue heart glowing inside
    scene.add(cs(boxMesh(matIce, 0, 5.0, -22, 46, 10, 9, 2.6)));
    scene.add(cs(boxMesh(matIce, -4, 12.5, -24, 34, 6, 8, 2.4)));
    scene.add(cs(boxMesh(matIce, -8, 18.5, -26, 22, 6, 7, 2.2)));
    scene.add(cs(boxMesh(matIce, -11, 24.0, -28, 12, 5, 6, 2.0)));
    // side cliff walls funnelling the view
    scene.add(cs(boxMesh(matIce, -24, 8.0, -12, 8, 16, 26, 2.4)));
    scene.add(cs(boxMesh(matIce, 24, 9.5, -14, 8, 19, 22, 2.4)));
    // glowing fissure in the glacier face
    scene.add(boxMesh(matIceGlow, 0, 5.5, -17.05, 2.6, 8.5, 0.1, 1, 0, [0.5, 1.1, 1.15]));
    // ice spike clusters on the shore
    for (var sp = 0; sp < 14; sp++) {
      var px = -20 + hash2(sp, 31) * 40, pz = 2 + hash2(sp, 67) * 12;
      var ph2 = 1.2 + hash2(sp, 13) * 3.4;
      var spike = prismMesh(matIce, 0, 0, 0.28 + hash2(sp, 5) * 0.3, ph2, 6, 1, 2, null, 0);
      spike.position.set(px, ph2 * 0.3, pz);
      spike.rotation.z = (hash2(sp, 9) - 0.5) * 0.7;
      scene.add(cs(spike));
    }
    // ice floes + seals on the water strip
    var seals = [];
    for (var fl = 0; fl < 9; fl++) {
      var fx = -18 + hash2(fl, 21) * 36, fz = -16 + hash2(fl, 45) * 13;
      scene.add(blobMesh(matSnow, fx, 0.12, fz, 0.9 + hash2(fl, 3) * 0.9, 0.28, 0.4, function () { return [0.95, 0.97, 1.05]; }));
      if (fl % 3 === 0) {
        var seal = blobMesh(matWood, 0, 0, 0, 0.42, 0.7, 0.3, function () { return [0.85, 0.8, 0.75]; });
        seal.position.set(fx + 0.3, 0.42, fz);
        seals.push(seal);
        scene.add(seal);
      }
    }

    // ---------------- the frozen longship --------------------------------
    (function () {
      var bx = 5.0, bz = 5.6;
      // curved hull sides
      scene.add(cs(quadCorners(matWood, [bx - 4.4, 0.15, bz - 1.1], [bx + 4.4, 0.15, bz - 1.3],
        [bx + 4.0, 1.05, bz + 0.5], [bx - 4.0, 1.05, bz + 0.4], 3, 0.9)));
      scene.add(cs(quadCorners(matWood, [bx - 4.0, 1.05, bz + 0.4], [bx + 4.0, 1.05, bz + 0.5],
        [bx + 4.4, 0.15, bz + 1.7], [bx - 4.4, 0.15, bz + 1.5], 3, 0.9)));
      scene.add(boxMesh(matWood, bx, 0.55, bz + 0.2, 7.6, 0.14, 1.5, 2));                    // deck
      for (var rb = 0; rb < 6; rb++) {                                                        // ribs
        scene.add(boxMesh(matWood, bx - 3.2 + rb * 1.28, 0.9, bz + 0.2, 0.12, 0.5, 1.7, 2));
      }
      scene.add(cs(prismMesh(matWood, bx, bz + 0.2, 0.09, 4.6, 6, 0.7, 3, null, 0.6)));      // mast
      scene.add(boxMesh(matWood, bx, 4.6, bz + 0.2, 2.8, 0.1, 0.1, 2, 0.5));                 // yard
      // sail frozen stiff, tattered on one edge
      scene.add(quadCorners(ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var n = vnoise(x / 7, y / 7, 5, 2);
        var r = 168 + n * 40, g = 158 + n * 38, b = 142 + n * 34;
        if (x > 46 + Math.sin(y * 0.4) * 9) { r *= 0.25; g *= 0.25; b *= 0.25; }
        if (n < 0.22) { r *= 0.7; g *= 0.72; b *= 0.75; }                                     // frost patches
        return [r, g, b];
      }))), [bx - 1.3, 4.55, bz + 0.24], [bx + 1.3, 4.55, bz + 0.24], [bx + 1.2, 2.5, bz + 0.28], [bx - 1.2, 2.5, bz + 0.26], 1, 1));
      // ice caking the gunwale
      for (var ic = 0; ic < 7; ic++) {
        scene.add(blobMesh(matSnow, bx - 3.3 + ic * 1.1, 1.1, bz + (ic % 2 ? 1.3 : -0.85),
          0.24 + hash2(ic, 77) * 0.2, 0.5, 0.3, function () { return [1.0, 1.05, 1.12]; }));
      }
      colliders.push({ x0: bx - 4.4, z0: bz - 1.4, x1: bx + 4.4, z1: bz + 1.8 });
    })();

    // ---------------- expedition camp ------------------------------------
    (function () {
      var tx = 7.2, tz = 9.4;
      // tent: two slanted canvas sides
      var matTent = ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var n = vnoise(x / 8, y / 8, 5, 2);
        var r = 96 + n * 26, g = 86 + n * 24, b = 74 + n * 20;
        if (n > 0.78) { r *= 0.82; g *= 0.82; b *= 0.82; }
        return [r, g, b];
      })));
      scene.add(cs(quadCorners(matTent, [tx - 1.5, 0, tz - 1.0], [tx, 0, tz + 0.4], [tx, 1.7, tz + 0.4], [tx - 1.5, 1.7, tz - 1.0], 1.2, 1)));
      scene.add(cs(quadCorners(matTent, [tx, 0, tz + 0.4], [tx + 1.5, 0, tz - 1.0], [tx + 1.5, 1.7, tz - 1.0], [tx, 1.7, tz + 0.4], 1.2, 1)));
      scene.add(quadCorners(matTent, [tx - 1.5, 1.7, tz - 1.0], [tx + 1.5, 1.7, tz - 1.0], [tx + 1.5, 0.1, tz - 1.25], [tx - 1.5, 0.1, tz - 1.25], 1.2, 0.6));
      colliders.push({ x0: tx - 1.6, z0: tz - 1.3, x1: tx + 1.6, z1: tz + 0.6 });
      // sled + crates + fuel drums
      scene.add(boxMesh(matWood, tx - 3.0, 0.28, tz + 1.6, 1.8, 0.16, 0.8, 2));
      scene.add(boxMesh(matWood, tx - 3.1, 0.62, tz + 1.6, 0.62, 0.62, 0.62, 1.6, 0.4));
      scene.add(boxMesh(matWood, tx - 2.4, 0.55, tz + 1.7, 0.5, 0.5, 0.5, 1.5, -0.3));
      // lantern post
      scene.add(cs(prismMesh(matWood, LAMP[0] - 1.4, LAMP[2] + 0.9, 0.06, 2.1, 6, 0.5, 1.4, null, 0)));
      scene.add(boxMesh(matLamp, LAMP[0] - 1.4, LAMP[1] + 0.75, LAMP[2] + 0.9, 0.26, 0.34, 0.26, 1, 0, [1.6, 1.2, 0.6]));
      colliders.push({ x0: LAMP[0] - 1.6, z0: LAMP[2] + 0.7, x1: LAMP[0] - 1.2, z1: LAMP[2] + 1.1 });
      // wind-torn flag on a pole
      scene.add(cs(prismMesh(matWood, -9.0, 3.4, 0.06, 3.2, 6, 0.5, 2, null, 0)));
    })();
    var flag = new THREE.Group();
    flag.add(quadCorners(ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 10, 5, 2);
      var r = 150 + n * 30, g = 42 + n * 20, b = 48 + n * 22;
      if (y > 40 + Math.sin(x * 0.5) * 8) { r *= 0.12; g *= 0.12; b *= 0.12; }   // tattered tail
      return [r, g, b];
    }))), [-0.015, 0, 0], [0.5, 0, 0], [0.5, -0.45, 0], [-0.015, -0.45, 0], 0.7, 0.9));
    flag.position.set(-9.0, 2.9, 3.4);
    scene.add(flag);

    // ---------------- weather ---------------------------------------------
    var snow = PS1.makeParticles({
      mode: 'petal', count: 420, color: [0.85, 0.9, 0.96],
      size: 0.03, speed: 1.1, sway: 0.5,
      area: [-22, 22, -18, 16, 12], y0: 0
    });
    var shimmer = PS1.makeParticles({
      mode: 'dust', count: 130, color: [0.5, 0.9, 0.75],
      size: 0.02, speed: 0.7, sway: 0.9,
      area: [-16, 16, -12, 10, 3.4], y0: 0.4
    });
    var breath = PS1.makeParticles({
      mode: 'steam', count: 40, color: [0.8, 0.86, 0.9],
      size: 0.05, speed: 1.0, sway: 0.4,
      area: [5.6, 8.8, 8.0, 10.4, 1.6], y0: 1.2
    });
    scene.add(snow); scene.add(shimmer); scene.add(breath);

    return {
      name: '极光冰渊',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -19.5, x1: 19.5, z0: 0.5, z1: 23.5 },
      spawn: [-6.0, 12.0, Math.atan2(-(0 - -6.0), -(-22 - 12.0)), 0.10],
      idle: { pos: [-4.5, 2.6, 16.5], target: [-2.0, 11.5, -24.0] },   // shore -> glacier wall under the aurora curtain
      fog: { color: [0.09, 0.14, 0.20], near: 16, far: 78 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [snow, shimmer, breath],
      update: function (t) {
        waterTex.offset.x = t * 0.008;
        waterTex.offset.y = t * 0.014;
        matIceGlow.uniforms.uFlicker.value = 0.72 + 0.28 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1.2);
        matLamp.uniforms.uFlicker.value = 0.92 + 0.08 * Math.sin(t * 11.0);
        flag.rotation.x = 0.35 + 0.2 * Math.sin(t * 4.2);
        flag.rotation.z = 0.1 * Math.sin(t * 5.1);
        seals.forEach(function (sl, i) {
          sl.position.y = 0.42 + 0.03 * Math.sin(t * 1.7 + i * 2.4);
        });
      }
    };
  });
})();
