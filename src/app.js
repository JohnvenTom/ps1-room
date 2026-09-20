(function () {
  'use strict';

  // ============================== config ==============================
  var IW = 320, IH = 240;                     // PS1-era internal framebuffer
  var state = { affine: false, snap: true, nearest: true, crt: true, hud: true, flicker: true, shadow: true, fov: 55.4 };
  var LAMP = new THREE.Vector3(0, 2.42, 0);   // hanging bulb = the light source
  var EYE = 1.62, RADIUS = 0.35;

  // ========================= procedural textures ======================
  function hash2(x, y) {
    var n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  function vnoise(x, y, period, oct) {
    var total = 0, amp = 1, freq = 1, norm = 0;
    for (var o = 0; o < (oct || 1); o++) {
      var xi = Math.floor(x * freq), yi = Math.floor(y * freq);
      var fx = x * freq - xi, fy = y * freq - yi;
      var s = fx * fx * (3 - 2 * fx), t = fy * fy * (3 - 2 * fy);
      var p = period * freq;
      function h(a, b) { a = ((a % p) + p) % p; b = ((b % p) + p) % p; return hash2(a, b); }
      var v = (h(xi, yi) * (1 - s) + h(xi + 1, yi) * s) * (1 - t) +
              (h(xi, yi + 1) * (1 - s) + h(xi + 1, yi + 1) * s) * t;
      total += v * amp; norm += amp; amp *= 0.5; freq *= 2;
    }
    return total / norm;
  }

  function newCanvas() {
    var c = document.createElement('canvas'); c.width = c.height = 64; return c;
  }
  function pixelLoop(c, fn) {
    var g = c.getContext('2d'), img = g.createImageData(64, 64), d = img.data;
    for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) {
      var col = fn(x, y);
      var i = (y * 64 + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function floorCanvas() {
    return pixelLoop(newCanvas(), function (x, y) {
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
    return pixelLoop(newCanvas(), function (x, y) {
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
    return pixelLoop(newCanvas(), function (x, y) {
      var row = Math.floor(y / 16), ry = y - row * 16;
      var tint = (hash2(row, 5) * 2 - 1) * 14;
      var r = 132 + tint, g = 96 + tint * 0.8, b = 56 + tint * 0.6;
      if (ry < 1) { r = 52; g = 38; b = 24; }                       // plank seams
      else if (ry === 1) { r *= 0.75; g *= 0.75; b *= 0.75; }
      var grain = vnoise(x / 24, (y + row * 31) / 3.2, 8, 2);        // long grain streaks
      if (grain > 0.62) { var n = (grain - 0.62) * 1.6; r *= 1 - n * 0.5; g *= 1 - n * 0.55; b *= 1 - n * 0.55; }
      var nx = (x + 8 + row * 13) % 32, ny = ry;                     // nail heads at plank ends
      if ((nx === 4 || nx === 28) && (ny === 5 || ny === 10)) { r = 70; g = 68; b = 66; }
      var sp = hash2(x + 7, y + 3);
      if (sp < 0.08) { r *= 0.8; g *= 0.8; b *= 0.8; }
      return [r, g, b];
    });
  }

  function barrelCanvas() {
    return pixelLoop(newCanvas(), function (x, y) {
      var tint = (hash2(Math.floor(x / 8), 11) * 2 - 1) * 6;
      var r = 74 + tint, g = 86 + tint, b = 68 + tint;              // army-green paint
      var band = (y === 6 || y === 7 || y === 30 || y === 31 || y === 54 || y === 55);
      var rib = (y === 8 || y === 32 || y === 56);
      if (band) { r = 48; g = 56; b = 46; }                          // hoop bands
      else if (rib) { r = 110; g = 120; b = 100; }                   // hoop highlight edge
      var rust = vnoise(x / 12, y / 12, 6, 2);                       // paint chips -> rust
      if (rust > 0.68) { var n = Math.min(1, (rust - 0.68) * 3.2); r = r + (122 - r) * n; g = g + (66 - g) * n; b = b + (34 - b) * n; }
      if ((y === 7 || y === 31) && x % 8 === 4) { r = 130; g = 134; b = 120; } // rivets
      var sp = hash2(x + 41, y + 13);
      if (sp < 0.10) { r *= 0.82; g *= 0.82; b *= 0.82; }
      return [r, g, b];
    });
  }

  function pipeCanvas() {
    return pixelLoop(newCanvas(), function (x, y) {
      var tint = (hash2(Math.floor(y / 32), 23) * 2 - 1) * 7;
      var r = 92 + tint, g = 90 + tint, b = 86 + tint;              // dull grey metal
      if (x === 0 || x === 32) { r = 50; g = 50; b = 48; }          // seam lines
      if (x === 1 || x === 33) { r *= 1.18; g *= 1.18; b *= 1.18; } // seam weld highlight
      if (x % 16 < 1 && y % 16 < 1) { r = 60; g = 60; b = 58; }     // flange bolts
      var rust = vnoise(x / 14 + 3, y / 14, 5, 2);
      if (rust > 0.70) { var n = Math.min(1, (rust - 0.70) * 3); r = r + (118 - r) * n; g = g + (64 - g) * n; b = b + (32 - b) * n; }
      var sp = hash2(x + 5, y + 71);
      if (sp < 0.10) { r *= 0.84; g *= 0.84; b *= 0.84; }
      return [r, g, b];
    });
  }

  function grilleCanvas() {
    return pixelLoop(newCanvas(), function (x, y) {
      var frame = (x < 3 || x > 60 || y < 3 || y > 60);
      if (frame) { var t = (hash2(x, y) * 2 - 1) * 6; return [70 + t, 70 + t, 68 + t]; }
      var slat = y % 8;
      if (slat < 3) return [30, 30, 32];                             // open gap, near black
      if (slat === 3) return [120, 118, 114];                        // slat highlight lip
      var t2 = (hash2(x, y) * 2 - 1) * 8;
      return [84 + t2, 82 + t2, 78 + t2];                            // slat face
    });
  }

  function windowCanvas() {
    return pixelLoop(newCanvas(), function (x, y) {
      var r = 16, g = 16, b = 20;                                    // dark "night" glass
      function board(bx, by) {
        var t = (hash2(bx, by) * 2 - 1) * 12;
        return [126 + t, 92 + t * 0.8, 54 + t * 0.6];
      }
      var d1 = (x + y * 0.55) % 64, d2 = (x - y * 0.62 + 40) % 64;   // two crossed boards
      function band(d, c0, c1, w) {
        var v = d - c0; if (v < 0) v += 64;
        return v < w;
      }
      var on1 = band(x + Math.floor(y * 0.55), 10, 0, 13), on2 = band(x - Math.floor(y * 0.62) + 40, 30, 0, 12);
      var wood = on1 ? board(1, 3) : (on2 ? board(2, 7) : null);
      if (wood) {
        var grain = vnoise(x / 20, y / 4, 8, 2);
        var k = grain > 0.6 ? 0.82 : 1;
        r = wood[0] * k; g = wood[1] * k; b = wood[2] * k;
        if ((x + y * 2) % 23 < 2 && (x * 2 - y) % 19 < 2) { r = 60; g = 58; b = 56; } // nails
      }
      var sp = hash2(x + 3, y + 97);
      if (sp < 0.06 && !wood) { r *= 1.8; g *= 1.8; b *= 1.8; }      // glass glint pixels
      return [r, g, b];
    });
  }

  function bookCanvas() {
    return pixelLoop(newCanvas(), function (x, y) {
      // 4 shelf rows; frame = dark wood; each row = vertical book spines
      var row = Math.floor(y / 16), ry = y - row * 16;
      var frame = (ry < 3) || (x % 32 < 2 && ry > 40);                // shelf board under each row
      if (row === 0 && ry < 2) return [40, 30, 20];
      if (frame) { var t = (hash2(x, row * 31) * 2 - 1) * 8; return [64 + t, 46 + t, 30 + t]; }
      var slot = Math.floor(x / 3);
      var k = hash2(slot, row * 7 + 3);
      var top = 4 + Math.floor(k * 4);                                 // varied spine tops
      if (ry < top) return [18, 16, 14];                                // gap above books -> shadow
      var palette = [
        [96, 40, 36], [52, 60, 88], [70, 82, 52], [104, 88, 48], [78, 52, 70], [58, 60, 62]
      ];
      var c = palette[Math.floor(k * 997) % palette.length];
      var sh = 0.75 + hash2(slot * 3 + 1, row) * 0.5;                  // per-book brightness
      var r = c[0] * sh, g = c[1] * sh, b = c[2] * sh;
      if (hash2(slot, row * 13 + 9) < 0.22 && ry > 8 && ry < 11) { r *= 1.5; g *= 1.5; b *= 1.4; } // title band
      if (x % 3 === 0 || x % 3 === 2 && hash2(slot + 5, row) < 0.5) { r *= 0.55; g *= 0.55; b *= 0.55; } // spine seams
      if (k < 0.10) { r = 30; g = 28; b = 26; }                        // occasional empty slot
      return [r, g, b];
    });
  }

  function texFrom(canvas) {
    var t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = false;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }
  function whiteTexture() {
    var t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }

  function bayerTexture() {
    var M = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    var data = new Uint8Array(16 * 4);
    for (var i = 0; i < 16; i++) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(M[i] / 15 * 255);
      data[i * 4 + 3] = 255;
    }
    var t = new THREE.DataTexture(data, 4, 4, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }

  var floorTex = texFrom(floorCanvas());
  var wallTex = texFrom(wallCanvas());
  var woodTex = texFrom(woodCanvas());
  var barrelTex = texFrom(barrelCanvas());
  var pipeTex = texFrom(pipeCanvas());
  var grilleTex = texFrom(grilleCanvas());
  var windowTex = texFrom(windowCanvas());
  var bookTex = texFrom(bookCanvas());
  var whiteTex = whiteTexture();
  var allTex = [floorTex, wallTex, woodTex, barrelTex, pipeTex, grilleTex, windowTex, bookTex, whiteTex];
  var bayerTex = bayerTexture();

  // ============================ PS1 shaders ===========================
  var ROOM_VS = [
    '#include <common>',
    '#include <shadowmap_pars_vertex>',
    'uniform float uSnap;',
    'uniform vec2 uRes;',
    'attribute vec3 color;',
    'varying vec3 vAff;',        // (uv * w, w): ratio interpolates AFFINELY
    'varying vec2 vUvP;',
    'varying vec3 vCol;',
    'void main() {',
    '  vUvP = uv;',
    '  vCol = color;',
    '  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '  if (uSnap > 0.5) {',
    '    vec2 hs = uRes * 0.5;',
    '    vec2 px = clip.xy / clip.w * hs + hs;',
    '    px = floor(px) + 0.5;',
    '    clip.xy = (px / hs - 1.0) * clip.w;',
    // linear view-depth buckets (3 cm): perspective z/w is so non-linear that
    // 256 global buckets = >1 m at wall distance -> props punched through by walls
    '    float wq = floor(clip.w * 32.0) / 32.0;',
    '    clip.z = -projectionMatrix[2][2] * wq + projectionMatrix[3][2];',
    '  }',
    '  vAff = vec3(uv * clip.w, clip.w);',
    '  gl_Position = clip;',
    '  vec3 transformedNormal = normalize(vec3(modelMatrix * vec4(normal, 0.0)));',
    '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);',   // supports swinging props (non-identity matrix)
    '  #include <shadowmap_vertex>',
    '}'
  ].join('\n');

  var ROOM_FS = [
    '#include <common>',
    '#include <packing>',
    '#include <lights_pars_begin>',
    '#include <shadowmap_pars_fragment>',
    'uniform sampler2D uMap;',
    'uniform sampler2D uBayer;',
    'uniform float uAffine;',
    'uniform float uFlicker;',
    'uniform float uShadow;',
    'varying vec3 vAff;',
    'varying vec2 vUvP;',
    'varying vec3 vCol;',
    // hard point shadow with Bayer-dithered penumbra (depth window ~6cm world)
    'float psPointShadow( sampler2D smap, vec2 mapSize, float bias, vec4 sc, float cnear, float cfar, float bayer ) {',
    '  vec3 l2p = sc.xyz;',
    '  float bd3 = length( l2p );',
    '  vec3 bd3D = l2p / bd3;',
    '  float dp = ( bd3 - cnear ) / ( cfar - cnear ) + bias;',
    '  vec2 texelSize = vec2( 1.0 ) / ( mapSize * vec2( 4.0, 2.0 ) );',
    '  float stored = unpackRGBAToDepth( texture2D( smap, cubeToUV( bd3D, texelSize.y ) ) );',
    '  float soft = clamp( ( stored - dp ) / 0.006, 0.0, 1.0 );',
    '  return soft > bayer ? 1.0 : 0.0;',
    '}',
    'void main() {',
    '  vec2 u = uAffine > 0.5 ? vAff.xy / vAff.z : vUvP;',
    '  float b = texture2D(uBayer, (floor(mod(gl_FragCoord.xy, 4.0)) + 0.5) / 4.0).r;',
    '  float vis = 1.0;',
    '  #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0',
    '  if (uShadow > 0.5) {',
    '    PointLightShadow ps = pointLightShadows[ 0 ];',
    '    vis = psPointShadow( pointShadowMap[ 0 ], ps.shadowMapSize, ps.shadowBias, vPointShadowCoord[ 0 ], ps.shadowCameraNear, ps.shadowCameraFar, b );',
    '  }',
    '  #endif',
    '  vec3 c = texture2D(uMap, u).rgb * vCol * uFlicker;',
    '  float dark = 0.35 + ( 1.0 - min( uFlicker, 1.0 ) ) * 0.55;',   // lamp dip -> shallower shadow
    '  c *= mix( dark, 1.0, vis );',
    '  c = clamp(c + (b - 0.5) * (1.5 / 32.0), 0.0, 1.0);',
    '  c = floor(c * 31.0 + 0.5) / 31.0;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  var shared = {
    uAffine: { value: 1 },
    uSnap: { value: 1 },
    uFlicker: { value: 1 },
    uShadow: { value: 1 },
    uRes: { value: new THREE.Vector2(IW, IH) },
    uBayer: { value: bayerTex }
  };

  function ps1Material(map) {
    var u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      uMap: { value: null },
      uBayer: { value: null },
      uAffine: { value: 1 },
      uSnap: { value: 1 },
      uFlicker: { value: 1 },
      uShadow: { value: 1 },
      uRes: { value: null }
    }]);
    u.uMap.value = map;
    u.uBayer = shared.uBayer;
    u.uAffine = shared.uAffine;
    u.uSnap = shared.uSnap;
    u.uFlicker = shared.uFlicker;
    u.uShadow = shared.uShadow;
    u.uRes = shared.uRes;
    return new THREE.ShaderMaterial({
      uniforms: u,
      lights: true,
      vertexShader: ROOM_VS,
      fragmentShader: ROOM_FS,
      side: THREE.DoubleSide
    });
  }

  var matFloor = ps1Material(floorTex);
  var matWall = ps1Material(wallTex);
  var matWood = ps1Material(woodTex);
  var matBarrel = ps1Material(barrelTex);
  var matPipe = ps1Material(pipeTex);
  var matGrille = ps1Material(grilleTex);
  var matWindow = ps1Material(windowTex);
  var matBook = ps1Material(bookTex);
  var matBulb = ps1Material(whiteTex);
  var roomMats = [matFloor, matWall, matWood, matBarrel, matPipe, matGrille, matWindow, matBook, matBulb];

  // ====================== light baking (vertex color) =================
  function relight(x, y, z, nx, ny, nz) {
    var dx = LAMP.x - x, dy = LAMP.y - y, dz = LAMP.z - z;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var fall = Math.max(0.20, Math.min(1.0, 1.55 - 0.21 * d));
    var inv = d > 1e-4 ? 1 / d : 0;
    var ndl = Math.max(0, (dx * nx + dy * ny + dz * nz) * inv);
    var b = fall * (0.55 + 0.55 * ndl) + 0.06;
    return Math.max(0.16, Math.min(1.0, b));
  }

  // ========================== geometry helpers ========================
  function geo(pos, uvs, cols, idx) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();   // real normals so shadow normalBias works
    return g;
  }
  function shade(c) { return [c, c, c]; }

  function fanSurface(y, uvScale, material, normalY) {
    var h = 4;
    var pos = [-h, y, -h, h, y, -h, h, y, h, -h, y, h, 0, y, 0];
    var uv = [0, 0, uvScale, 0, uvScale, uvScale, 0, uvScale, uvScale / 2, uvScale / 2];
    var cols = [];
    [[-h, y, -h], [h, y, -h], [h, y, h], [-h, y, h], [0, y, 0]].forEach(function (p) {
      cols = cols.concat(shade(relight(p[0], p[1], p[2], 0, normalY, 0)));
    });
    return new THREE.Mesh(geo(pos, uv, cols, [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]), material);
  }

  function wallSurface(p0, p1, p2, p3, uvScaleU, uvScaleV, nx, ny, nz) {
    var pos = [].concat(p0, p1, p2, p3);
    var uv = [0, 0, uvScaleU, 0, uvScaleU, uvScaleV, 0, uvScaleV];
    var cols = [];
    [p0, p1, p2, p3].forEach(function (p) {
      cols = cols.concat(shade(relight(p[0], p[1], p[2], nx, ny, nz)));
    });
    return new THREE.Mesh(geo(pos, uv, cols, [0, 1, 2, 0, 2, 3]), matWall);
  }

  // axis-aligned-ish box with optional Z rotation, per-vertex relit
  function boxMesh(material, cx, cy, cz, sx, sy, sz, uvScale, rotZ, emissive) {
    var hx = sx / 2, hy = sy / 2, hz = sz / 2;
    var faces = [
      { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
      { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
      { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
      { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
      { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] }
    ];
    var pos = [], uvs = [], cols = [], idx = [], cr = Math.cos(rotZ || 0), sr = Math.sin(rotZ || 0);
    faces.forEach(function (f) {
      var base = pos.length / 3;
      f.v.forEach(function (p) {
        var lx = p[0], ly = p[1], lz = p[2];
        var wx = cx + lx * cr - ly * sr, wy = cy + lx * sr + ly * cr, wz = cz + lz;
        var nx = f.n[0] * cr - f.n[1] * sr, ny = f.n[0] * sr + f.n[1] * cr, nz = f.n[2];
        pos.push(wx, wy, wz);
        var uu = (Math.abs(f.n[2]) > 0.5) ? lx : (Math.abs(f.n[0]) > 0.5 ? lz : lx);
        var vv = (Math.abs(f.n[1]) > 0.5) ? lz : ly;
        uvs.push(uu * uvScale, vv * uvScale);
        var b = emissive ? emissive : shade(relight(wx, wy, wz, nx, ny, nz));
        cols.push(Array.isArray(b) ? b[0] : b, Array.isArray(b) ? b[1] : b, Array.isArray(b) ? b[2] : b);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    return new THREE.Mesh(geo(pos, uvs, cols, idx), material);
  }

  function prismMesh(material, cx, cz, r, h, sides, uvU, uvV, emissiveTop) {
    var pos = [], uvs = [], cols = [], idx = [];
    for (var i = 0; i < sides; i++) {
      var a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      var am = (a0 + a1) / 2;
      var nx = Math.cos(am), nz = Math.sin(am);
      var p = [
        [cx + Math.cos(a0) * r, 0, cz + Math.sin(a0) * r],
        [cx + Math.cos(a1) * r, 0, cz + Math.sin(a1) * r],
        [cx + Math.cos(a1) * r, h, cz + Math.sin(a1) * r],
        [cx + Math.cos(a0) * r, h, cz + Math.sin(a0) * r]
      ];
      var base = pos.length / 3;
      p.forEach(function (v, k) {
        pos.push(v[0], v[1], v[2]);
        uvs.push((k === 1 || k === 2 ? uvU : 0), (k >= 2 ? uvV : 0));
        var b = relight(v[0], v[1], v[2], nx, 0, nz);
        cols.push(b, b, b);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      // top cap fan
      pos.push(cx, h, cz);
      uvs.push(0.5, 0.5);
      cols.push(emissiveTop, emissiveTop, emissiveTop);
      var ci = pos.length / 3 - 1;
      idx.push(base, ci, base + 1);
    }
    return new THREE.Mesh(geo(pos, uvs, cols, idx), material);
  }

  function quadMesh(material, cx, cy, cz, nx, ny, nz, w, h, uvW, uvH) {
    // wall-plane quad; tangent u/v derived from normal
    var ux, uy, uz, vx, vy, vz;
    if (Math.abs(nx) > 0.5) { ux = 0; uy = 0; uz = 1; vx = 0; vy = 1; vz = 0; }
    else { ux = 1; uy = 0; uz = 0; vx = 0; vy = 1; vz = 0; }
    var hw = w / 2, hh = h / 2;
    var corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    var pos = [], uvs = [], cols = [];
    corners.forEach(function (p) {
      var x = cx + ux * p[0] + vx * p[1], y = cy + uy * p[0] + vy * p[1], z = cz + uz * p[0] + vz * p[1];
      pos.push(x, y, z);
      uvs.push((p[0] + hw) * uvW, (p[1] + hh) * uvH);
      var b = relight(x, y, z, nx, ny, nz);
      cols.push(b, b, b);
    });
    return new THREE.Mesh(geo(pos, uvs, cols, [0, 1, 2, 0, 2, 3]), material);
  }

  // ============================ room assembly ==========================
  function cs(m) { m.castShadow = true; return m; }   // shadow caster
  var roomScene = new THREE.Scene();
  roomScene.add(fanSurface(0, 4, matFloor, 1));
  roomScene.add(fanSurface(3.2, 4, matWall, -1));
  var H = 3.2;
  roomScene.add(wallSurface([-4, 0, -4], [4, 0, -4], [4, H, -4], [-4, H, -4], 4, 1.6, 0, 0, 1));    // N
  roomScene.add(wallSurface([-4, 0, 4], [-4, 0, -4], [-4, H, -4], [-4, H, 4], 4, 1.6, 1, 0, 0));    // W
  roomScene.add(wallSurface([4, 0, -4], [4, 0, 4], [4, H, 4], [4, H, -4], 4, 1.6, -1, 0, 0));       // E
  roomScene.add(wallSurface([4, 0, 4], [-4, 0, 4], [-4, H, 4], [4, H, 4], 4, 1.6, 0, 0, -1));       // S

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
      var b = relight(x, y, z, Math.cos(a), 0.4, Math.sin(a));
      cols.push(b, b, b);
    }
    pos.push(apex[0], apex[1], apex[2]); uvs.push(1, 1);
    var bc = relight(apex[0], apex[1], apex[2], 0, 1, 0);
    cols.push(bc, bc, bc);
    var ai = pos.length / 3 - 1;
    for (i = 0; i < seg; i++) idx.push(i, ai, i + 1);
    roomScene.add(cs(new THREE.Mesh(geo(pos, uvs, cols, idx), matPipe)));
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
    roomScene.add(new THREE.Mesh(geo(pos, uvs, cols, idx), matBulb));
  })();

  // ===================== real-time point shadow ======================
  // The custom PS1 shader ignores lighting equations; this light exists only
  // to drive the shadow cube map. Intensity is visually irrelevant.
  var lamp = new THREE.PointLight(0xffffff, 1);
  lamp.position.copy(LAMP);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(256, 256);
  lamp.shadow.camera.near = 0.15;
  lamp.shadow.camera.far = 7;
  lamp.shadow.bias = -0.004;
  lamp.shadow.normalBias = 0.02;
  roomScene.add(lamp);

  // ============ Bayer-dithered flat decals (contact shadows + grime) ===
  function decalMaterial(r, g, b, density) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSnap: shared.uSnap, uRes: shared.uRes, uBayer: shared.uBayer,
        uCol: { value: new THREE.Vector3(r, g, b) },
        uDens: { value: density }
      },
      vertexShader: [
        'uniform float uSnap;',
        'uniform vec2 uRes;',
        'void main() {',
        '  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '  if (uSnap > 0.5) {',
        '    vec2 hs = uRes * 0.5;',
        '    vec2 px = clip.xy / clip.w * hs + hs;',
        '    px = floor(px) + 0.5;',
        '    clip.xy = (px / hs - 1.0) * clip.w;',
        '    float wq = floor(clip.w * 32.0) / 32.0;',
        '    clip.z = -projectionMatrix[2][2] * wq + projectionMatrix[3][2];',
        '  }',
        '  gl_Position = clip;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uBayer;',
        'uniform vec3 uCol;',
        'uniform float uDens;',
        'void main() {',
        '  float b = texture2D(uBayer, (floor(mod(gl_FragCoord.xy, 4.0)) + 0.5) / 4.0).r;',
        '  if (b >= uDens) discard;',
        '  gl_FragColor = vec4(uCol, 1.0);',
        '}'
      ].join('\n'),
      depthWrite: false
    });
  }
  var blobMat = decalMaterial(0, 0, 0, 0.35);   // contact shadows, toggled with key 7
  var blobGroup = new THREE.Group();
  var decalGroup = new THREE.Group();           // grime decals, always on

  function blobRect(cx, cz, sx, sz, mat, y, rotY) {
    var hx = sx / 2, hz = sz / 2;
    var cr = Math.cos(rotY || 0), sr = Math.sin(rotY || 0);
    var pos = [];
    [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(function (p) {
      pos.push(cx + p[0] * cr - p[1] * sr, y, cz + p[0] * sr + p[1] * cr);
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    (mat === blobMat ? blobGroup : decalGroup).add(new THREE.Mesh(g, mat));
  }
  function blobOct(cx, cz, r, mat, y, seed) {
    var pos = [cx, y, cz], idx = [];
    for (var i = 0; i <= 8; i++) {
      var a = i / 8 * Math.PI * 2 + Math.PI / 8;
      var rr = seed ? r * (0.72 + hash2(seed * 31 + i, seed * 7 + 3) * 0.56) : r;
      pos.push(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr);
      idx.push(0, i + 2, i + 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    (mat === blobMat ? blobGroup : decalGroup).add(new THREE.Mesh(g, mat));
  }
  function blobPath(pts, w0, w1, mat, y) {
    var pos = [], idx = [];
    for (var i = 0; i < pts.length; i++) {
      var t = i / (pts.length - 1), w = (w0 + (w1 - w0) * t) / 2;
      var prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      var dx = next[0] - prev[0], dz = next[1] - prev[1];
      var len = Math.hypot(dx, dz) || 1;
      var px = -dz / len * w, pz = dx / len * w;
      pos.push(pts[i][0] + px, y, pts[i][1] + pz);
      pos.push(pts[i][0] - px, y, pts[i][1] - pz);
      if (i > 0) {
        var b = (i - 1) * 2;
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    (mat === blobMat ? blobGroup : decalGroup).add(new THREE.Mesh(g, mat));
  }
  function blobWall(cx, cy, cz, alongZ, w, h, mat) {
    var pos = [], hw = w / 2;
    if (alongZ) {
      pos.push(cx, cy - h, cz - hw, cx, cy - h, cz + hw, cx, cy, cz + hw, cx, cy, cz - hw);
    } else {
      pos.push(cx - hw, cy - h, cz, cx + hw, cy - h, cz, cx + hw, cy, cz, cx - hw, cy, cz);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    (mat === blobMat ? blobGroup : decalGroup).add(new THREE.Mesh(g, mat));
  }

  // v4 contact shadows under v2 props
  blobRect(-2.56, -3.40, 1.07, 1.07, blobMat, 0.012);   // crate1 + rotated top crate
  blobRect(-1.65, -3.50, 0.92, 0.92, blobMat, 0.012);   // crate2
  blobOct(-3.35, -0.60, 0.44, blobMat, 0.012);          // drum
  roomScene.add(blobGroup);

  // ========================= v5: table + items =========================
  var wireCol = [0.13, 0.13, 0.14];
  roomScene.add(cs(boxMesh(matWood, 0.8, 0.75, 1.0, 1.20, 0.06, 0.70, 1.2)));
  [[0.28, 0.73], [1.32, 0.73], [0.28, 1.27], [1.32, 1.27]].forEach(function (p) {
    roomScene.add(cs(boxMesh(matWood, p[0], 0.36, p[1], 0.08, 0.72, 0.08, 2.0)));
  });
  // green bottle
  roomScene.add(cs(boxMesh(matPipe, 0.45, 0.89, 1.12, 0.10, 0.22, 0.10, 2, 0, [0.28, 0.40, 0.28])));
  roomScene.add(cs(boxMesh(matPipe, 0.45, 1.025, 1.12, 0.04, 0.05, 0.04, 2, 0, [0.28, 0.40, 0.28])));
  // candle + holder
  roomScene.add(cs(boxMesh(matPipe, 1.02, 0.795, 0.85, 0.12, 0.03, 0.12, 2, 0, [0.24, 0.21, 0.17])));
  roomScene.add(cs(boxMesh(matPipe, 1.02, 0.865, 0.85, 0.06, 0.11, 0.06, 2, 0, [0.60, 0.58, 0.50])));
  // open book (cover + pages)
  roomScene.add(cs(boxMesh(matPipe, 0.72, 0.795, 1.15, 0.26, 0.02, 0.19, 2, 0, [0.20, 0.09, 0.07])));
  roomScene.add(cs(boxMesh(matPipe, 0.72, 0.812, 1.15, 0.23, 0.015, 0.165, 2, 0, [0.55, 0.53, 0.47])));
  blobRect(0.8, 1.0, 1.34, 0.84, blobMat, 0.012);       // table contact shadow

  // ========================== v5: bookshelf ============================
  roomScene.add(cs(boxMesh(matWood, 2.9, 0.975, -3.77, 1.0, 1.95, 0.45, 0.8)));
  roomScene.add(quadMesh(matBook, 2.9, 0.975, -3.545, 0, 0, 1, 0.92, 1.86, 1 / 0.92, 1 / 1.86));
  blobRect(2.9, -3.77, 1.10, 0.51, blobMat, 0.012);     // shelf contact shadow

  // ================= v5: wiring + swaying burnt bulb ====================
  roomScene.add(cs(boxMesh(matPipe, 0, 3.02, -3.70, 7.60, 0.04, 0.04, 2, 0, wireCol)));      // N wall run
  roomScene.add(cs(boxMesh(matPipe, 3.70, 3.02, -1.35, 0.04, 0.04, 4.75, 2, 0, wireCol)));   // E wall run
  roomScene.add(cs(boxMesh(matPipe, 2.27, 3.05, 1.0, 2.90, 0.04, 0.04, 2, 0, wireCol)));     // ceiling run
  var swing = new THREE.Group();
  swing.position.set(0.8, 3.05, 1.0);   // pivot at ceiling above the table
  swing.add(cs(boxMesh(matPipe, 0, -0.36, 0, 0.035, 0.72, 0.035, 2, 0, wireCol)));           // drop wire
  swing.add(cs(boxMesh(matPipe, 0, -0.76, 0, 0.09, 0.10, 0.09, 2, 0, [0.20, 0.19, 0.18])));  // socket
  swing.add(cs(boxMesh(matPipe, 0, -0.88, 0, 0.12, 0.15, 0.12, 2, 0, [0.15, 0.14, 0.13])));  // burnt bulb
  roomScene.add(swing);

  // ======================== v5: grime decals ============================
  var matStain = decalMaterial(0.045, 0.04, 0.032, 0.5);
  var matDrag = decalMaterial(0.07, 0.025, 0.025, 0.55);
  var matBlood = decalMaterial(0.11, 0.02, 0.02, 0.62);
  var matMold = decalMaterial(0.04, 0.06, 0.045, 0.35);
  blobOct(-3.35, -0.60, 0.62, matStain, 0.006, 1);      // puddle under drum
  blobOct(1.62, 1.58, 0.34, matStain, 0.006, 2);        // puddle by the table
  blobPath([[1.2, -3.42], [0.95, -2.7], [0.55, -1.9], [0.25, -1.15]], 0.24, 0.30, matDrag, 0.007);  // drag mark
  blobOct(1.2, -3.5, 0.40, matBlood, 0.008, 3);         // blood spatter at window
  blobWall(-3.98, 0.62, 3.15, true, 1.0, 0.6, matMold);  // SW corner, W wall
  blobWall(-3.15, 0.62, 3.98, false, 1.0, 0.6, matMold); // SW corner, S wall
  blobWall(3.98, 0.62, 3.15, true, 1.0, 0.6, matMold);   // SE corner, E wall
  blobWall(3.15, 0.62, 3.98, false, 1.0, 0.6, matMold);  // SE corner, S wall
  roomScene.add(decalGroup);

  // ====================== camera: idle drift + roam ====================
  var camera = new THREE.PerspectiveCamera(state.fov, IW / IH, 0.1, 50);
  var basePos = new THREE.Vector3(2.1, EYE, 2.2);
  var baseTarget = new THREE.Vector3(-4, 1.30, -2.4);
  var idlePos = new THREE.Vector3(), idleQuat = new THREE.Quaternion();
  var tmpTgt = new THREE.Vector3();

  function updateIdle(t) {
    var w1 = Math.PI * 2 / 20, w2 = Math.PI * 2 / 13;
    tmpTgt.copy(basePos);
    tmpTgt.x += 0.020 * Math.sin(w1 * t);
    tmpTgt.y += 0.010 * Math.sin(w2 * t + 1.7);
    tmpTgt.z += 0.020 * Math.sin(w1 * t) * Math.cos(w1 * t);
    idlePos.copy(tmpTgt);
    var tx = baseTarget.x + 0.16 * Math.sin(w1 * 0.8 * t + 0.5),
        ty = baseTarget.y + 0.10 * Math.sin(w2 * 0.7 * t),
        tz = baseTarget.z + 0.16 * Math.cos(w1 * 0.8 * t);
    var m = new THREE.Matrix4().lookAt(idlePos, tmpTgt.set(tx, ty, tz), new THREE.Vector3(0, 1, 0));
    idleQuat.setFromRotationMatrix(m);
  }

  var f0 = tmpTgt.copy(baseTarget).sub(basePos).normalize();
  var walk = {
    active: false,
    pos: new THREE.Vector3(basePos.x, EYE, basePos.z),
    yaw: Math.atan2(-f0.x, -f0.z),
    pitch: Math.asin(f0.y),
    lastInput: -99,
    bob: 0,
    moving: false
  };
  var keys = {};
  var colliders = [
    { x0: -3.05, z0: -3.85, x1: -2.15, z1: -2.95 },   // crate1 + top crate
    { x0: -2.05, z0: -3.90, x1: -1.25, z1: -3.10 },   // crate2
    { x0: -3.73, z0: -0.98, x1: -2.97, z1: -0.22 },   // drum (AABB approx)
    { x0: 0.20, z0: 0.40, x1: 1.40, z1: 1.60 },       // table
    { x0: 2.40, z0: -3.95, x1: 3.40, z1: -3.45 }      // bookshelf
  ];

  function collide(p) {
    var lim = 4 - RADIUS - 0.05;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(lim, p.z));
    colliders.forEach(function (c) {
      var qx = Math.max(c.x0, Math.min(p.x, c.x1));
      var qz = Math.max(c.z0, Math.min(p.z, c.z1));
      var dx = p.x - qx, dz = p.z - qz;
      var d2 = dx * dx + dz * dz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-8) {
          var d = Math.sqrt(d2), push = RADIUS - d;
          p.x += dx / d * push; p.z += dz / d * push;
        } else {
          var pxl = p.x - c.x0, pxr = c.x1 - p.x, pzb = p.z - c.z0, pzf = c.z1 - p.z;
          var m = Math.min(pxl, pxr, pzb, pzf);
          if (m === pxl) p.x = c.x0 - RADIUS; else if (m === pxr) p.x = c.x1 + RADIUS;
          else if (m === pzb) p.z = c.z0 - RADIUS; else p.z = c.z1 + RADIUS;
        }
      }
    });
  }

  function updateWalk(t, dt) {
    var fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
    var rx = -fz, rz = fx;
    var mx = 0, mz = 0;
    if (walk.active) {
      if (keys['w']) { mx += fx; mz += fz; }
      if (keys['s']) { mx -= fx; mz -= fz; }
      if (keys['d']) { mx += rx; mz += rz; }
      if (keys['a']) { mx -= rx; mz -= rz; }
    }
    var len = Math.hypot(mx, mz);
    walk.moving = len > 0.01;
    var run = keys['shift'] && walk.moving;
    if (walk.moving) {
      walk.lastInput = t;
      var sp = (run ? 4.0 : 2.2) * dt;
      walk.pos.x += mx / len * sp; walk.pos.z += mz / len * sp;
      collide(walk.pos);
      walk.bob += dt * (run ? 13 : 9);
    }
    var bobY = walk.moving ? Math.sin(walk.bob * 2) * 0.030 : 0;
    walk.pos.y = EYE + bobY;
  }

  var walkQuat = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
  function poseBlend(t) {
    var w;
    if (walk.active) w = 1;
    else {
      var since = t - walk.lastInput;
      w = since < 3 ? 1 : Math.max(0, 1 - (since - 3) / 2);
    }
    eul.set(walk.pitch, walk.yaw, 0);
    walkQuat.setFromEuler(eul);
    camera.position.lerpVectors(idlePos, walk.pos, w);
    camera.quaternion.copy(idleQuat).slerp(walkQuat, w);
    return w;
  }

  // ====================== flicker (lamp filament) ======================
  var dip = { next: 4, until: -1 };
  function flickerValue(t) {
    if (!state.flicker) return 1;
    var f = 1 + 0.045 * Math.sin(t * 47.3) + 0.025 * Math.sin(t * 31.7 + 1.3);
    if (t > dip.next) { dip.until = t + 0.09; dip.next = t + 3 + Math.random() * 6; }
    if (t < dip.until) f *= 0.62;
    return f;
  }

  // ====================== CRT / upscale pass ==========================
  var CRT_FS = [
    'uniform sampler2D tRoom;',
    'uniform float uTime;',
    'uniform float uCrt;',
    'uniform vec2 uOrigin;',
    'uniform vec2 uSize;',
    'uniform vec2 uLowRes;',
    'float h13(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }',
    'vec3 samp(vec2 u) {',
    '  vec2 px = clamp(floor(u * uLowRes), vec2(0.0), uLowRes - vec2(1.0));',
    '  return texture2D(tRoom, (px + 0.5) / uLowRes).rgb;',
    '}',
    'void main() {',
    '  vec2 dev = gl_FragCoord.xy;',
    '  vec2 q = (dev - uOrigin) / uSize;',
    '  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) {',
    '    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return;',
    '  }',
    '  vec2 cc = q * 2.0 - 1.0;',
    '  vec3 col;',
    '  if (uCrt > 0.5) {',
    '    vec2 s = vec2(cc.x * (1.0 + 0.06 * cc.y * cc.y + 0.02 * cc.x * cc.x),',
    '                  cc.y * (1.0 + 0.06 * cc.x * cc.x + 0.02 * cc.y * cc.y));',
    '    s *= 1.04;',
    '    if (abs(s.x) > 1.0 || abs(s.y) > 1.0) {',
    '      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return;',
    '    }',
    '    vec2 uvs = s * 0.5 + 0.5;',
    '    vec2 rad = uvs - 0.5;',
    '    col.r = samp(uvs + rad * 0.0045).r;',
    '    col.g = samp(uvs).g;',
    '    col.b = samp(uvs - rad * 0.0045).b;',
    '    float row = floor(uvs.y * uLowRes.y);',
    '    col *= mod(row, 2.0) < 1.0 ? 1.0 : 0.80;',
    '    float idx = mod(floor(dev.x), 3.0);',
    '    vec3 mask = idx < 1.0 ? vec3(1.25, 0.52, 0.52) : (idx < 2.0 ? vec3(0.52, 1.25, 0.52) : vec3(0.52, 0.52, 1.25));',
    '    col *= mask * 1.30;',
    '    float band = fract(uTime * 0.07);',
    '    float db = abs(uvs.y - (1.0 - band));',
    '    if (db < 0.05) col += (h13(vec3(floor(dev.xy * 0.5), floor(uTime * 30.0))) - 0.5) * 0.30 * (1.0 - db / 0.05);',
    '    col += (h13(vec3(dev, floor(uTime * 60.0))) - 0.5) * 0.035;',
    '    col *= 1.0 - 0.16 * dot(cc, cc);',
    '    col *= 1.0 + 0.015 * sin(uTime * 7.0);',
    '  } else {',
    '    col = samp(q);',
    '  }',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  var canvas = document.getElementById('gl');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  var roomRT = new THREE.WebGLRenderTarget(IW, IH, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true
  });
  roomRT.texture.colorSpace = THREE.LinearSRGBColorSpace;

  var crtMat = new THREE.ShaderMaterial({
    uniforms: {
      tRoom: { value: roomRT.texture },
      uTime: { value: 0 },
      uCrt: { value: 1 },
      uOrigin: { value: new THREE.Vector2(0, 0) },
      uSize: { value: new THREE.Vector2(1, 1) },
      uLowRes: { value: new THREE.Vector2(IW, IH) }
    },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: CRT_FS,
    depthTest: false,
    depthWrite: false
  });
  var crtScene = new THREE.Scene();
  {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    crtScene.add(new THREE.Mesh(g, crtMat));
  }
  var crtCam = new THREE.Camera();

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    var W = renderer.domElement.width, Hpx = renderer.domElement.height;
    var scale = Math.max(1, Math.min(Math.floor(W / IW), Math.floor(Hpx / IH)));
    var sw = scale * IW, sh = scale * IH;
    crtMat.uniforms.uOrigin.value.set(Math.floor((W - sw) / 2), Math.floor((Hpx - sh) / 2));
    crtMat.uniforms.uSize.value.set(sw, sh);
  }
  window.addEventListener('resize', resize);
  resize();

  // ========================= input + HUD ==============================
  var hud = document.getElementById('hud');
  var hint = document.getElementById('hint');
  function onoff(v) { return '<span class="' + (v ? 'on' : 'off') + '">' + (v ? 'ON ' : 'OFF') + '</span>'; }
  function updateHud() {
    hud.style.display = state.hud ? 'block' : 'none';
    hint.style.display = state.hud ? 'block' : 'none';
    hud.innerHTML =
      '<div class="title">PS1 ROOM &mdash; AFFINE TEXTURE WOBBLE</div>' +
      '<div>mode: ' + (walk.active ? '<span class="on">ROAM</span> WASD+mouse, M/Esc exit' : '<span class="off">IDLE DRIFT</span> click / M to roam') + '</div>' +
      '<div><kbd>1</kbd> affine mapping&nbsp;&nbsp;' + onoff(state.affine) + '</div>' +
      '<div><kbd>2</kbd> vertex snap&nbsp;&nbsp;&nbsp;&nbsp;' + onoff(state.snap) + '</div>' +
      '<div><kbd>3</kbd> nearest filter&nbsp;&nbsp;' + onoff(state.nearest) + '</div>' +
      '<div><kbd>4</kbd> lamp flicker&nbsp;&nbsp;&nbsp;' + onoff(state.flicker) + '</div>' +
      '<div><kbd>5</kbd> crt filter&nbsp;&nbsp;&nbsp;&nbsp;' + onoff(state.crt) + '</div>' +
      '<div><kbd>6</kbd> hud&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + onoff(state.hud) + '</div>' +
      '<div><kbd>7</kbd> shadows&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + onoff(state.shadow) + '</div>' +
      '<div><kbd>[</kbd><kbd>]</kbd> fov&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + state.fov.toFixed(0) + '&deg; (h ~' + (2 * Math.atan(Math.tan(state.fov * Math.PI / 360) * IW / IH) * 180 / Math.PI).toFixed(0) + '&deg;)</div>';
  }
  function setFilter() {
    var f = state.nearest ? THREE.NearestFilter : THREE.LinearFilter;
    allTex.forEach(function (t) { t.magFilter = t.minFilter = f; t.needsUpdate = true; });
  }
  function tryLock() {
    try {
      var p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* unsupported / blocked: fallback stays active */ }
  }
  function enterRoam() {
    if (walk.active) return;
    walk.active = true;
    updateHud();
    // pointer lock is a bonus; roam also works with plain mousemove deltas
    tryLock();
  }
  function exitRoam() {
    if (!walk.active) return;
    walk.active = false;
    if (document.pointerLockElement === canvas) {
      try {
        var p = document.exitPointerLock();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
    walk.lastInput = nowT;
    updateHud();
  }
  var lookDownX = 0, lookDownY = 0, lookMoved = 0, lookDragged = false, lockWasOnPress = false;
  canvas.addEventListener('mousedown', function (e) {
    lookDownX = e.clientX; lookDownY = e.clientY;
    lookMoved = 0; lookDragged = false;
    lockWasOnPress = !!document.pointerLockElement;
  });
  // Drag detection uses accumulated motion deltas, not clientX jumps: once a
  // drag re-acquires pointer lock the cursor position freezes, and a
  // locked-user drag has to count too (the up-click must not exit roam).
  document.addEventListener('mousemove', function (e) {
    if (!walk.active || !(e.buttons & 1)) return;
    lookMoved += Math.abs(e.movementX) + Math.abs(e.movementY)
      + Math.abs(e.clientX - lookDownX) + Math.abs(e.clientY - lookDownY);
    lookDownX = e.clientX; lookDownY = e.clientY;
    if (lookMoved > 8) lookDragged = true;
  });
  canvas.addEventListener('click', function (e) {
    var consumed = false;
    if (lookDragged) {
      consumed = true;                       // drag-look release, not a toggle
    } else if (!document.pointerLockElement && lockWasOnPress) {
      // Esc natively dropped the lock (no page keydown); a bare click after
      // the press re-acquires it instead of exiting roam. A drag or a plain
      // click-while-unlocked still toggles normally.
      tryLock(); consumed = true;
    }
    lookDragged = false; lookMoved = 0;
    if (consumed) return;
    walk.active ? exitRoam() : enterRoam();
  });
  document.addEventListener('pointerlockchange', updateHud);
  document.addEventListener('pointerlockerror', function () { /* fallback mouse-look stays active */ });
  document.addEventListener('mousemove', function (e) {
    if (!walk.active) return;
    // without pointer lock the OS cursor recentering / window re-entry would
    // teleport the view, so fallback look is drag-only (left button held)
    if (!document.pointerLockElement && !(e.buttons & 1)) return;
    var dx = Math.max(-260, Math.min(260, e.movementX));
    var dy = Math.max(-260, Math.min(260, e.movementY));
    walk.yaw -= dx * 0.0022;
    walk.pitch -= dy * 0.0022;
    var lim = Math.PI / 180 * 85;
    walk.pitch = Math.max(-lim, Math.min(lim, walk.pitch));
    walk.lastInput = nowT;
  });
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'escape') { exitRoam(); return; }
    if (walk.active && (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'shift')) {
      keys[k] = true; walk.lastInput = nowT; return;
    }
    if (k === 'm') { walk.active ? exitRoam() : enterRoam(); return; }
    if (e.key === '[' || e.key === ']') {
      state.fov = Math.max(30, Math.min(100, state.fov + (e.key === ']' ? -2 : 2)));
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
      updateHud();
      return;
    }
    if (k === '1') state.affine = !state.affine;
    else if (k === '2') state.snap = !state.snap;
    else if (k === '3') { state.nearest = !state.nearest; setFilter(); }
    else if (k === '4') state.flicker = !state.flicker;
    else if (k === '5') state.crt = !state.crt;
    else if (k === '6') state.hud = !state.hud;
    else if (k === '7') state.shadow = !state.shadow;
    else return;
    updateHud();
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  updateHud();

  // ============================ main loop =============================
  var clock = new THREE.Clock();
  var nowT = 0;
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());
    nowT += dt;
    updateIdle(nowT);
    updateWalk(nowT, dt);
    poseBlend(nowT);

    shared.uAffine.value = state.affine ? 1 : 0;
    shared.uSnap.value = state.snap ? 1 : 0;
    shared.uFlicker.value = flickerValue(nowT);
    shared.uShadow.value = state.shadow ? 1 : 0;
    blobGroup.visible = state.shadow;
    swing.rotation.z = 0.052 * Math.sin(nowT * Math.PI / 2);
    swing.rotation.x = 0.031 * Math.sin(nowT * Math.PI * 0.43 + 1.3);
    crtMat.uniforms.uTime.value = nowT;
    crtMat.uniforms.uCrt.value = state.crt ? 1 : 0;

    renderer.setRenderTarget(roomRT);
    renderer.render(roomScene, camera);
    renderer.setRenderTarget(null);
    renderer.render(crtScene, crtCam);
  }
  frame();
})();
