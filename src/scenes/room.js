(function () {
  'use strict';
  var texFrom = PS1.texFrom, pixelLoop = PS1.pixelLoop, newCanvas = PS1.newCanvas;
  var hash2 = PS1.hash2, vnoise = PS1.vnoise;
  var boxMesh = PS1.boxMesh, prismMesh = PS1.prismMesh, quadMesh = PS1.quadMesh;
  var wallSurface = PS1.wallSurface, groundGrid = PS1.groundGrid;
  var shade = PS1.shade, cs = PS1.cs, setRelight = PS1.setRelight;

  // ========================= procedural textures ======================
  function floorCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var a = x + y, b = x - y + 64;
      var ca = Math.floor(a / 16), cb = Math.floor(b / 16);
      var da = a - ca * 16, db = b - cb * 16;
      var base = ((ca + cb) & 1) ? [86, 84, 78] : [150, 148, 138];
      var tint = (hash2(((ca % 4) + 4) % 4, cb % 4) * 2 - 1) * 9;
      var r = base[0] + tint, g = base[1] + tint, b2 = base[2] + tint;
      var edge = Math.min(da, db);
      if (edge < 2) {
        var k = edge < 1 ? 1 : 0.5;
        r += (44 - r) * k; g += (42 - g) * k; b2 += (38 - b2) * k;
      }
      var sp = hash2(x, y);
      if (sp < 0.12) { var q = 0.80 + sp * 0.5; r *= q; g *= q; b2 *= q; }
      var st = vnoise(x / 16, y / 16, 4, 2);
      if (st > 0.60) { var n = (st - 0.60) * 1.9; r *= 1 - n; g *= 1 - n * 0.95; b2 *= 1 - n * 0.85; }
      return [r, g, b2];
    });
  }

  function wallCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 16);
      var x2 = x + (row & 1) * 16;
      var col = Math.floor(x2 / 32), cx = x2 - col * 32;
      var tint = (hash2(col % 2, row * 7 + 3) * 2 - 1) * 11;
      var r = 122 + tint, g = 118 + tint, b = 110 + tint;
      var ry = y - row * 16;
      if (ry < 1 || cx < 1) { r = 64 + tint * 0.4; g = 62 + tint * 0.4; b = 58 + tint * 0.4; }
      else if (ry === 1 || cx === 1) { r *= 0.8; g *= 0.8; b *= 0.8; }
      var ci = Math.floor(x / 4);
      var k = hash2(((ci % 16) + 16) % 16, 7);
      if (k < 0.30) {
        var xc = ci * 4 + 2 + Math.sin(y * 0.18 + ci * 2.3) * 1.4;
        var dx = x - xc; dx -= 64 * Math.round(dx / 64);
        var fall = Math.max(0, 1 - Math.abs(dx) / 2.2) * Math.pow(y / 64, 1.6) * 0.30 * (0.4 + k * 2);
        r *= 1 - fall; g *= 1 - fall; b *= 1 - fall * 0.9;
      }
      var sp = hash2(x + 91, y + 17);
      if (sp < 0.10) { r *= 0.86; g *= 0.86; b *= 0.86; }
      return [r, g, b];
    });
  }

  function woodCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 16), ry = y - row * 16;
      var tint = (hash2(row, 5) * 2 - 1) * 14;
      var r = 132 + tint, g = 96 + tint * 0.8, b = 56 + tint * 0.6;
      if (ry < 1) { r = 52; g = 38; b = 24; }
      else if (ry === 1) { r *= 0.75; g *= 0.75; b *= 0.75; }
      var grain = vnoise(x / 24, (y + row * 31) / 3.2, 8, 2);
      if (grain > 0.62) { var n = (grain - 0.62) * 1.6; r *= 1 - n * 0.5; g *= 1 - n * 0.55; b *= 1 - n * 0.55; }
      var nx = (x + 8 + row * 13) % 32, ny = ry;
      if ((nx === 4 || nx === 28) && (ny === 5 || ny === 10)) { r = 70; g = 68; b = 66; }
      var sp = hash2(x + 7, y + 3);
      if (sp < 0.08) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }

  function barrelCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var tint = (hash2(Math.floor(x / 8), 11) * 2 - 1) * 6;
      var r = 74 + tint, g = 86 + tint, b = 68 + tint;
      var band = (y === 6 || y === 7 || y === 30 || y === 31 || y === 54 || y === 55);
      var rib = (y === 8 || y === 32 || y === 56);
      if (band) { r = 48; g = 56; b = 46; }
      else if (rib) { r = 110; g = 120; b = 100; }
      var rust = vnoise(x / 12, y / 12, 6, 2);
      if (rust > 0.68) { var n = Math.min(1, (rust - 0.68) * 3.2); r = r + (122 - r) * n; g = g + (66 - g) * n; b = b + (34 - b) * n; }
      if ((y === 7 || y === 31) && x % 8 === 4) { r = 130; g = 134; b = 120; }
      var sp = hash2(x + 41, y + 13);
      if (sp < 0.10) { r *= 0.82; g *= 0.82; b *= 0.82; }
      return [r, g, b];
    });
  }

  function pipeCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var tint = (hash2(Math.floor(y / 32), 23) * 2 - 1) * 7;
      var r = 92 + tint, g = 90 + tint, b = 86 + tint;
      if (x === 0 || x === 32) { r = 50; g = 50; b = 48; }
      if (x === 1 || x === 33) { r *= 1.18; g *= 1.18; b *= 1.18; }
      if (x % 16 < 1 && y % 16 < 1) { r = 60; g = 60; b = 58; }
      var rust = vnoise(x / 14 + 3, y / 14, 5, 2);
      if (rust > 0.70) { var n = Math.min(1, (rust - 0.70) * 3); r = r + (118 - r) * n; g = g + (64 - g) * n; b = b + (32 - b) * n; }
      var sp = hash2(x + 5, y + 71);
      if (sp < 0.10) { r *= 0.84; g *= 0.84; b *= 0.84; }
      return [r, g, b];
    });
  }

  function grilleCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var frame = (x < 3 || x > 60 || y < 3 || y > 60);
      if (frame) { var t = (hash2(x, y) * 2 - 1) * 6; return [70 + t, 70 + t, 68 + t]; }
      var slat = y % 8;
      if (slat < 3) return [30, 30, 32];
      if (slat === 3) return [120, 118, 114];
      var t2 = (hash2(x, y) * 2 - 1) * 8;
      return [84 + t2, 82 + t2, 78 + t2];
    });
  }

  function windowCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var r = 16, g = 16, b = 20;
      function board(bx, by) {
        var t = (hash2(bx, by) * 2 - 1) * 12;
        return [126 + t, 92 + t * 0.8, 54 + t * 0.6];
      }
      function band(d, c0, w) {
        var v = d - c0; if (v < 0) v += 64;
        return v < w;
      }
      var on1 = band(x + Math.floor(y * 0.55), 10, 13), on2 = band(x - Math.floor(y * 0.62) + 40, 30, 12);
      var wood = on1 ? board(1, 3) : (on2 ? board(2, 7) : null);
      if (wood) {
        var grain = vnoise(x / 20, y / 4, 8, 2);
        var k = grain > 0.6 ? 0.82 : 1;
        r = wood[0] * k; g = wood[1] * k; b = wood[2] * k;
        if ((x + y * 2) % 23 < 2 && (x * 2 - y) % 19 < 2) { r = 60; g = 58; b = 56; }
      }
      var sp = hash2(x + 3, y + 97);
      if (sp < 0.06 && !wood) { r *= 1.8; g *= 1.8; b *= 1.8; }
      return [r, g, b];
    });
  }

  function bookCanvas() {
    return pixelLoop(newCanvas(64), function (x, y) {
      var row = Math.floor(y / 16), ry = y - row * 16;
      var frame = (ry < 3) || (x % 32 < 2 && ry > 40);
      if (row === 0 && ry < 2) return [40, 30, 20];
      if (frame) { var t = (hash2(x, row * 31) * 2 - 1) * 8; return [64 + t, 46 + t, 30 + t]; }
      var slot = Math.floor(x / 3);
      var k = hash2(slot, row * 7 + 3);
      var top = 4 + Math.floor(k * 4);
      if (ry < top) return [18, 16, 14];
      var palette = [
        [96, 40, 36], [52, 60, 88], [70, 82, 52], [104, 88, 48], [78, 52, 70], [58, 60, 62]
      ];
      var c = palette[Math.floor(k * 997) % palette.length];
      var sh = 0.75 + hash2(slot * 3 + 1, row) * 0.5;
      var r = c[0] * sh, g = c[1] * sh, b = c[2] * sh;
      if (hash2(slot, row * 13 + 9) < 0.22 && ry > 8 && ry < 11) { r *= 1.5; g *= 1.5; b *= 1.4; }
      if (x % 3 === 0 || x % 3 === 2 && hash2(slot + 5, row) < 0.5) { r *= 0.55; g *= 0.55; b *= 0.55; }
      if (k < 0.10) { r = 30; g = 28; b = 26; }
      return [r, g, b];
    });
  }

  var whiteTex = PS1.solidTexture(255, 255, 255);
  var floorTex = texFrom(floorCanvas());
  var wallTex = texFrom(wallCanvas());
  var woodTex = texFrom(woodCanvas());
  var barrelTex = texFrom(barrelCanvas());
  var pipeTex = texFrom(pipeCanvas());
  var grilleTex = texFrom(grilleCanvas());
  var windowTex = texFrom(windowCanvas());
  var bookTex = texFrom(bookCanvas());

  var ps1Material = PS1.ps1Material;
  var matFloor = ps1Material(floorTex);
  var matWall = ps1Material(wallTex);
  var matWood = ps1Material(woodTex);
  var matBarrel = ps1Material(barrelTex);
  var matPipe = ps1Material(pipeTex);
  var matGrille = ps1Material(grilleTex);
  var matWindow = ps1Material(windowTex);
  var matBook = ps1Material(bookTex);
  var matBulb = ps1Material(whiteTex);

  // ====================== light baking (vertex color) =================
  var LAMP = new THREE.Vector3(0, 2.42, 0);
  var roomRelight = function (x, y, z, nx, ny, nz) {
    var dx = LAMP.x - x, dy = LAMP.y - y, dz = LAMP.z - z;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var fall = Math.max(0.20, Math.min(1.0, 1.55 - 0.21 * d));
    var inv = d > 1e-4 ? 1 / d : 0;
    var ndl = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
    var b = fall * (0.55 + 0.55 * ndl) + 0.06;
    return shade(Math.max(0.16, Math.min(1.0, b)));
  };

  PS1.registerScene(function () {
    setRelight(roomRelight);
    // ============================ room assembly ==========================
    var roomScene = new THREE.Scene();
    var H = 3.2;
    roomScene.add(groundGrid(matFloor, 0, 0, 8, 8, 1, 1, 0, 1));
    roomScene.add(groundGrid(matWall, 0, 0, 8, 8, 1, 1, H, -1));
    roomScene.add(wallSurface(matWall, [-4, 0, -4], [4, 0, -4], [4, H, -4], [-4, H, -4], 4, 1.6, 0, 0, 1));    // N
    roomScene.add(wallSurface(matWall, [-4, 0, 4], [-4, 0, -4], [-4, H, -4], [-4, H, 4], 4, 1.6, 1, 0, 0));    // W
    roomScene.add(wallSurface(matWall, [4, 0, -4], [4, 0, 4], [4, H, 4], [4, H, -4], 4, 1.6, -1, 0, 0));       // E
    roomScene.add(wallSurface(matWall, [4, 0, 4], [-4, 0, 4], [-4, H, 4], [4, H, 4], 4, 1.6, 0, 0, -1));       // S

    // crates, NW corner (2 + 1 stack)
    roomScene.add(cs(boxMesh(matWood, -2.60, 0.45, -3.40, 0.90, 0.90, 0.90, 1.1)));
    roomScene.add(cs(boxMesh(matWood, -1.65, 0.40, -3.50, 0.80, 0.80, 0.80, 1.1)));
    roomScene.add(cs(boxMesh(matWood, -2.55, 1.25, -3.35, 0.70, 0.70, 0.70, 1.2, 0.35)));
    // oil drum, W wall
    roomScene.add(cs(prismMesh(matBarrel, -3.35, -0.60, 0.38, 1.05, 8, 1.6, 1.0, 0.30)));
    // pipes along W + N wall tops
    roomScene.add(cs(boxMesh(matPipe, -3.74, 2.82, 0, 0.16, 0.16, 7.8, 1.3)));
    roomScene.add(cs(boxMesh(matPipe, 0, 2.82, -3.74, 7.8, 0.16, 0.16, 1.3)));
    roomScene.add(cs(boxMesh(matPipe, -3.74, 2.82, -3.74, 0.22, 0.22, 0.22, 1.3)));   // corner elbow
    // vent grille on W wall under pipe end
    roomScene.add(quadMesh(matGrille, -3.93, 2.15, -1.5, 1, 0, 0, 0.6, 0.6, 1, 1));
    // boarded window on N wall (x 0.5..1.9, y 1.55..2.65)
    roomScene.add(quadMesh(matWindow, 1.2, 2.10, -3.93, 0, 0, 1, 1.4, 1.1, 1, 1));
    roomScene.add(cs(boxMesh(matWood, 1.20, 2.28, -3.86, 1.55, 0.16, 0.07, 1.4, 0.14)));
    roomScene.add(cs(boxMesh(matWood, 1.20, 1.92, -3.86, 1.55, 0.16, 0.07, 1.4, -0.11)));
    roomScene.add(cs(boxMesh(matWood, 0.85, 2.10, -3.86, 0.14, 1.05, 0.07, 1.4, 0.05)));
    // hanging lamp at ceiling center: rod + shade cone + bulb disc
    roomScene.add(cs(boxMesh(matPipe, 0, 3.02, 0, 0.06, 0.36, 0.06, 2.0)));
    (function () {
      var seg = 8, pos = [], uvs = [], cols = [], idx = [];
      var apex = [0, 2.78, 0];
      for (var i = 0; i <= seg; i++) {
        var a = i / seg * Math.PI * 2;
        var x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.5, y = 2.42;
        pos.push(x, y, z);
        uvs.push(i / seg * 2, 0);
        cols = cols.concat(PS1.relight(x, y, z, Math.cos(a), 0.4, Math.sin(a)));
      }
      pos.push(apex[0], apex[1], apex[2]); uvs.push(1, 1);
      cols = cols.concat(PS1.relight(apex[0], apex[1], apex[2], 0, 1, 0));
      var ai = pos.length / 3 - 1;
      for (i = 0; i < seg; i++) idx.push(i, ai, i + 1);
      roomScene.add(cs(new THREE.Mesh(PS1.geo(pos, uvs, cols, idx), matPipe)));
    })();
    (function () {
      var seg = 8, pos = [], uvs = [], cols = [], idx = [];
      pos.push(0, 2.40, 0); uvs.push(0.5, 0.5); cols.push(1.8, 1.55, 1.05);
      for (var i = 0; i <= seg; i++) {
        var a = i / seg * Math.PI * 2;
        pos.push(Math.cos(a) * 0.13, 2.36, Math.sin(a) * 0.13);
        uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
        cols.push(1.8, 1.55, 1.05);
      }
      for (i = 0; i < seg; i++) idx.push(0, i + 1, i + 2);
      roomScene.add(new THREE.Mesh(PS1.geo(pos, uvs, cols, idx), matBulb));
    })();

    // ====================== real-time point shadow ======================
    var lamp = new THREE.PointLight(0xffffff, 1);
    lamp.position.copy(LAMP);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(256, 256);
    lamp.shadow.camera.near = 0.15;
    lamp.shadow.camera.far = 7;
    lamp.shadow.bias = -0.004;
    lamp.shadow.normalBias = 0.02;
    roomScene.add(lamp);

    // ===================== decals (contact shadows + grime) =============
    var decals = PS1.newDecalSet();
    var blobRect = decals.rect, blobOct = decals.oct, blobPath = decals.path, blobWall = decals.wall;
    blobRect(-2.56, -3.40, 1.07, 1.07, PS1.blobMat, 0.012);   // crate1 + rotated top crate
    blobRect(-1.65, -3.50, 0.92, 0.92, PS1.blobMat, 0.012);   // crate2
    blobOct(-3.35, -0.60, 0.44, PS1.blobMat, 0.012);          // drum
    roomScene.add(decals.blobGroup);

    // ========================= table + items ============================
    var wireCol = [0.13, 0.13, 0.14];
    roomScene.add(cs(boxMesh(matWood, 0.8, 0.75, 1.0, 1.20, 0.06, 0.70, 1.2)));
    [[0.28, 0.73], [1.32, 0.73], [0.28, 1.27], [1.32, 1.27]].forEach(function (p) {
      roomScene.add(cs(boxMesh(matWood, p[0], 0.36, p[1], 0.08, 0.72, 0.08, 2.0)));
    });
    roomScene.add(cs(boxMesh(matPipe, 0.45, 0.89, 1.12, 0.10, 0.22, 0.10, 2, 0, [0.28, 0.40, 0.28])));
    roomScene.add(cs(boxMesh(matPipe, 0.45, 1.025, 1.12, 0.04, 0.05, 0.04, 2, 0, [0.28, 0.40, 0.28])));
    roomScene.add(cs(boxMesh(matPipe, 1.02, 0.795, 0.85, 0.12, 0.03, 0.12, 2, 0, [0.24, 0.21, 0.17])));
    roomScene.add(cs(boxMesh(matPipe, 1.02, 0.865, 0.85, 0.06, 0.11, 0.06, 2, 0, [0.60, 0.58, 0.50])));
    roomScene.add(cs(boxMesh(matPipe, 0.72, 0.795, 1.15, 0.26, 0.02, 0.19, 2, 0, [0.20, 0.09, 0.07])));
    roomScene.add(cs(boxMesh(matPipe, 0.72, 0.812, 1.15, 0.23, 0.015, 0.165, 2, 0, [0.55, 0.53, 0.47])));
    blobRect(0.8, 1.0, 1.34, 0.84, PS1.blobMat, 0.012);       // table contact shadow

    // ========================== bookshelf ===============================
    roomScene.add(cs(boxMesh(matWood, 2.9, 0.975, -3.77, 1.0, 1.95, 0.45, 0.8)));
    roomScene.add(quadMesh(matBook, 2.9, 0.975, -3.50, 0, 0, 1, 0.92, 1.86, 1 / 0.92, 1 / 1.86));   // 4.5cm off the shelf front: > 1 depth bucket
    blobRect(2.9, -3.77, 1.10, 0.51, PS1.blobMat, 0.012);     // shelf contact shadow

    // ================= wiring + swaying burnt bulb ======================
    roomScene.add(cs(boxMesh(matPipe, 0, 3.02, -3.70, 7.60, 0.04, 0.04, 2, 0, wireCol)));
    roomScene.add(cs(boxMesh(matPipe, 3.70, 3.02, -1.35, 0.04, 0.04, 4.75, 2, 0, wireCol)));
    roomScene.add(cs(boxMesh(matPipe, 2.27, 3.05, 1.0, 2.90, 0.04, 0.04, 2, 0, wireCol)));
    var swing = new THREE.Group();
    swing.position.set(0.8, 3.05, 1.0);   // pivot at ceiling above the table
    swing.add(cs(boxMesh(matPipe, 0, -0.36, 0, 0.035, 0.72, 0.035, 2, 0, wireCol)));
    swing.add(cs(boxMesh(matPipe, 0, -0.76, 0, 0.09, 0.10, 0.09, 2, 0, [0.20, 0.19, 0.18])));
    swing.add(cs(boxMesh(matPipe, 0, -0.88, 0, 0.12, 0.15, 0.12, 2, 0, [0.15, 0.14, 0.13])));
    roomScene.add(swing);

    // ========================= grime decals ==============================
    var decalMaterial = PS1.decalMaterial;
    var matStain = decalMaterial(0.045, 0.04, 0.032, 0.5);
    var matDrag = decalMaterial(0.07, 0.025, 0.025, 0.55);
    var matBlood = decalMaterial(0.11, 0.02, 0.02, 0.62);
    var matMold = decalMaterial(0.04, 0.06, 0.045, 0.35);
    blobOct(-3.35, -0.60, 0.62, matStain, 0.006, 1);      // puddle under drum
    blobOct(1.62, 1.58, 0.34, matStain, 0.006, 2);        // puddle by the table
    blobPath([[1.2, -3.42], [0.95, -2.7], [0.55, -1.9], [0.25, -1.15]], 0.24, 0.30, matDrag, 0.007);
    blobOct(1.2, -3.5, 0.40, matBlood, 0.008, 3);         // blood spatter at window
    blobWall(-3.98, 0.62, 3.15, true, 1.0, 0.6, matMold);
    blobWall(-3.15, 0.62, 3.98, false, 1.0, 0.6, matMold);
    blobWall(3.98, 0.62, 3.15, true, 1.0, 0.6, matMold);
    blobWall(3.15, 0.62, 3.98, false, 1.0, 0.6, matMold);
    roomScene.add(decals.decalGroup);

    var lim = 4 - PS1.RADIUS - 0.05;
    return {
      name: '密封房间',
      scene: roomScene,
      colliders: [
        { x0: -3.05, z0: -3.85, x1: -2.15, z1: -2.95 },   // crate1 + top crate
        { x0: -2.05, z0: -3.90, x1: -1.25, z1: -3.10 },   // crate2
        { x0: -3.73, z0: -0.98, x1: -2.97, z1: -0.22 },   // drum (AABB approx)
        { x0: 0.20, z0: 0.40, x1: 1.40, z1: 1.60 },       // table
        { x0: 2.40, z0: -3.95, x1: 3.40, z1: -3.45 }      // bookshelf
      ],
      bounds: { x0: -lim, x1: lim, z0: -lim, z1: lim },
      spawn: [2.1, 2.2, Math.atan2(-(-4 - 2.1), -(-2.4 - 2.2)), Math.asin((1.30 - PS1.EYE) / Math.hypot(-4 - 2.1, 1.30 - PS1.EYE, -2.4 - 2.2))],
      idle: { pos: [2.1, PS1.EYE, 2.2], target: [-4, 1.30, -2.4] },
      fog: null,
      noFlicker: false,
      blobGroup: decals.blobGroup,
      particles: [],
      update: function (t) {
        swing.rotation.z = 0.052 * Math.sin(t * Math.PI / 2);
        swing.rotation.x = 0.031 * Math.sin(t * Math.PI * 0.43 + 1.3);
      }
    };
  });
})();
