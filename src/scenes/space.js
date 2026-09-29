(function () {
  'use strict';
  // ======================= 太空舷窗观测舱 ==============================
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var quadCorners = PS1.quadCorners, blobMesh = PS1.blobMesh;
  var cs = PS1.cs, setRelight = PS1.setRelight;
  var ps1Material = PS1.ps1Material;

  function deckCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var plate = Math.floor(x / 22), py = Math.floor(y / 22);
      var tint = (hash2(plate, py) * 2 - 1) * 6;
      var n = vnoise(x / 7, y / 7, 8, 2);
      var r = 66 + n * 20 + tint, g = 70 + n * 20 + tint, b = 78 + n * 22 + tint;
      var lx = x % 22, ly = y % 22;
      if (lx < 1 || ly < 1) { r *= 0.45; g *= 0.45; b *= 0.45; }
      if (lx > 9 && lx < 13 && ly > 9 && ly < 13) { r *= 0.6; g *= 0.6; b *= 0.6; }   // tread plug
      var scuff = vnoise(x / 12 + 2, y / 18, 4, 2);
      if (scuff > 0.70) { var k = (scuff - 0.70) * 1.4; r *= 1 - k * 0.4; g *= 1 - k * 0.4; b *= 1 - k * 0.35; }
      return [r, g, b];
    });
  }
  function panelCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 8, y / 8, 6, 2);
      var r = 58 + n * 18, g = 60 + n * 18, b = 68 + n * 20;
      if (x % 31 < 1 || y % 21 < 1) { r *= 0.5; g *= 0.5; b *= 0.5; }      // panel seams
      var rivet = (x % 31 > 12 && x % 31 < 16 && y % 21 > 8 && y % 21 < 12);
      if (rivet) { r = 96; g = 98; b = 104; }
      return [r, g, b];
    });
  }
  function gasGiantCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var band = Math.sin(y * 0.22 + Math.sin(x * 0.05) * 1.8);
      var storm = vnoise(x / 9, y / 9, 6, 2);
      var r, g, b;
      if (band > 0.3) { r = 205; g = 158; b = 108; }
      else if (band > -0.2) { r = 178; g = 128; b = 92; }
      else { r = 128; g = 92; b = 78; }
      if (storm > 0.72) { var k = (storm - 0.72) * 2.2; r += (60 - r * 0.2) * k * 0.3; g += (40 - g * 0.2) * k * 0.3; }
      var spot = Math.hypot(x - 44, y - 24);
      if (spot < 7) { r = 222; g = 130; b = 78; }                            // great storm
      return [r * (0.92 + storm * 0.14), g * (0.92 + storm * 0.14), b * (0.92 + storm * 0.14)];
    });
  }


  var deckTex = texFrom(deckCanvas());
  var panelTex = texFrom(panelCanvas());
  var gasGiantTex = texFrom(gasGiantCanvas());
  // ring texture with the planet's shadow baked in: sun/planet/ring are static,
  // so the shadow wedge is geometrically exact and costs nothing at runtime.
  var PLANET_POS = new THREE.Vector3(-8, 8, -70);
  var SUN_TOWARD = new THREE.Vector3(0.15, 0.35, -0.92).normalize();
  var RING_MAT4 = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2 - 0.42, 0.2, 0));
  function ringTexel(x, y) {
    // band recipe identical to the old ringCanvas (canvas-space y)
    var band = Math.sin(y * 0.9) * 0.5 + 0.5;
    var gap = (y > 26 && y < 31) || (y > 44 && y < 47);
    var a0 = gap ? 30 : 150 + band * 90;
    var t = (hash2(x, y) * 2 - 1) * 8;
    // world position of this texel: u = x/64 (angle), v = 1 - y/64 (radial)
    var rad = 19 + (1 - y / 64) * 8;
    var ang = (x / 64) * Math.PI * 2;
    var local = new THREE.Vector3(Math.cos(ang) * rad, Math.sin(ang) * rad, 0).applyMatrix4(RING_MAT4).add(PLANET_POS);
    var toP = new THREE.Vector3().subVectors(PLANET_POS, local);
    var tproj = toP.dot(SUN_TOWARD);
    var shade = 1;
    if (tproj > 0) {
      var dClose = Math.sqrt(Math.max(0, toP.lengthSq() - tproj * tproj));
      shade = Math.min(1, 0.34 + (dClose - 15) / 4);   // hard core + soft limb
    }
    return [(a0 * 0.98 + t) * shade, (a0 * 0.9 + t) * shade, (a0 * 0.76 + t) * shade];
  }
  var ringTex = texFrom(pixelLoop(newCanvas(64), ringTexel));

  var matDeck = ps1Material(deckTex);
  var matPanel = ps1Material(panelTex);
  var matGiant = ps1Material(gasGiantTex);
  var matRing = ps1Material(ringTex);
  var matBlinkR = PS1.privateFlicker(ps1Material(PS1.solidTexture(255, 80, 70)));
  var matBlinkG = PS1.privateFlicker(ps1Material(PS1.solidTexture(90, 255, 130)));
  var matBlinkA = PS1.privateFlicker(ps1Material(PS1.solidTexture(120, 190, 255)));
  var matStrip = PS1.privateFlicker(ps1Material(PS1.solidTexture(235, 240, 255)));

  var SUNDIR = new THREE.Vector3(0.15, 0.35, -0.92).normalize();   // sun sits in the window cone
  var INTERIOR = [3.2, 3.0, -1.6];                                 // ceiling light position
  var HOLO = [0.3, 1.35, 0.6];                                       // holo-table cyan glow
  var spaceRelight = function (x, y, z, nx, ny, nz) {
    var ndl = Math.max(0, nx * SUNDIR.x + ny * SUNDIR.y + nz * SUNDIR.z);
    // interior fill from ceiling strips
    var dx = INTERIOR[0] - x, dy = INTERIOR[1] - y, dz = INTERIOR[2] - z;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var inv = 1 / (d + 1e-4);
    var nd = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
    var fill = Math.max(0, 1.9 - 0.15 * d) * (0.45 + 0.55 * nd);
    var hx = HOLO[0] - x, hy = HOLO[1] - y, hz = HOLO[2] - z;
    var hd = Math.sqrt(hx * hx + hy * hy + hz * hz);
    var hnd = Math.max(0, (hx * nx + hy * ny + hz * nz) / (hd + 1e-4));
    var hfall = 1.1 / (1 + hd * hd * 0.35) * (0.4 + 0.6 * hnd);
    var sun = ndl * 1.15;   // hard sunlight through the window
    var r = sun * 1.05 + fill * 0.95 + hfall * 0.22;
    var g = sun * 1.02 + fill * 1.0 + hfall * 0.62;
    var b = sun * 0.95 + fill * 1.14 + hfall * 0.75;
    return [Math.min(1.22, r), Math.min(1.2, g), Math.min(1.2, b)];
  };

  PS1.registerScene(function () {
    setRelight(spaceRelight);
    var scene = new THREE.Scene();
    var decals = PS1.newDecalSet();
    var colliders = [];

    var sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.copy(SUNDIR).multiplyScalar(30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -0.004; sun.shadow.normalBias = 0.05;
    scene.add(sun); scene.add(sun.target);

    scene.add(PS1.makeSky({
      top: [0.004, 0.005, 0.012], horizon: [0.004, 0.005, 0.012], bottom: [0.002, 0.003, 0.006],
      sunDir: SUNDIR.toArray(), sunCol: [1.5, 1.42, 1.2], sunCut: 0.99955, sunGlow: 0.10,
      stars: 1.2, meteors: 0, radius: 95, nebula: [0.10, 0.06, 0.17], nebAxis: [0.5, 0.35, 0.55]
    }));

    // ---------------- ringed gas giant + moon --------------------------
    // PS1 materials read a per-vertex color attribute: bake relight into any
    // stock Three geometry before adding it, and rebuild the ring's UVs so the
    // band texture runs concentrically instead of as straight stripes.
    function bakeVertexColors(mesh) {
      var g = mesh.geometry, pp = g.attributes.position, nn = g.attributes.normal, cols = [];
      for (var i = 0; i < pp.count; i++) {
        var wx = pp.getX(i) + mesh.position.x, wy = pp.getY(i) + mesh.position.y, wz = pp.getZ(i) + mesh.position.z;
        var c = PS1.relight(wx, wy, wz, nn.getX(i), nn.getY(i), nn.getZ(i));
        cols.push(c[0], c[1], c[2]);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      return mesh;
    }
    var planet = new THREE.Mesh(new THREE.SphereGeometry(16, 18, 12), matGiant);
    planet.position.copy(PLANET_POS);
    scene.add(bakeVertexColors(planet));
    var ring = new THREE.Mesh(new THREE.RingGeometry(19, 27, 30, 1), matRing);
    (function () {   // radial UVs: v = (r - inner)/(outer - inner)
      var pp = ring.geometry.attributes.position, uv = ring.geometry.attributes.uv;
      for (var i = 0; i < pp.count; i++) {
        var x = pp.getX(i), y = pp.getY(i);
        var r = Math.sqrt(x * x + y * y);
        uv.setXY(i, Math.atan2(y, x) / (Math.PI * 2) + 0.5, (r - 19) / 8);
      }
    })();
    ring.position.copy(planet.position);
    ring.rotation.set(Math.PI / 2 - 0.42, 0.2, 0);   // must match RING_MAT4 above: the shadow is baked for this exact orientation
    scene.add(bakeVertexColors(ring));
    var moon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), ps1Material(PS1.solidTexture(150, 148, 145)));
    moon.position.set(6, -4, -50);
    scene.add(bakeVertexColors(moon));
    // tumbling debris belt
    var matRock = ps1Material(PS1.solidTexture(96, 92, 88));
    var debris = [];
    [[18, 5, -38], [-14, -2, -52], [24, -8, -46]].forEach(function (d, di) {
      var rock = PS1.blobMesh(matRock, 0, 0, 0, 0.7 + di * 0.25, 0.8, 0.45, function (sd) { return [1, 0.96, 0.9]; });
      rock.position.set(d[0], d[1], d[2]);
      scene.add(rock);
      debris.push(rock);
    });
    // blue marble planet (surface scrolls under its baked terminator)
    var marbleTex = texFrom(pixelLoop(newCanvas(64), function (x, y) {
      var n = vnoise(x / 9, y / 9, 6, 2);
      if (y < 6 || y > 58) return [220, 228, 238];
      if (n > 0.58) return [66 + n * 40, 108 + n * 40, 62];
      return [26 + n * 30, 62 + n * 44, 122 + n * 60];
    }));
    var marble = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10), ps1Material(marbleTex));
    marble.position.set(26, 14, -58);
    scene.add(bakeVertexColors(marble));
    // patrolling shuttle (flyby every ~24 s, opposite direction to the cargo sat)
    var shuttle = new THREE.Group();
    (function () {
      var matShuttle = ps1Material(PS1.solidTexture(158, 162, 172));
      shuttle.add(boxMesh(matShuttle, 0, 0, 0, 1.6, 0.4, 0.5, 1.4));
      shuttle.add(prismMesh(matShuttle, 0, 0, 0.55, 0.18, 6, 1.4, 0.5, null, -0.18));
      shuttle.add(boxMesh(matBlinkA, 0.9, 0, 0, 0.12, 0.12, 0.12, 2, 0, [1.4, 1.5, 1.6]));
      shuttle.scale.set(0.6, 0.6, 0.6);
      scene.add(shuttle);
    })();

    // drifting cargo satellite (animated)
    var sat = new THREE.Group();
    (function () {
      var matSat = ps1Material(PS1.solidTexture(120, 124, 132));
      sat.add(boxMesh(matSat, 0, 0, 0, 0.9, 0.9, 1.3, 1.2));
      sat.add(boxMesh(matBlinkR, 0, 0.7, 0, 0.1, 0.1, 0.1, 2, 0, [1.6, 0.4, 0.4]));
      sat.add(boxMesh(matStrip, 1.5, 0, 0, 1.6, 0.06, 0.9, 2, 0, [0.45, 0.5, 0.55]));   // solar panel
      sat.add(boxMesh(matStrip, -1.5, 0, 0, 1.6, 0.06, 0.9, 2, 0, [0.45, 0.5, 0.55]));
      sat.position.set(8, 3, -40);
      sat.scale.set(0.5, 0.5, 0.5);
      scene.add(sat);
    })();

    // ---------------- observation lounge --------------------------------
    var R = { x: 4.2, zN: -5.4, zS: 4.6 };   // room: x -4.2..4.2, z -5.4..4.6
    // floor + ceiling
    scene.add(PS1.groundGrid(matDeck, 0, -0.4, 8.4, 10.0, 4, 1, 0, 1));
    scene.add(PS1.groundGrid(matPanel, 0, -0.4, 8.4, 10.0, 4, 1, 3.2, -1));
    // side + back walls
    scene.add(PS1.wallSurface(matPanel, [-4.2, 0, R.zN], [-4.2, 0, R.zS], [-4.2, 3.2, R.zS], [-4.2, 3.2, R.zN], 5, 1.6, 1, 0, 0));
    scene.add(PS1.wallSurface(matPanel, [4.2, 0, R.zS], [4.2, 0, R.zN], [4.2, 3.2, R.zN], [4.2, 3.2, R.zS], 5, 1.6, -1, 0, 0));
    scene.add(PS1.wallSurface(matPanel, [4.2, 0, R.zS], [-4.2, 0, R.zS], [-4.2, 3.2, R.zS], [4.2, 3.2, R.zS], 5, 1.6, 0, 0, -1));
    // north wall: solid border + big window opening (void shows the dome)
    var WIN = { x0: -3.3, x1: 3.3, y0: 0.60, y1: 3.00 };
    scene.add(PS1.wallSurface(matPanel, [-4.2, 0, R.zN], [WIN.x0, 0, R.zN], [WIN.x0, 3.2, R.zN], [-4.2, 3.2, R.zN], 2, 1.6, 0, 0, 1));
    scene.add(PS1.wallSurface(matPanel, [WIN.x1, 0, R.zN], [4.2, 0, R.zN], [4.2, 3.2, R.zN], [WIN.x1, 3.2, R.zN], 2, 1.6, 0, 0, 1));
    scene.add(PS1.wallSurface(matPanel, [WIN.x0, 0, R.zN], [WIN.x1, 0, R.zN], [WIN.x1, WIN.y0, R.zN], [WIN.x0, WIN.y0, R.zN], 5, 0.5, 0, 0, 1));
    scene.add(PS1.wallSurface(matPanel, [WIN.x0, WIN.y1, R.zN], [WIN.x1, WIN.y1, R.zN], [WIN.x1, 3.2, R.zN], [WIN.x0, 3.2, R.zN], 5, 0.4, 0, 0, 1));
    // thick window frame + mullions (they cast the shaft shadow on the floor)
    scene.add(cs(boxMesh(matPanel, 0, WIN.y0, R.zN + 0.06, 7.4, 0.18, 0.26, 1.4)));
    scene.add(cs(boxMesh(matPanel, 0, WIN.y1, R.zN + 0.06, 7.4, 0.18, 0.26, 1.4)));
    [-1.65, 0, 1.65].forEach(function (mx) {
      scene.add(cs(boxMesh(matPanel, mx, (WIN.y0 + WIN.y1) / 2, R.zN + 0.06, 0.14, 2.55, 0.26, 1.4)));
    });
    // deep beveled reveals angling back to the wall
    scene.add(cs(quadCorners(matPanel, [WIN.x0 - 0.14, WIN.y0 - 0.05, R.zN + 0.28], [WIN.x0 - 0.95, 0.02, R.zN], [WIN.x0 - 0.95, 3.2, R.zN], [WIN.x0 - 0.14, WIN.y1 + 0.05, R.zN + 0.28], 2, 1.6)));
    scene.add(cs(quadCorners(matPanel, [WIN.x1 + 0.14, WIN.y0 - 0.05, R.zN + 0.28], [WIN.x1 + 0.95, 0.02, R.zN], [WIN.x1 + 0.95, 3.2, R.zN], [WIN.x1 + 0.14, WIN.y1 + 0.05, R.zN + 0.28], 2, 1.6)));
    // handrail along the window
    scene.add(boxMesh(matStrip, 0, 0.95, R.zN + 0.5, 7.0, 0.06, 0.06, 2, 0, [0.5, 0.55, 0.62]));
    [-3.2, -1.1, 1.1, 3.2].forEach(function (px) {
      scene.add(boxMesh(matStrip, px, 0.72, R.zN + 0.5, 0.05, 0.5, 0.05, 2, 0, [0.4, 0.45, 0.52]));
    });

    // sun shaft pool on the deck (bright decal where the window projects)
    decals.rect(0.5, -3.4, 4.8, 2.2, PS1.decalMaterial(1.0, 0.97, 0.88, 0.5), 0.012);

    // ---------------- lounge furniture ----------------------------------
    // console desk under the window with blinking readouts
    (function () {
      var cx = 0, cz = -4.3;
      scene.add(cs(boxMesh(matPanel, cx, 0.5, cz, 3.6, 0.16, 0.8, 1.4)));
      [[-1.6, -0.28], [1.6, -0.28], [-1.6, 0.28], [1.6, 0.28]].forEach(function (p) {
        scene.add(boxMesh(matPanel, cx + p[0], 0.25, cz + p[1], 0.12, 0.5, 0.12, 2));
      });
      scene.add(boxMesh(matPanel, cx, 0.62, cz + 0.18, 3.6, 0.1, 0.16, 1.4));   // lip
      var blinkers = [[-1.2, matBlinkR], [-0.8, matBlinkG], [-0.4, matBlinkA], [0.2, matBlinkG], [0.7, matBlinkR], [1.3, matBlinkA]];
      blinkers.forEach(function (b) {
        scene.add(boxMesh(b[1], cx + b[0], 0.60, cz - 0.1, 0.08, 0.05, 0.08, 2, 0, [1.4, 1.4, 1.4]));
      });
      // small screen with scanline texture
      scene.add(quadMesh(ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var line = Math.floor(y / 5) % 2 === 0;
        var graph = Math.sin(x * 0.3) * 14 + 32;
        if (Math.abs(y - graph) < 3) return [90, 230, 140];
        return line ? [10, 26, 16] : [6, 16, 10];
      }))), cx - 0.3, 0.78, cz - 0.32, 0, 0, 1, 0.85, 0.5, 1, 1));
      colliders.push({ x0: cx - 1.9, z0: cz - 0.5, x1: cx + 1.9, z1: cz + 0.5 });
    })();
    // chairs
    [[-1.5, -3.15, 0.28], [1.5, -3.15, -0.28]].forEach(function (c) {
      var matChair = ps1Material(PS1.solidTexture(96, 60, 52));
      scene.add(cs(boxMesh(matChair, c[0], 0.45, c[1], 0.66, 0.14, 0.62, 1.4)));
      scene.add(cs(boxMesh(matChair, c[0], 0.75, c[1] + 0.25 + c[2] * 0.3, 0.66, 0.7, 0.12, 1.4, c[2])));
      [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]].forEach(function (l) {
        scene.add(boxMesh(matPanel, c[0] + l[0], 0.2, c[1] + l[1], 0.08, 0.4, 0.08, 2));
      });
      colliders.push({ x0: c[0] - 0.4, z0: c[1] - 0.4, x1: c[0] + 0.4, z1: c[1] + 0.4 });
    });
    // floor plant + coffee mug on a side table
    (function () {
      var matPot2 = ps1Material(PS1.solidTexture(140, 96, 70));
      scene.add(prismMesh(matPot2, -3.4, 2.6, 0.22, 0.5, 7, 1.6, 0.8));
      scene.add(blobMesh(ps1Material(PS1.solidTexture(50, 110, 66)), -3.4, 0.85, 2.6, 0.4, 1.1, 0.35, function (sd) { return sd > 0.5 ? [0.9, 1.15, 0.85] : [0.75, 1.0, 0.7]; }));
      colliders.push({ x0: -3.7, z0: 2.3, x1: -3.1, z1: 2.9 });
    })();
    scene.add(boxMesh(matPanel, 3.2, 0.55, 1.8, 0.7, 0.06, 0.7, 1.4));
    scene.add(prismMesh(matPanel, 3.2, 1.8, 0.12, 0.3, 6, 1.4, 0.6, null, 0.4));
    scene.add(prismMesh(ps1Material(PS1.solidTexture(235, 235, 240)), 3.2, 1.8, 0.07, 0.12, 6, 1.2, 0.4, null, 0.7));
    // ceiling: structural ribs with light strips between + a red emergency beacon
    [-4.2, -1.4, 1.4, 4.2].forEach(function (rz) {
      scene.add(boxMesh(matPanel, 0, 3.04, rz, 8.4, 0.2, 0.26, 1.4));
    });
    [-2.8, 0, 2.8].forEach(function (rz) {
      scene.add(boxMesh(matStrip, 0, 3.05, rz, 7.0, 0.07, 0.26, 2, 0, [1.5, 1.5, 1.55]));
    });
    var beaconBar = new THREE.Group();
    beaconBar.position.set(0, 2.88, 0.2);
    beaconBar.add(prismMesh(matPanel, 0, 0, 0.1, 0.06, 8, 1.2, 0.4));
    beaconBar.add(boxMesh(matBlinkR, 0.16, 0, 0, 0.3, 0.05, 0.06, 2, 0, [1.7, 0.35, 0.3]));
    beaconBar.add(boxMesh(matBlinkR, -0.16, 0, 0, 0.3, 0.05, 0.06, 2, 0, [1.7, 0.35, 0.3]));
    scene.add(beaconBar);
    // wall pipes + airlock door on the east wall
    scene.add(cs(boxMesh(ps1Material(PS1.solidTexture(84, 88, 96)), 4.1, 2.6, -1.0, 0.12, 0.12, 5.2, 1.4)));
    scene.add(cs(boxMesh(matPanel, 4.12, 1.15, 2.6, 0.12, 2.3, 1.9, 1.2)));
    scene.add(boxMesh(matStrip, 4.05, 1.15, 2.6, 0.03, 0.5, 0.5, 2, 0, [0.9, 0.5, 0.3]));   // airlock warning


    // ---------------- v8 detail pass ------------------------------------
    // small porthole window on the east wall (round, opens to stars)
    (function () {
      var porthole = prismMesh(matPanel, 0, 0, 0.55, 0.14, 10, 2.4, 0.5, null, 0);
      porthole.rotation.y = Math.PI / 2;
      porthole.position.set(4.22, 1.9, -1.0);
      scene.add(porthole);
      scene.add(boxMesh(matStrip, 4.14, 1.9, -1.0, 0.05, 0.9, 0.9, 2, 0, [0.03, 0.03, 0.04]));   // dark glass inset
    })();
    // floating zero-G coffee mug + pen near the window (slow tumble)
    var floatMug = new THREE.Group();
    var floatPen = new THREE.Group();
    (function () {
      var matMug2 = ps1Material(PS1.solidTexture(225, 228, 235));
      floatMug.add(prismMesh(matMug2, 0, 0, 0.1, 0.14, 8, 1.4, 0.5, null, 0));
      floatMug.add(boxMesh(matStrip, 0, -0.02, -0.13, 0.03, 0.1, 0.03, 2));
      floatMug.position.set(-1.6, 1.9, -4.4);
      scene.add(floatMug);
      floatPen.add(boxMesh(ps1Material(PS1.solidTexture(220, 180, 60)), 0, 0, 0, 0.03, 0.03, 0.22, 2));
      floatPen.position.set(-1.1, 2.2, -4.6);
      scene.add(floatPen);
    })();
    // wall-mounted star chart + locker decal
    decals.wall(4.165, 2.0, 0.9, true, 1.0, 0.8, PS1.decalMaterial(0.13, 0.22, 0.32, 0.82));
    decals.wall(-4.165, 1.6, 1.8, true, 0.6, 1.2, PS1.decalMaterial(0.28, 0.3, 0.34, 0.8));
    // open tool crate with tools
    (function () {
      var ox = -3.3, oz = 1.2;
      scene.add(cs(boxMesh(matPanel, ox, 0.28, oz, 0.9, 0.5, 0.6, 1.4)));
      var lid = boxMesh(matPanel, ox, 0.56, oz + 0.4, 0.9, 0.07, 0.5, 1.4, -1.15);
      scene.add(lid);
      scene.add(boxMesh(matStrip, ox - 0.2, 0.56, oz, 0.3, 0.05, 0.08, 2, 0, [0.8, 0.5, 0.3]));   // wrench hint
      scene.add(boxMesh(matStrip, ox + 0.15, 0.56, oz, 0.08, 0.05, 0.3, 2, 0, [0.6, 0.62, 0.7]));
      colliders.push({ x0: ox - 0.5, z0: oz - 0.35, x1: ox + 0.5, z1: oz + 0.75 });
    })();
    // oxygen tank rack
    (function () {
      var ox2 = 3.4, oz2 = -3.4;
      scene.add(boxMesh(matPanel, ox2, 0.5, oz2, 0.8, 1.0, 0.3, 1.4));
      [-0.2, 0.2].forEach(function (o) {
        var tank = prismMesh(ps1Material(PS1.solidTexture(70, 130, 200)), 0, 0, 0.12, 0.85, 8, 1.4, 1.4, null, 0);
        tank.rotation.z = Math.PI / 2;
        tank.position.set(ox2 + o, 1.1, oz2);
        scene.add(tank);
      });
      colliders.push({ x0: ox2 - 0.45, z0: oz2 - 0.2, x1: ox2 + 0.45, z1: oz2 + 0.5 });
    })();
    // fire extinguisher + first-aid box by the airlock
    scene.add(prismMesh(ps1Material(PS1.solidTexture(190, 50, 40)), 3.7, 3.2, 0.14, 0.5, 8, 1.4, 0.8, null, 0.12));
    scene.add(boxMesh(ps1Material(PS1.solidTexture(240, 240, 240)), 4.1, 1.6, 3.6, 0.12, 0.36, 0.36, 1.4));
    scene.add(boxMesh(ps1Material(PS1.solidTexture(200, 40, 40)), 4.04, 1.6, 3.6, 0.02, 0.1, 0.26, 2));
    // flight jacket on a wall hook
    scene.add(boxMesh(matStrip, -4.12, 1.5, -2.2, 0.05, 0.06, 0.2, 2, 0, [0.5, 0.5, 0.55]));
    scene.add(boxMesh(ps1Material(PS1.solidTexture(90, 74, 60)), -4.08, 1.2, -2.2, 0.14, 0.6, 0.4, 1.6));
    // cot with pillow + blanket
    (function () {
      var cx3 = -2.8, cz3 = 3.2;
      scene.add(boxMesh(matPanel, cx3, 0.35, cz3, 1.9, 0.14, 0.85, 1.4));
      [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]].forEach(function (l3) {
        scene.add(boxMesh(matPanel, cx3 + l3[0], 0.16, cz3 + l3[1], 0.07, 0.32, 0.07, 2));
      });
      scene.add(boxMesh(ps1Material(PS1.solidTexture(200, 202, 208)), cx3 - 0.6, 0.46, cz3, 0.5, 0.1, 0.55, 1.4));
      scene.add(boxMesh(ps1Material(PS1.solidTexture(80, 96, 128)), cx3 + 0.3, 0.46, cz3, 1.0, 0.09, 0.7, 1.4));
      colliders.push({ x0: cx3 - 1.0, z0: cz3 - 0.5, x1: cx3 + 1.0, z1: cz3 + 0.5 });
    })();
    // floor cable bundle + hazard stripe decals
    scene.add(boxMesh(matStrip, 0.4, 0.02, 2.2, 2.6, 0.05, 0.16, 1.4, 0, [0.08, 0.09, 0.1]));
    decals.path([[0.4, 2.2], [1.4, 0.9], [1.9, -0.6]], 0.2, 0.16, PS1.decalMaterial(0.75, 0.6, 0.1, 0.5), 0.008);
    decals.rect(0, -4.98, 4.4, 0.3, PS1.decalMaterial(0.75, 0.6, 0.1, 0.5), 0.008);
    // robot vacuum patrolling the deck
    var vacuum = new THREE.Group();
    (function () {
      vacuum.add(prismMesh(matPanel, 0, 0, 0.22, 0.08, 8, 1.6, 0.4, null, 0));
      vacuum.add(boxMesh(matStrip, 0, 0.06, 0.2, 0.05, 0.03, 0.05, 2, 0, [0.6, 1.2, 0.7]));
      vacuum.position.set(-2.0, 0.05, 0.5);
      scene.add(vacuum);
    })();

    // ---------------- v9 layout: holo table as the room's hub ----------------
    var matHolo = PS1.privateFlicker(ps1Material(PS1.solidTexture(90, 230, 240)));
    var holoGlobe = new THREE.Group();
    (function () {
      var hx = 0.3, hz = 0.6;
      scene.add(cs(prismMesh(matPanel, hx, hz, 0.55, 0.78, 8, 2.4, 0.9)));
      scene.add(boxMesh(matStrip, hx, 0.82, hz, 1.7, 0.08, 1.7, 1.2, 0, [0.25, 0.28, 0.34]));
      holoGlobe.position.set(hx, 1.35, hz);
      [0, Math.PI / 2, 0.7].forEach(function (ry, ri) {
        var ring2 = prismMesh(matHolo, 0, 0, 0.36, 0.022, 16, 4.5, 0.3, null, 0);
        ring2.rotation.x = Math.PI / 2;
        ring2.rotation.z = ry + (ri === 2 ? 0.5 : 0);
        holoGlobe.add(ring2);
      });
      holoGlobe.add(prismMesh(matHolo, 0, 0, 0.12, 0.2, 8, 1, 0.5, null, -0.1));
      var holoMoonDot = boxMesh(matHolo, 0.5, 0, 0, 0.06, 0.06, 0.06, 2, 0, [1.5, 1.6, 1.6]);
      holoGlobe.add(holoMoonDot);
      scene.add(holoGlobe);
      decals.rect(hx, hz, 2.0, 2.0, PS1.decalMaterial(0.06, 0.24, 0.28, 0.4), 0.012);
      colliders.push({ x0: hx - 0.9, z0: hz - 0.9, x1: hx + 0.9, z1: hz + 0.9 });
    })();
    // console upgrade: slanted dash + radar screen with a SWEEPING needle + keyboard
    var radarNeedle = new THREE.Group();
    (function () {
      var cx = 0, cz = -4.3;
      scene.add(cs(quadCorners(matPanel, [cx - 1.7, 0.6, cz - 0.42], [cx + 1.7, 0.6, cz - 0.42], [cx + 1.7, 0.86, cz + 0.02], [cx - 1.7, 0.86, cz + 0.02], 3, 0.5)));
      scene.add(boxMesh(ps1Material(PS1.solidTexture(28, 30, 34)), cx + 0.6, 0.88, cz - 0.2, 0.6, 0.04, 0.3, 1.4));
      var radar = ps1Material(texFrom(pixelLoop(newCanvas(64), function (x, y) {
        var dx = x - 32, dy = y - 32, r = Math.sqrt(dx * dx + dy * dy);
        if (r > 30) return [8, 14, 10];
        if (Math.abs(r - 24) < 1 || Math.abs(r - 14) < 1 || Math.abs(r - 5) < 1) return [50, 140, 90];
        return [6, 16, 10];
      })));
      var scr = quadMesh(radar, 0, 0, 0, 0, 0, 1, 0.72, 0.72, 1, 1);
      scr.rotation.x = -0.5;
      scr.position.set(cx + 0.55, 0.94, cz - 0.16);
      scene.add(scr);
      radarNeedle.position.set(cx + 0.55, 1.0, cz - 0.14);
      radarNeedle.rotation.x = -0.5;
      radarNeedle.add(boxMesh(matHolo, 0.17, 0, 0, 0.34, 0.012, 0.02, 2, 0, [1.2, 1.6, 1.5]));
      scene.add(radarNeedle);
    })();
    // airlock on the south wall: wheel + control panel + warning band
    (function () {
      scene.add(cs(boxMesh(matPanel, 0, 1.15, 4.5, 1.6, 2.3, 0.16, 1.2)));
      scene.add(boxMesh(matPanel, 0, 1.15, 4.56, 1.3, 2.0, 0.06, 1.2));
      var wheel = prismMesh(matStrip, 0, 0, 0.16, 0.05, 8, 1.6, 0.4, null, 0);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(0, 1.15, 4.62);
      scene.add(wheel);
      scene.add(boxMesh(matPanel, 1.15, 1.45, 4.52, 0.34, 0.5, 0.1, 1.4));
      scene.add(boxMesh(matBlinkG, 1.15, 1.6, 4.46, 0.1, 0.1, 0.04, 2, 0, [1.2, 1.6, 1.2]));
      decals.wall(0, 2.75, 4.18, false, 1.5, 0.24, PS1.decalMaterial(0.75, 0.6, 0.1, 0.5));
      colliders.push({ x0: -0.9, z0: 4.2, x1: 0.9, z1: 4.7 });
    })();
    // snack machine on the east wall
    (function () {
      var sx = 4.0, sz = 0.6;
      scene.add(cs(boxMesh(matPanel, sx, 0.95, sz, 0.55, 1.9, 0.8, 1.4)));
      scene.add(boxMesh(matStrip, sx - 0.29, 1.05, sz, 0.03, 1.5, 0.6, 2, 0, [0.95, 1.0, 1.05]));
      [[-0.15, matBlinkA], [0, matBlinkG], [0.15, matBlinkR]].forEach(function (d) {
        scene.add(boxMesh(d[1], sx - 0.31, 1.7, sz + d[0], 0.02, 0.06, 0.12, 2, 0, [1.3, 1.3, 1.3]));
      });
      colliders.push({ x0: sx - 0.35, z0: sz - 0.45, x1: sx + 0.35, z1: sz + 0.45 });
    })();
    // plant wall panel on the east wall
    (function () {
      var px = 4.05, pz = -2.4;
      scene.add(boxMesh(matPanel, px, 1.7, pz, 0.1, 1.3, 1.5, 1.4));
      for (var pl = 0; pl < 6; pl++) {
        scene.add(blobMesh(ps1Material(PS1.solidTexture(46 + (pl % 3) * 12, 104 + (pl % 2) * 18, 58)),
          px - 0.12, 1.32 + Math.floor(pl / 3) * 0.42, pz - 0.5 + (pl % 3) * 0.5, 0.17, 0.9, 0.3,
          function (sd) { return sd > 0.5 ? [0.85, 1.1, 0.85] : [0.7, 1.0, 0.72]; }));
      }
    })();
    // spacesuit alcove on the west wall
    (function () {
      var ax = -4.0, az = -2.8;
      scene.add(boxMesh(matPanel, ax + 0.15, 1.5, az, 0.5, 3.0, 1.6, 1.2));
      var matSuit = ps1Material(PS1.solidTexture(228, 230, 234));
      scene.add(boxMesh(matSuit, ax + 0.18, 0.5, az, 0.34, 1.0, 0.42, 1.4));
      scene.add(boxMesh(matSuit, ax + 0.18, 1.32, az, 0.46, 0.72, 0.54, 1.4));
      scene.add(boxMesh(matSuit, ax + 0.18, 1.3, az - 0.36, 0.12, 0.6, 0.12, 1.4, 0.25));
      scene.add(boxMesh(matSuit, ax + 0.18, 1.3, az + 0.36, 0.12, 0.6, 0.12, 1.4, -0.25));
      scene.add(prismMesh(matSuit, ax + 0.2, az, 0.17, 0.34, 8, 1.6, 0.6, null, 1.72));
      scene.add(boxMesh(ps1Material(PS1.solidTexture(212, 164, 54)), ax + 0.02, 1.84, az, 0.04, 0.16, 0.24, 2, 0, [0.9, 0.65, 0.2]));
      colliders.push({ x0: ax - 0.15, z0: az - 0.55, x1: ax + 0.45, z1: az + 0.55 });
    })();
    // O2 rack vent leak (tiny periodic steam wisps)
    var o2leak = PS1.makeParticles({
      mode: 'steam', count: 26, color: [0.5, 0.62, 0.72],
      size: 0.03, speed: 0.7, sway: 0.2,
      area: [3.1, 3.7, -3.7, -3.1, 1.6]
    });
    scene.add(o2leak);

    // floor cable gully with grate bars
    scene.add(boxMesh(ps1Material(PS1.solidTexture(30, 32, 38)), 0, 0.004, -0.6, 1.1, 0.02, 7.6, 1.2));
    for (var gb = 0; gb < 13; gb++) {
      scene.add(boxMesh(matStrip, 0, 0.016, -4.2 + gb * 0.6, 1.06, 0.02, 0.07, 1.4, 0, [0.32, 0.34, 0.4]));
    }

    // dust motes floating in the sun shaft
    var motes = PS1.makeParticles({
      mode: 'dust', count: 110, color: [1.0, 0.97, 0.9],
      size: 0.016, speed: 1, sway: 0.3,
      area: [-1.2, 2.4, -4.4, -2.6, 2.8]
    });
    scene.add(motes);

    return {
      name: '太空舷窗',
      scene: scene,
      colliders: colliders,
      bounds: { x0: -3.8, x1: 3.8, z0: -5.0, z1: 4.2 },
      spawn: [0.4, 2.6, Math.atan2(-(-0.6 - 0.4), -(-8.0 - 2.6)), 0.06],
      idle: { pos: [0.4, 1.55, 2.6], target: [-0.6, 1.7, -8.0] },
      far: 130,
      fog: null,
      noFlicker: true,
      blobGroup: decals.blobGroup,
      particles: [motes, o2leak],
      update: function (t) {
        matBlinkR.uniforms.uFlicker.value = (t % 1.4) < 0.9 ? 1 : 0.12;
        matBlinkG.uniforms.uFlicker.value = (t % 2.3) < 0.5 ? 1 : 0.1;
        matBlinkA.uniforms.uFlicker.value = 0.5 + 0.5 * Math.sin(t * 3.1);
        gasGiantTex.offset.x = -t * 0.008;   // surface scrolls under the FIXED sun terminator
        moon.rotation.y = t * 0.02;   // small airless moon: mesh spin reads fine at this size
        sat.position.x = 14 - (t * 0.35) % 28;
        sat.rotation.y = t * 0.4;
        floatMug.rotation.x = t * 0.5; floatMug.rotation.z = t * 0.3;
        floatMug.position.y = 1.9 + 0.14 * Math.sin(t * 0.7);
        floatPen.rotation.z = t * 0.9;
        floatPen.position.y = 2.2 + 0.1 * Math.sin(t * 0.55 + 1.2);
        vacuum.position.x = -3.2 + 2.9 * (0.5 + 0.5 * Math.sin(t * 0.13));
        vacuum.position.z = 0.5 + 1.6 * Math.sin(t * 0.21);
        vacuum.rotation.y = Math.atan2(Math.cos(t * 0.13) * 0.4, Math.cos(t * 0.21) * 0.5);
        matHolo.uniforms.uFlicker.value = 0.75 + 0.25 * Math.sin(t * 6.3) * Math.sin(t * 1.7) + 0.08 * Math.sin(t * 40.0);
        holoGlobe.rotation.y = t * 0.35;
        holoGlobe.children[3].position.set(Math.cos(t * 1.4) * 0.5, Math.sin(t * 1.4) * 0.15, Math.sin(t * 1.4) * 0.5);
        radarNeedle.rotation.z = -t * 1.9;
        beaconBar.rotation.y = t * 2.6;
        debris[0].rotation.x = t * 0.5; debris[0].rotation.y = t * 0.3;
        debris[1].rotation.x = -t * 0.4; debris[1].rotation.z = t * 0.45;
        debris[2].rotation.y = t * 0.55; debris[2].rotation.x = t * 0.2;
        marbleTex.offset.x = t * 0.006;
        var st = (t % 24) / 24;
        shuttle.position.set(20 - st * 44, 6 + Math.sin(st * 6.0) * 3, -44 + st * 10);
        shuttle.rotation.z = 0.12 * Math.sin(st * 6.0);
        shuttle.visible = st > 0.12 && st < 0.9;
      }
    };
  });
})();
