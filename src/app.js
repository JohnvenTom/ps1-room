(function () {
  'use strict';

  // ============================== config ==============================
  var IW = 320, IH = 240;                     // PS1-era internal framebuffer
  var state = { affine: true, snap: true, nearest: true, crt: true, hud: true };

  // ========================= procedural textures ======================
  function hash2(x, y) {
    var n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  // value noise, periodic with `period` lattice cells
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

  function floorCanvas() {
    var S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    var light = [150, 148, 138], dark = [86, 84, 78], grout = [44, 42, 38];
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var a = x + y, b = x - y + S;                 // 45-degree rotated grid
      var ca = Math.floor(a / 16), cb = Math.floor(b / 16);
      var da = a - ca * 16, db = b - cb * 16;
      var checker = (ca + cb) & 1;
      var base = checker ? dark : light;
      var tint = (hash2(((ca % 4) + 4) % 4, cb % 4) * 2 - 1) * 9;
      var r = base[0] + tint, gg = base[1] + tint, bb = base[2] + tint;
      var edge = Math.min(da, db);
      if (edge < 2) {                               // grout lines, 2px hard
        var k = edge < 1 ? 1 : 0.5;
        r = r + (grout[0] - r) * k; gg = gg + (grout[1] - gg) * k; bb = bb + (grout[2] - bb) * k;
      }
      var sp = hash2(x, y);                         // speckle grit
      if (sp < 0.12) { var q = 0.80 + sp * 0.5; r *= q; gg *= q; bb *= q; }
      var st = vnoise(x / 16, y / 16, 4, 2);        // old stains
      if (st > 0.60) { var n = (st - 0.60) * 1.9; r *= 1 - n; gg *= 1 - n * 0.95; bb *= 1 - n * 0.85; }
      var i = (y * S + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function wallCanvas() {
    var S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    var base = [122, 118, 110], mortar = [64, 62, 58];
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var row = Math.floor(y / 16);                 // panels 32x16, staggered
      var x2 = x + (row & 1) * 16;
      var col = Math.floor(x2 / 32), cx = x2 - col * 32;
      var tint = (hash2(col % 2, row * 7 + 3) * 2 - 1) * 11;
      var r = base[0] + tint, gg = base[1] + tint, bb = base[2] + tint;
      var ry = y - row * 16;
      if (ry < 1 || cx < 1) {                       // mortar joints
        r = mortar[0] + tint * 0.4; gg = mortar[1] + tint * 0.4; bb = mortar[2] + tint * 0.4;
      } else if (ry === 1 || cx === 1) {            // joint shadow
        r *= 0.8; gg *= 0.8; bb *= 0.8;
      }
      var ci = Math.floor(x / 4);                   // water streaks down the wall
      var k = hash2(((ci % 16) + 16) % 16, 7);
      if (k < 0.30) {
        var xc = ci * 4 + 2 + Math.sin(y * 0.18 + ci * 2.3) * 1.4;
        var dx = x - xc; dx -= S * Math.round(dx / S);
        var fall = Math.max(0, 1 - Math.abs(dx) / 2.2) * Math.pow(y / S, 1.6) * 0.30 * (0.4 + k * 2);
        r *= 1 - fall; gg *= 1 - fall; bb *= 1 - fall * 0.9;
      }
      var sp = hash2(x + 91, y + 17);
      if (sp < 0.10) { r *= 0.86; gg *= 0.86; bb *= 0.86; }
      var i = (y * S + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function texFrom(canvas) {
    var t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;              // PS1: no trilinear, gritty
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = false;
    t.colorSpace = THREE.LinearSRGBColorSpace;      // raw values, no sRGB decode
    t.needsUpdate = true;
    return t;
  }

  // 4x4 Bayer matrix as a texture (GLSL ES 1.0 has no dynamic const arrays)
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
  var bayerTex = bayerTexture();

  // ============================ PS1 shaders ===========================
  var ROOM_VS = [
    'uniform float uSnap;',
    'uniform vec2 uRes;',
    'attribute vec3 color;',
    'varying vec3 vAff;',        // (uv * w, w): ratio interpolates AFFINELY
    'varying vec2 vUvP;',        // perspective-correct reference path
    'varying vec3 vCol;',
    'void main() {',
    '  vUvP = uv;',
    '  vCol = color;',
    '  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '  if (uSnap > 0.5) {',
    '    vec2 hs = uRes * 0.5;',
    '    vec2 px = clip.xy / clip.w * hs + hs;',   // to 320x240 pixel grid
    '    px = floor(px) + 0.5;',                   // kill sub-pixel precision
    '    clip.xy = (px / hs - 1.0) * clip.w;',
    '    clip.z = floor(clip.z / clip.w * 256.0) / 256.0 * clip.w;', // coarse z
    '  }',
    '  vAff = vec3(uv * clip.w, clip.w);',
    '  gl_Position = clip;',
    '}'
  ].join('\n');

  var ROOM_FS = [
    'uniform sampler2D uMap;',
    'uniform sampler2D uBayer;',
    'uniform float uAffine;',
    'varying vec3 vAff;',
    'varying vec2 vUvP;',
    'varying vec3 vCol;',
    'void main() {',
    '  vec2 u = uAffine > 0.5 ? vAff.xy / vAff.z : vUvP;',
    '  vec3 c = texture2D(uMap, u).rgb * vCol;',   // PS1 gouraud: vertex color lerp
    '  float b = texture2D(uBayer, (floor(mod(gl_FragCoord.xy, 4.0)) + 0.5) / 4.0).r;',
    '  c = clamp(c + (b - 0.5) * (1.5 / 32.0), 0.0, 1.0);', // ordered dither...
    '  c = floor(c * 31.0 + 0.5) / 31.0;',                   // ...into RGB555
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  function ps1Material(map) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uBayer: { value: bayerTex },
        uAffine: { value: 1 },
        uSnap: { value: 1 },
        uRes: { value: new THREE.Vector2(IW, IH) }
      },
      vertexShader: ROOM_VS,
      fragmentShader: ROOM_FS,
      side: THREE.DoubleSide
    });
  }

  var floorMat = ps1Material(floorTex);
  var ceilMat = ps1Material(wallTex);
  var wallMat = ps1Material(wallTex);
  var roomMats = [floorMat, ceilMat, wallMat];

  // ========================== room geometry ===========================
  // 8m x 8m x 3.2m sealed box. One quad = two triangles (affine seams show),
  // floor/ceiling are 4-triangle fans so vertex-color light pools need no extra
  // pixel-perfect lighting -- exactly how PS1 rooms faked it.
  function geo(pos, uvs, cols, idx) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    return g;
  }
  function shade(c) { return [c, c, c]; }

  function fanSurface(y, uvScale, cCenter, cCorner, material) {
    var h = 4;
    var pos = [-h, y, -h, h, y, -h, h, y, h, -h, y, h, 0, y, 0];
    var uv = [0, 0, uvScale, 0, uvScale, uvScale, 0, uvScale, uvScale / 2, uvScale / 2];
    var cc = shade(cCorner);
    var cols = cc.concat(cc, cc, cc, shade(cCenter));
    var idx = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4];
    return new THREE.Mesh(geo(pos, uv, cols, idx), material);
  }

  function wallSurface(p0, p1, p2, p3, uvScaleU, uvScaleV, cBot, cTop) {
    var pos = [].concat(p0, p1, p2, p3);
    var uv = [0, 0, uvScaleU, 0, uvScaleU, uvScaleV, 0, uvScaleV];
    var cols = shade(cBot).concat(shade(cBot), shade(cTop), shade(cTop));
    return new THREE.Mesh(geo(pos, uv, cols, [0, 1, 2, 0, 2, 3]), wallMat);
  }

  var roomScene = new THREE.Scene();
  roomScene.add(fanSurface(0, 4, 0.95, 0.42, floorMat));          // floor
  roomScene.add(fanSurface(3.2, 4, 0.52, 0.26, ceilMat));         // ceiling
  var H = 3.2;
  roomScene.add(wallSurface([-4, 0, -4], [4, 0, -4], [4, H, -4], [-4, H, -4], 4, 1.6, 0.80, 0.48)); // N (seen)
  roomScene.add(wallSurface([-4, 0, 4], [-4, 0, -4], [-4, H, -4], [-4, H, 4], 4, 1.6, 0.66, 0.40)); // W (seen)
  roomScene.add(wallSurface([4, 0, -4], [4, 0, 4], [4, H, 4], [4, H, -4], 4, 1.6, 0.42, 0.30));     // E
  roomScene.add(wallSurface([4, 0, 4], [-4, 0, 4], [-4, H, 4], [4, H, 4], 4, 1.6, 0.45, 0.32));     // S

  // ======================= camera + idle drift ========================
  // 70 deg horizontal FOV (4:3) => ~55.4 deg vertical in three.js terms.
  var camera = new THREE.PerspectiveCamera(55.4, IW / IH, 0.1, 50);
  var basePos = new THREE.Vector3(2.1, 1.62, 2.2);
  var baseTarget = new THREE.Vector3(-4, 1.30, -2.4);             // angled ~15deg off the far corner
  var tmpPos = new THREE.Vector3(), tmpTgt = new THREE.Vector3();

  function updateCamera(t) {
    var w1 = Math.PI * 2 / 20, w2 = Math.PI * 2 / 13;             // slow lissajous
    tmpPos.set(
      basePos.x + 0.020 * Math.sin(w1 * t),
      basePos.y + 0.010 * Math.sin(w2 * t + 1.7),
      basePos.z + 0.020 * Math.sin(w1 * t) * Math.cos(w1 * t)
    );
    tmpTgt.set(
      baseTarget.x + 0.16 * Math.sin(w1 * 0.8 * t + 0.5),         // ~1.5 deg yaw sway
      baseTarget.y + 0.10 * Math.sin(w2 * 0.7 * t),               // ~1 deg pitch sway
      baseTarget.z + 0.16 * Math.cos(w1 * 0.8 * t)
    );
    camera.position.copy(tmpPos);
    camera.lookAt(tmpTgt);
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
    '  vec2 px = clamp(floor(u * uLowRes), vec2(0.0), uLowRes - vec2(1.0));',  // hard nearest, pixel centers
    '  return texture2D(tRoom, (px + 0.5) / uLowRes).rgb;',
    '}',
    'void main() {',
    '  vec2 dev = gl_FragCoord.xy;',
    '  vec2 q = (dev - uOrigin) / uSize;',
    '  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) {',
    '    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return;',        // 4:3 letterbox
    '  }',
    '  vec2 cc = q * 2.0 - 1.0;',
    '  vec3 col;',
    '  if (uCrt > 0.5) {',
    '    vec2 s = vec2(cc.x * (1.0 + 0.06 * cc.y * cc.y + 0.02 * cc.x * cc.x),',
    '                  cc.y * (1.0 + 0.06 * cc.x * cc.x + 0.02 * cc.y * cc.y));',
    '    s *= 1.04;',
    '    if (abs(s.x) > 1.0 || abs(s.y) > 1.0) {',
    '      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return;',      // past the curved bezel
    '    }',
    '    vec2 uvs = s * 0.5 + 0.5;',
    '    vec2 rad = uvs - 0.5;',
    '    col.r = samp(uvs + rad * 0.0045).r;',                     // phosphor convergence error
    '    col.g = samp(uvs).g;',
    '    col.b = samp(uvs - rad * 0.0045).b;',
    '    float row = floor(uvs.y * uLowRes.y);',
    '    col *= mod(row, 2.0) < 1.0 ? 1.0 : 0.80;',                // scanlines
    '    float idx = mod(floor(dev.x), 3.0);',                     // RGB shadow mask
    '    vec3 mask = idx < 1.0 ? vec3(1.25, 0.52, 0.52) : (idx < 2.0 ? vec3(0.52, 1.25, 0.52) : vec3(0.52, 0.52, 1.25));',
    '    col *= mask * 1.30;',
    '    float band = fract(uTime * 0.07);',                       // rolling interference
    '    float db = abs(uvs.y - (1.0 - band));',
    '    if (db < 0.05) col += (h13(vec3(floor(dev.xy * 0.5), floor(uTime * 30.0))) - 0.5) * 0.30 * (1.0 - db / 0.05);',
    '    col += (h13(vec3(dev, floor(uTime * 60.0))) - 0.5) * 0.035;', // static grain
    '    col *= 1.0 - 0.16 * dot(cc, cc);',                        // vignette
    '    col *= 1.0 + 0.015 * sin(uTime * 7.0);',                  // mains flicker
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
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;         // raw writes, PS1-style
  renderer.setClearColor(0x000000, 1);

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
    vertexShader: [
      'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }'
    ].join('\n'),
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

  var letterbox = { ox: 0, oy: 0, sx: 1, sy: 1 };
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    var W = renderer.domElement.width, Hpx = renderer.domElement.height;
    var scale = Math.max(1, Math.min(Math.floor(W / IW), Math.floor(Hpx / IH)));
    var sw = scale * IW, sh = scale * IH;
    letterbox.ox = Math.floor((W - sw) / 2);
    letterbox.oy = Math.floor((Hpx - sh) / 2);
    letterbox.sx = sw; letterbox.sy = sh;
    crtMat.uniforms.uOrigin.value.set(letterbox.ox, letterbox.oy);
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
      '<div><kbd>A</kbd> affine mapping&nbsp;&nbsp;' + onoff(state.affine) + '</div>' +
      '<div><kbd>V</kbd> vertex snap&nbsp;&nbsp;&nbsp;&nbsp;' + onoff(state.snap) + '</div>' +
      '<div><kbd>T</kbd> nearest filter&nbsp;&nbsp;' + onoff(state.nearest) + '</div>' +
      '<div><kbd>C</kbd> crt filter&nbsp;&nbsp;&nbsp;&nbsp;' + onoff(state.crt) + '</div>' +
      '<div><kbd>H</kbd> hud&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + onoff(state.hud) + '</div>';
  }
  function setFilter() {
    var f = state.nearest ? THREE.NearestFilter : THREE.LinearFilter;
    floorTex.magFilter = wallTex.magFilter = f;
    floorTex.minFilter = wallTex.minFilter = f;
    floorTex.needsUpdate = wallTex.needsUpdate = true;
  }
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'a') state.affine = !state.affine;
    else if (k === 'v') state.snap = !state.snap;
    else if (k === 't') { state.nearest = !state.nearest; setFilter(); }
    else if (k === 'c') state.crt = !state.crt;
    else if (k === 'h') state.hud = !state.hud;
    else return;
    updateHud();
  });
  updateHud();

  // ============================ main loop =============================
  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var t = clock.getElapsedTime();
    updateCamera(t);

    for (var i = 0; i < roomMats.length; i++) {
      roomMats[i].uniforms.uAffine.value = state.affine ? 1 : 0;
      roomMats[i].uniforms.uSnap.value = state.snap ? 1 : 0;
    }
    crtMat.uniforms.uTime.value = t;
    crtMat.uniforms.uCrt.value = state.crt ? 1 : 0;

    renderer.setRenderTarget(roomRT);
    renderer.render(roomScene, camera);
    renderer.setRenderTarget(null);
    renderer.render(crtScene, crtCam);
  }
  frame();
})();
