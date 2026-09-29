(function () {
  'use strict';
  // ======================= 烈焰火山口 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function basaltCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 8, 3);
      var r = 26 + n * 22, g = 22 + n * 18, b = 24 + n * 18;
      var crack = vnoise(x / 14 + 3, y / 14, 5, 2);
      if (crack > 0.66 && crack < 0.70) { r = 190 + n * 60; g = 52; b = 16; }   // lava veins
      else if (crack > 0.63 && crack < 0.66) { r = 90; g = 30; b = 12; }
      var sp = hash2(x + 17, y + 3);
      if (sp < 0.05) { r *= 1.5; g *= 1.35; b *= 1.2; }                          // mica glints
      return [r, g, b];
    });
  }
  function obsidianCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 7, y / 9, 7, 3);
      var sheen = vnoise(x / 18 + 5, y / 24, 4, 2);
      var r = 20 + n * 26, g = 16 + n * 20, b = 26 + n * 30;
      if (sheen > 0.68) { var k = (sheen - 0.68) * 2.2; r += 60 * k; g += 30 * k; b += 70 * k; }  // purple sheen
      var ember = vnoise(x / 10, y / 6 + 8, 5, 2);
      if (ember > 0.78) { r += (ember - 0.78) * 320; g += (ember - 0.78) * 90; } // cracks glowing inside rock
      return [r, g, b];
    });
  }
  function lavaCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 8, 6, 3);
      var crust = vnoise(x / 5 + 3, y / 5 + 7, 7, 2);
      if (crust > 0.74) { var d = (crust - 0.74) * 2.5; return [190 - d * 60, 60 - d * 30, 20]; }  // dark crust plates
      var r = 255, g = 120 + n * 110, b = 24 + n * 40;
      var hot = vnoise(x / 3, y / 3, 9, 2);
      if (hot > 0.72) { g += 60; b += 30; }
      return [Math.min(255, r), Math.min(255, g), Math.min(120, b)];
    });
  }
  function sulfurCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 6, y / 6, 7, 2);
      return [172 + n * 60, 158 + n * 50, 70 + n * 40];
    });
  }

  var basaltTex = texFrom(basaltCanvas());
  var obsidianTex = texFrom(obsidianCanvas());
  var lavaTex = texFrom(lavaCanvas());
  var sulfurTex = texFrom(sulfurCanvas());

  var matBasalt = ps1Material(basaltTex);
  var matObs = ps1Material(obsidianTex);
  var matLava = PS1.privateFlicker(ps1Material(lavaTex));   // eruption flares live here
  var matSulfur = ps1Material(sulfurTex);
  var matEmber = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 150, 60)));

  var LAVA_C = [0, 0.7, 0];
  var volcRelight = function (x, y, z, nx, ny, nz) {
    var dx = LAVA_C[0] - x, dy = LAVA_C[1] - y, dz = LAVA_C[2] - z;
    var d2 = dx * dx + dy * dy + dz * dz;
    var d = Math.sqrt(d2), inv = 1 / (d + 1e-4);
    var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
    var fall = 3.4 / (1 + d2 * 0.008);
    var hemi = 0.5 + 0.5 * ny;
    var r = 0.10 + fall * (0.45 + 0.55 * nd) * 1.5 + 0.04 * hemi;
    var g = 0.075 + fall * (0.45 + 0.55 * nd) * 0.62 + 0.035 * hemi;
    var b = 0.07 + fall * (0.45 + 0.55 * nd) * 0.24 + 0.04 * hemi;
    return [Math.min(1.2, r), Math.min(1.05, g), Math.min(1.0, b)];
  };

  PS1.registerScene(function () {
    setRelight(volcRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var skyL = new THREE.DirectionalLight(0x665577, 1);
    skyL.position.set(0.1, 0.95, 0.2).multiplyScalar(30);
    skyL.castShadow = true;
    skyL.shadow.mapSize.set(1024, 1024);
    skyL.shadow.camera.near = 2; skyL.shadow.camera.far = 60;
    skyL.shadow.camera.left = -18; skyL.shadow.camera.right = 18;
    skyL.shadow.camera.top = 18; skyL.shadow.camera.bottom = -18;
    skyL.shadow.bias = -0.004; skyL.shadow.normalBias = 0.05;
    scene.add(skyL); scene.add(skyL.target);

    scene.add(PS1.makeSky({
      top: [0.03, 0.02, 0.03], horizon: [0.30, 0.10, 0.05], bottom: [0.05, 0.03, 0.03],
      sunDir: [0.1, 0.9, 0.2], sunCol: [0, 0, 0], stars: 0, meteors: 0, radius: 95
    }));

    scene.add(PS1.groundGrid(matBasalt, 0, 0, 44, 44, 12, 1, 0, 1));

    // ---------------- lava lake + altar island ------------------------
    (function () {
      var lake = PS1.groundGrid(matLava, 0, 0, 19, 19, 5, 0.5, 0.10, 1);
      scene.add(lake);
      // crust ring hugging the shore
      scene.add(prismMesh(matBasalt, 0, 0, 10.6, 0.35, 14, 6, 22, 1.2));
    })();
    // altar island in the lake's heart
    (function () {
      scene.add(cs(prismMesh(matObs, 0, 0, 3.4, 1.1, 9, 6, 1.4)));
      scene.add(PS1.groundGrid(matBasalt, 0, 0, 5.4, 5.4, 2, 1, 1.14, 1));
      scene.add(cs(boxMesh(matObs, 0, 3.0, 0, 1.1, 3.4, 1.1, 1.2)));
      scene.add(boxMesh(matEmber, 0, 4.85, 0, 0.5, 0.3, 0.5, 2, 0, [1.8, 0.9, 0.3]));   // crown glow
      for (var p2 = 0; p2 < 4; p2++) {
        var a = p2 / 4 * Math.PI * 2 + 0.4;
        var px = Math.cos(a) * 2.2, pz = Math.sin(a) * 2.2;
        scene.add(cs(prismMesh(matObs, px, pz, 0.3, 2.2, 5, 1.4, 3)));
        // chains from each pillar down into the lava
        scene.add(boxMesh(ps1Material(PS1.solidTexture(60, 56, 52)), px * 1.28, 0.6, pz * 1.28, 0.05, 1.2, 0.05, 2, 0.25 * (p2 % 2 ? 1 : -1)));
      }
      colliders.push({ x0: -2.6, z0: -2.6, x1: 2.6, z1: 2.6 });
    })();
    // arched stone bridge from the south ledge to the island
    (function () {
      for (var b2 = 0; b2 < 9; b2++) {
        var t = b2 / 8;
        var bz = 13.2 - t * 9.6;
        var by = 0.5 + Math.sin(Math.PI * t) * 0.55;
        scene.add(cs(boxMesh(matBasalt, Math.sin(t * 9) * 0.12, by, bz, 1.7, 0.28, 1.35, 1.1)));
      }
      [-0.85, 0.85].forEach(function (ox) {
        for (var r2 = 0; r2 < 4; r2++) {
          var t2 = 0.15 + r2 * 0.22;
          scene.add(boxMesh(matObs, ox, 0.85 + Math.sin(Math.PI * t2) * 0.5, 12.5 - t2 * 9.2, 0.16, 1.0, 0.16, 2));
        }
      });
    })();

    // ---------------- caldera cliff ring ---------------------------------
    for (var seg = 0; seg < 18; seg++) {
      var a2 = seg / 18 * Math.PI * 2;
      var hgt = 11 + hash2(seg, 5) * 7;
      var rr = 17.8 + (hash2(seg, 11) - 0.5) * 1.2;
      var rock = boxMesh(matObs, 0, 0, 0, 7.0, hgt, 3.2, 1.1, (hash2(seg, 3) - 0.5) * 0.25);
      rock.position.set(Math.cos(a2) * rr, hgt / 2 - 1, Math.sin(a2) * rr);
      rock.rotation.y = -a2 + Math.PI / 2;
      scene.add(cs(rock));
    }
    // jagged rim spikes
    for (var sp2 = 0; sp2 < 10; sp2++) {
      var sa = sp2 / 10 * Math.PI * 2 + 0.3;
      var spike = prismMesh(matObs, 0, 0, 1.1 + hash2(sp2, 7) * 1.3, 3.5, 5, 1.4, 5, null, 0);
      spike.position.set(Math.cos(sa) * 16.6, 12 + hash2(sp2, 9) * 4, Math.sin(sa) * 16.6);
      spike.rotation.z = (hash2(sp2, 2) - 0.5) * 0.5;
      scene.add(cs(spike));
    }

    // ---------------- rim props ----------------------------------------
    // obsidian shards + sulfur mounds + charred stakes
    for (var sh2 = 0; sh2 < 8; sh2++) {
      var aa = hash2(sh2, 21) * Math.PI * 2;
      var rd = 12.2 + hash2(sh2, 31) * 2.8;
      var shard = prismMesh(matObs, 0, 0, 0.5 + hash2(sh2, 4) * 0.6, 1.6 + hash2(sh2, 8) * 2.2, 5, 1.4, 2, null, 0);
      shard.position.set(Math.cos(aa) * rd, 0, Math.sin(aa) * rd);
      shard.rotation.z = (hash2(sh2, 6) - 0.5) * 0.9;
      scene.add(cs(shard));
      colliders.push({ x0: Math.cos(aa) * rd - 0.5, z0: Math.sin(aa) * rd - 0.5, x1: Math.cos(aa) * rd + 0.5, z1: Math.sin(aa) * rd + 0.5 });
    }
    [[5.2, -11.0], [-12.8, 3.2], [10.5, 7.5]].forEach(function (sf) {
      scene.add(blobMesh(matSulfur, sf[0], 0.3, sf[1], 0.8, 0.6, 0.4, function (sd2) { return [1.05, 1.0, 0.8]; }));
    });
    // magma crack decals radiating from the lake
    var matVein = PS1.decalMaterial(1.0, 0.42, 0.1, 0.5);
    [[11.5, 2.0, 15.5, 3.4], [-3.0, -11.8, 4.2, -15.8], [-13.8, -4.0, -16.5, -6.0]].forEach(function (v) {
      decals.path([[v[0], v[1]], [(v[0] + v[2]) / 2 + 0.8, (v[1] + v[3]) / 2 - 0.6], [v[2], v[3]]], 0.35, 0.6, matVein, 0.006);
    });
    // bone pile on the north ledge
    decals.oct(0.8, 12.6, 0.9, PS1.decalMaterial(0.55, 0.5, 0.4, 0.6), 0.006, 33);

    // ---------------- particles ----------------------------------------
    var ash = PS1.makeParticles({
      mode: 'petal', count: 300, color: [0.36, 0.34, 0.34],
      size: 0.016, speed: 0.5, sway: 0.5,
      area: [-16, 16, -16, 16, 12]
    });
    var embers = PS1.makeParticles({
      mode: 'steam', count: 240, color: [1.0, 0.5, 0.16],
      size: 0.028, speed: 1.7, sway: 0.3,
      area: [-9, 9, -9, 9, 8]
    });
    scene.add(ash); scene.add(embers);

    // lake ring colliders (blocking, gap at the bridge)
    for (var lc = 0; lc < 10; lc++) {
      var la = lc / 10 * Math.PI * 2;
      if (la > 4.4 && la < 5.0) continue;   // bridge gap on +z
      var lx = Math.cos(la) * 10.9, lz = Math.sin(la) * 10.9;
      colliders.push({ x0: lx - 1.4, z0: lz - 1.4, x1: lx + 1.4, z1: lz + 1.4 });
    }

    var erupt = { next: 5 };
    return {
      name: '烈焰火山口',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -15.5, x1: 15.5, z0: -15.5, z1: 15.5 },
      spawn: [1.2, 14.6, Math.atan2(-(0 - 1.2), -(-2 - 14.6)), 0.0],
      idle: { pos: [5.5, 2.6, 12.0], target: [-0.5, 1.4, -2] },   // r=13.1: on the ledge, clear of the 16.2+ cliff inner face
      fog: { color: [0.17, 0.065, 0.045], near: 13, far: 46 },
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [ash, embers],
      update: function (t) {
        lavaTex.offset.x = t * 0.02;
        lavaTex.offset.y = -t * 0.013;
        // eruption: the whole lake flares in a double pulse
        var f = 1.0;
        if (t > erupt.next) {
          var since = t - erupt.next;
          if (since < 0.14) f = 1.9;
          else if (since < 0.28) f = 1.15;
          else if (since < 0.42) f = 1.7;
          else if (since > 0.8) { erupt.next = t + 5 + Math.random() * 5; }
        }
        matLava.uniforms.uFlicker.value = f;
        matEmber.uniforms.uFlicker.value = f;
      }
    };
  });
})();
