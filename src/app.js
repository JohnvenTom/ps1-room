(function () {
  'use strict';
  var PS1 = window.PS1 = {};

  // ============================== config ==============================
  var IW = 320, IH = 240;                     // PS1-era internal framebuffer
  var state = {
    affine: false, snap: true, nearest: true, crt: true, hud: true,
    flicker: true, shadow: true, fog: true, particles: true, fov: 55.4
  };
  var EYE = 1.62, RADIUS = 0.35;
  PS1.state = state;
  PS1.EYE = EYE; PS1.RADIUS = RADIUS;

  // ========================= rand / noise =============================
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
  PS1.hash2 = hash2;
  PS1.vnoise = vnoise;

  // ==================== procedural texture kit ========================
  var ALLTEX = [];
  function newCanvas(n) { var c = document.createElement('canvas'); c.width = c.height = n; return c; }
  function pixelLoop(c, fn) {
    var n = c.width, g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var col = fn(x, y);
      var i = (y * n + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function texFrom(canvas) {
    var t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = false;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.needsUpdate = true;
    ALLTEX.push(t);
    return t;
  }
  function solidTexture(r, g, b) {
    var t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.needsUpdate = true;
    ALLTEX.push(t);
    return t;
  }
  PS1.newCanvas = newCanvas;
  PS1.pixelLoop = pixelLoop;
  PS1.texFrom = texFrom;
  PS1.solidTexture = solidTexture;

  var bayerTex = (function () {
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
  })();

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
    'varying float vDist;',      // view-space distance for fog
    'void main() {',
    '  vUvP = uv;',
    '  vCol = color;',
    '  vec4 view = modelViewMatrix * vec4(position, 1.0);',
    '  vDist = -view.z;',
    '  vec4 clip = projectionMatrix * view;',
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
    '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);',   // supports animated props (non-identity matrix)
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
    'uniform vec3 uFogColor;',
    'uniform float uFogNear;',
    'uniform float uFogFar;',
    'uniform float uFogOn;',
    'varying vec3 vAff;',
    'varying vec2 vUvP;',
    'varying vec3 vCol;',
    'varying float vDist;',
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
    // hard directional (sun/moon) shadow, same Bayer penumbra language.
    // bias convention matches psPointShadow: negative bias favour the lit side,
    // so the fragment depth is offset by -bias before the comparison.
    'float psDirShadow( sampler2D smap, vec4 sc, float bias, float bayer ) {',
    '  vec3 pc = sc.xyz / sc.w;',
    '  if ( pc.x < 0.001 || pc.x > 0.999 || pc.y < 0.001 || pc.y > 0.999 ) return 1.0;',
    '  float stored = unpackRGBAToDepth( texture2D( smap, pc.xy ) );',
    '  float soft = clamp( ( stored - pc.z - bias ) / 0.0035, 0.0, 1.0 );',
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
    '  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0',
    '  if (uShadow > 0.5) {',
    '    DirectionalLightShadow ds = directionalLightShadows[ 0 ];',
    '    vis = min( vis, psDirShadow( directionalShadowMap[ 0 ], vDirectionalShadowCoord[ 0 ], ds.shadowBias, b ) );',
    '  }',
    '  #endif',
    '  vec3 c = texture2D(uMap, u).rgb * vCol * uFlicker;',
    '  float dark = 0.35 + ( 1.0 - min( uFlicker, 1.0 ) ) * 0.55;',   // lamp dip -> shallower shadow
    '  c *= mix( dark, 1.0, vis );',
    '  float fogF = uFogOn * smoothstep( uFogNear, uFogFar, vDist );',
    '  c = mix( c, uFogColor, fogF );',
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
    uBayer: { value: bayerTex },
    uFogColor: { value: new THREE.Color(0.5, 0.5, 0.5) },
    uFogNear: { value: 8 },
    uFogFar: { value: 30 },
    uFogOn: { value: 0 },
    uTime: { value: 0 }
  };
  PS1.shared = shared;

  function ps1Material(map) {
    var u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      uMap: { value: null },
      uBayer: { value: null },
      uAffine: { value: 1 },
      uSnap: { value: 1 },
      uFlicker: { value: 1 },
      uShadow: { value: 1 },
      uRes: { value: null },
      uFogColor: { value: null },
      uFogNear: { value: 1 },
      uFogFar: { value: 1 },
      uFogOn: { value: 0 }
    }]);
    u.uMap.value = map;
    u.uBayer = shared.uBayer;
    u.uAffine = shared.uAffine;
    u.uSnap = shared.uSnap;
    u.uFlicker = shared.uFlicker;
    u.uShadow = shared.uShadow;
    u.uRes = shared.uRes;
    u.uFogColor = shared.uFogColor;
    u.uFogNear = shared.uFogNear;
    u.uFogFar = shared.uFogFar;
    u.uFogOn = shared.uFogOn;
    return new THREE.ShaderMaterial({
      uniforms: u,
      lights: true,
      vertexShader: ROOM_VS,
      fragmentShader: ROOM_FS,
      side: THREE.DoubleSide
    });
  }
  PS1.ps1Material = ps1Material;

  // give a ps1 material its own private uFlicker (for blinking neon etc.)
  function privateFlicker(mat) {
    mat.uniforms.uFlicker = { value: 1 };
    return mat;
  }
  PS1.privateFlicker = privateFlicker;

  // ===================== light baking (vertex color) ==================
  // Scenes assign this before building geometry; must return [r, g, b].
  var RELIGHT = function (x, y, z, nx, ny, nz) { return [1, 1, 1]; };
  function setRelight(fn) { RELIGHT = fn; }
  PS1.setRelight = setRelight;
  PS1.relight = function () { return RELIGHT.apply(null, arguments); };

  // scalar helper: pack brightness into rgb triple
  function shade(c) { return [c, c, c]; }
  PS1.shade = shade;

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
  PS1.geo = geo;

  // subdivided ground grid: chunky Gouraud light pools, very PS1.
  // uvScale = texture repeats per 2 world meters; ny = light normal (+1 floor / -1 ceiling)
  function groundGrid(mat, cx, cz, w, d, segs, uvScale, y, ny) {
    y = y || 0; ny = ny || 1;
    var pos = [], uvs = [], cols = [], idx = [];
    for (var j = 0; j <= segs; j++) for (var i = 0; i <= segs; i++) {
      var x = cx - w / 2 + w * i / segs, z = cz - d / 2 + d * j / segs;
      pos.push(x, y, z);
      uvs.push(w * i / segs / 2 * uvScale, d * j / segs / 2 * uvScale);
      var c = RELIGHT(x, y, z, 0, ny, 0);
      cols.push(c[0], c[1], c[2]);
    }
    for (j = 0; j < segs; j++) for (i = 0; i < segs; i++) {
      var a = j * (segs + 1) + i, b2 = a + 1, c2 = a + segs + 1, d2 = c2 + 1;
      idx.push(a, c2, b2, b2, c2, d2);
    }
    var m = new THREE.Mesh(geo(pos, uvs, cols, idx), mat);
    m.receiveShadow = true;
    return m;
  }
  PS1.groundGrid = groundGrid;

  function wallSurface(mat, p0, p1, p2, p3, uvScaleU, uvScaleV, nx, ny, nz) {
    var pos = [].concat(p0, p1, p2, p3);
    var uv = [0, 0, uvScaleU, 0, uvScaleU, uvScaleV, 0, uvScaleV];
    var cols = [];
    [p0, p1, p2, p3].forEach(function (p) {
      cols = cols.concat(RELIGHT(p[0], p[1], p[2], nx, ny, nz));
    });
    return new THREE.Mesh(geo(pos, uv, cols, [0, 1, 2, 0, 2, 3]), mat);
  }
  PS1.wallSurface = wallSurface;

  // generic quad from 4 corner points (order: bl, br, tr, tl), light from face normal
  function quadCorners(mat, p0, p1, p2, p3, uvU, uvV) {
    var ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    var vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    var pos = [].concat(p0, p1, p2, p3);
    var uv = [0, 0, uvU, 0, uvU, uvV, 0, uvV];
    var cols = [];
    var ctr = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2];
    [p0, p1, p2, p3].forEach(function (p) {
      cols = cols.concat(RELIGHT(p[0], p[1], p[2], nx, ny, nz));
    });
    void ctr;
    return new THREE.Mesh(geo(pos, uv, cols, [0, 1, 2, 0, 2, 3]), mat);
  }
  PS1.quadCorners = quadCorners;

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
        var c = emissive ? emissive : RELIGHT(wx, wy, wz, nx, ny, nz);
        cols.push(c[0], c[1], c[2]);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    var m = new THREE.Mesh(geo(pos, uvs, cols, idx), material);
    m.receiveShadow = true;
    return m;
  }
  PS1.boxMesh = boxMesh;

  // vertical prism (cylinder-ish), yBase lifts it off the floor
  function prismMesh(material, cx, cz, r, h, sides, uvU, uvV, emissiveTop, yBase) {
    yBase = yBase || 0;
    var pos = [], uvs = [], cols = [], idx = [];
    for (var i = 0; i < sides; i++) {
      var a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      var am = (a0 + a1) / 2;
      var nx = Math.cos(am), nz = Math.sin(am);
      var p = [
        [cx + Math.cos(a0) * r, yBase, cz + Math.sin(a0) * r],
        [cx + Math.cos(a1) * r, yBase, cz + Math.sin(a1) * r],
        [cx + Math.cos(a1) * r, yBase + h, cz + Math.sin(a1) * r],
        [cx + Math.cos(a0) * r, yBase + h, cz + Math.sin(a0) * r]
      ];
      var base = pos.length / 3;
      p.forEach(function (v, k) {
        pos.push(v[0], v[1], v[2]);
        uvs.push((k === 1 || k === 2 ? uvU : 0), (k >= 2 ? uvV : 0));
        var c = RELIGHT(v[0], v[1], v[2], nx, 0, nz);
        cols.push(c[0], c[1], c[2]);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      // top cap fan
      pos.push(cx, yBase + h, cz);
      uvs.push(0.5, 0.5);
      var tc = emissiveTop != null ? shade(emissiveTop) : RELIGHT(cx, yBase + h, cz, 0, 1, 0);
      cols.push(tc[0], tc[1], tc[2]);
      var ci = pos.length / 3 - 1;
      idx.push(base, ci, base + 1);
    }
    var m = new THREE.Mesh(geo(pos, uvs, cols, idx), material);
    m.receiveShadow = true;
    return m;
  }
  PS1.prismMesh = prismMesh;

  // wall-plane quad; tangent u/v derived from normal
  function quadMesh(material, cx, cy, cz, nx, ny, nz, w, h, uvW, uvH) {
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
      var c = RELIGHT(x, y, z, nx, ny, nz);
      cols.push(c[0], c[1], c[2]);
    });
    return new THREE.Mesh(geo(pos, uvs, cols, [0, 1, 2, 0, 2, 3]), material);
  }
  PS1.quadMesh = quadMesh;

  // jittered low-poly blob (tree canopies): per-vertex tint callback
  function blobMesh(material, cx, cy, cz, r, stretch, jitter, tint) {
    var g = new THREE.SphereGeometry(r, 6, 5);
    var p = g.attributes.position, cols = [];
    for (var i = 0; i < p.count; i++) {
      var s = hash2(Math.round(p.getX(i) * 977), Math.round(p.getY(i) * 1231 + p.getZ(i) * 37));
      var s2 = hash2(Math.round(p.getZ(i) * 769) + 31, Math.round(p.getX(i) * 577 + p.getY(i)));
      var k = 1 + (s - 0.5) * jitter;
      var x = p.getX(i) * k, y = p.getY(i) * k * stretch, z = p.getZ(i) * k;
      p.setXYZ(i, x, y, z);
      var wx = cx + x, wy = cy + y, wz = cz + z;
      var c = RELIGHT(wx, wy, wz, x / r, Math.max(0.2, y / (r * stretch)), z / r);
      if (tint) {
        var tt = tint(s2, wy);
        c = [c[0] * tt[0], c[1] * tt[1], c[2] * tt[2]];
      }
      cols.push(c[0], c[1], c[2]);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, material);
    m.position.set(cx, cy, cz);
    m.receiveShadow = true;
    return m;
  }
  PS1.blobMesh = blobMesh;

  PS1.cs = function (m) { m.castShadow = true; return m; };   // shadow caster

  // ============================ sky dome ==============================
  function makeSky(cfg) {
    var u = {
      uTop: { value: new THREE.Color().fromArray(cfg.top) },
      uHorizon: { value: new THREE.Color().fromArray(cfg.horizon) },
      uBottom: { value: new THREE.Color().fromArray(cfg.bottom || [0.05, 0.05, 0.06]) },
      uSunDir: { value: new THREE.Vector3().fromArray(cfg.sunDir || [0, 1, 0]).normalize() },
      uSunCol: { value: new THREE.Color().fromArray(cfg.sunCol || [0, 0, 0]) },
      uSunCut: { value: cfg.sunCut || 0.9985 },
      uSunGlow: { value: cfg.sunGlow || 0 },
      uStars: { value: cfg.stars || 0 },
      uMeteors: { value: cfg.meteors || 0 },
      uTime: shared.uTime,
      uBayer: shared.uBayer
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = position;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTop, uHorizon, uBottom, uSunCol;',
        'uniform vec3 uSunDir;',
        'uniform float uSunCut, uSunGlow, uStars, uMeteors, uTime;',
        'uniform sampler2D uBayer;',
        'varying vec3 vDir;',
        'float h31(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }',
        'void main() {',
        '  vec3 d = normalize(vDir);',
        '  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, d.y));',
        '  col = mix(uBottom, col, smoothstep(-0.30, 0.02, d.y));',
        '  float s = dot(d, uSunDir);',
        '  col += uSunCol * (smoothstep(uSunCut, uSunCut + 0.0035, s) + uSunGlow * pow(max(s, 0.0), 24.0));',
        '  if (uStars > 0.0) {',
        '    vec3 sp = floor(d * 160.0);',
        '    float st = h31(sp);',
        '    float star = step(0.9982, st) * uStars * smoothstep(0.03, 0.25, d.y);',
        '    col += star * (0.55 + 0.45 * sin(uTime * 2.5 + st * 90.0));',
        '  }',
        '  if (uMeteors > 0.0) {',                       // one shooting star every ~9 s
        '    float cyc = floor(uTime / 9.0);',
        '    float ph = fract(uTime / 9.0);',
        '    float mu = 0.4 + h31(vec3(cyc, 7.0, 3.0)) * 1.8;',
        '    float mv = 0.45 + h31(vec3(cyc, 9.0, 1.0)) * 0.35;',
        '    if (ph < 0.09) {',
        '      float p = ph / 0.09;',
        '      float du = atan(d.z, d.x) - (mu + 0.7 * p);',
        '      du = mod(du + 3.14159, 6.2832) - 3.14159;',
        '      float dv = d.y - (mv - 0.22 * p);',
        '      col += vec3(0.85, 0.9, 1.0) * exp(-(du*du + dv*dv) * 700.0) * (1.0 - p) * uMeteors * step(0.15, d.y);',
        '    }',
        '  }',
        '  float b = texture2D(uBayer, (floor(mod(gl_FragCoord.xy, 4.0)) + 0.5) / 4.0).r;',
        '  col = clamp(col + (b - 0.5) * (1.5 / 32.0), 0.0, 1.0);',
        '  col = floor(col * 31.0 + 0.5) / 31.0;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var m = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius || 90, 20, 12), mat);
    m.frustumCulled = false;
    m.userData.isSky = true;
    return m;
  }
  PS1.makeSky = makeSky;

  // ===================== particle systems =============================
  // modes: petal (slow sway fall), rain (fast slanted streaks),
  //        steam (rising fade), dust (slow golden drift)
  function makeParticles(cfg) {
    var count = cfg.count;
    var pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      seed[i * 3] = Math.random();
      seed[i * 3 + 1] = Math.random();
      seed[i * 3 + 2] = Math.random();
      pos[i * 3] = 0; pos[i * 3 + 1] = -50; pos[i * 3 + 2] = 0;   // VS computes real position
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    var u = {
      uTime: shared.uTime,
      uSnap: shared.uSnap,
      uRes: shared.uRes,
      uBayer: shared.uBayer,
      uColor: { value: new THREE.Color().fromArray(cfg.color || [1, 1, 1]) },
      uSize: { value: cfg.size || 2 },
      uMode: { value: { petal: 0, rain: 1, steam: 2, dust: 3 }[cfg.mode || 'petal'] },
      uArea: { value: new THREE.Vector4(cfg.area[0], cfg.area[1], cfg.area[2], cfg.area[3]) },
      uH: { value: cfg.area[4] },
      uSpeed: { value: cfg.speed || 1 },
      uSway: { value: cfg.sway || 0.3 }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: u,
      transparent: false,
      depthWrite: true,
      vertexShader: [
        'uniform float uTime, uSnap, uSize, uMode, uH, uSpeed, uSway;',
        'uniform vec2 uRes;',
        'uniform vec4 uArea;',
        'attribute vec3 aSeed;',
        'varying float vFade;',
        'void main() {',
        '  float wx = uArea.y - uArea.x, wz = uArea.w - uArea.z;',
        '  vec3 p;',
        '  float fade = 1.0;',
        '  if (uMode < 0.5) {',                                  // petal
        '    float y = uH - mod(aSeed.y * uH + uTime * uSpeed, uH);',
        '    p = vec3(uArea.x + aSeed.x * wx + sin(uTime * 0.9 + aSeed.x * 40.0) * uSway,',
        '             y,',
        '             uArea.z + aSeed.z * wz + cos(uTime * 0.7 + aSeed.z * 30.0) * uSway);',
        '  } else if (uMode < 1.5) {',                           // rain
        '    float y = uH - mod(aSeed.y * uH + uTime * uSpeed, uH);',
        '    p = vec3(uArea.x + aSeed.x * wx + y * uSway * 0.25 + uTime * uSway, y,',
        '             uArea.z + aSeed.z * wz);',
        '  } else if (uMode < 2.5) {',                           // steam
        '    float y = mod(aSeed.y * uH + uTime * uSpeed, uH);',
        '    p = vec3(uArea.x + aSeed.x * wx + sin(uTime + aSeed.x * 20.0) * y * 0.35, y,',
        '             uArea.z + aSeed.z * wz + cos(uTime * 0.8 + aSeed.z * 17.0) * y * 0.35);',
        '    fade = 1.0 - y / uH;',
        '  } else {',                                            // dust
        '    p = vec3(uArea.x + aSeed.x * wx + sin(uTime * 0.15 + aSeed.x * 50.0) * 0.6,',
        '             0.25 + aSeed.y * (uH - 0.5) + sin(uTime * 0.4 + aSeed.y * 40.0) * 0.2,',
        '             uArea.z + aSeed.z * wz + cos(uTime * 0.12 + aSeed.z * 45.0) * 0.6);',
        '    fade = 0.5 + 0.5 * sin(uTime * 0.6 + aSeed.z * 60.0);',
        '  }',
        '  vec4 view = modelViewMatrix * vec4(p, 1.0);',
        '  vec4 clip = projectionMatrix * view;',
        '  if (uSnap > 0.5) {',
        '    vec2 hs = uRes * 0.5;',
        '    vec2 px = clip.xy / clip.w * hs + hs;',
        '    px = floor(px) + 0.5;',
        '    clip.xy = (px / hs - 1.0) * clip.w;',
        '  }',
        '  gl_Position = clip;',
        // uSize is the particle's world size in metres; project to 240px-buffer pixels
        '  float ps = uSize * 240.0 / max(0.5, -view.z);',
        '  gl_PointSize = clamp(ps, 1.0, 5.0);',
        '  vFade = fade;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uBayer;',
        'uniform vec3 uColor;',
        'varying float vFade;',
        'void main() {',
        '  float b = texture2D(uBayer, (floor(mod(gl_FragCoord.xy, 4.0)) + 0.5) / 4.0).r;',
        '  if (b > vFade) discard;',
        '  vec3 c = uColor * (0.75 + 0.25 * vFade);',
        '  c = clamp(c + (b - 0.5) * (1.5 / 32.0), 0.0, 1.0);',
        '  c = floor(c * 31.0 + 0.5) / 31.0;',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n')
    });
    var pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    return pts;
  }
  PS1.makeParticles = makeParticles;

  // ============ Bayer-dithered flat decals (contact shadows + grime) ===
  // zb = depth-layer in quantisation buckets (1 bucket = 1/32 m view depth):
  // decals sit above their host surface by 0.75+ buckets so they never
  // z-fight against it when the 3 cm depth snapping reorders coplanar depth.
  function decalMaterial(r, g, b, density, zb) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSnap: shared.uSnap, uRes: shared.uRes, uBayer: shared.uBayer,
        uCol: { value: new THREE.Vector3(r, g, b) },
        uDens: { value: density },
        uZ: { value: zb || 0.75 }
      },
      vertexShader: [
        'uniform float uSnap;',
        'uniform float uZ;',
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
        '    clip.z -= abs(projectionMatrix[2][2]) / 32.0 * uZ;',
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
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
  }
  PS1.decalMaterial = decalMaterial;
  var blobMat = decalMaterial(0, 0, 0, 0.35, 1.6);   // contact shadows: topmost decal layer
  PS1.blobMat = blobMat;

  // per-scene decal set: blobGroup (toggled with key 7) + decalGroup (always on)
  function newDecalSet() {
    var set = {
      blobGroup: new THREE.Group(),
      decalGroup: new THREE.Group(),
      rect: function (cx, cz, sx, sz, mat, y, rotY) {
        var hx = sx / 2, hz = sz / 2;
        var cr = Math.cos(rotY || 0), sr = Math.sin(rotY || 0);
        var pos = [];
        [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(function (p) {
          pos.push(cx + p[0] * cr - p[1] * sr, y, cz + p[0] * sr + p[1] * cr);
        });
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex([0, 2, 1, 0, 3, 2]);
        (mat === blobMat ? set.blobGroup : set.decalGroup).add(new THREE.Mesh(g, mat));
      },
      oct: function (cx, cz, r, mat, y, seed) {
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
        (mat === blobMat ? set.blobGroup : set.decalGroup).add(new THREE.Mesh(g, mat));
      },
      path: function (pts, w0, w1, mat, y) {
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
        (mat === blobMat ? set.blobGroup : set.decalGroup).add(new THREE.Mesh(g, mat));
      },
      wall: function (cx, cy, cz, alongZ, w, h, mat) {
        var pos = [], hw = w / 2;
        if (alongZ) {
          pos.push(cx, cy - h, cz - hw, cx, cy - h, cz + hw, cx, cy, cz + hw, cx, cy, cz - hw);
        } else {
          pos.push(cx - hw, cy - h, cz, cx + hw, cy - h, cz, cx + hw, cy, cz, cx - hw, cy, cz);
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex([0, 2, 1, 0, 3, 2]);
        (mat === blobMat ? set.blobGroup : set.decalGroup).add(new THREE.Mesh(g, mat));
      }
    };
    return set;
  }
  PS1.newDecalSet = newDecalSet;

  // ====================== scene registry ==============================
  var SCENES = [];
  PS1.registerScene = function (builder) { SCENES.push(builder); };
  PS1.sceneCount = function () { return SCENES.length; };

  // ====================== camera: idle drift + roam ====================
  var camera = new THREE.PerspectiveCamera(state.fov, IW / IH, 0.15, 200);
  var basePos = new THREE.Vector3();
  var baseTarget = new THREE.Vector3();
  var idlePos = new THREE.Vector3(), idleQuat = new THREE.Quaternion();
  var tmpTgt = new THREE.Vector3();
  var active = null, sceneIdx = 0;
  var afterBuild = [];

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

  var f0 = new THREE.Vector3();
  var walk = {
    active: false,
    pos: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    lastInput: -99,
    bob: 0,
    moving: false
  };
  var keys = {};

  function collide(p) {
    var b = active.bounds;
    p.x = Math.max(b.x0 + RADIUS, Math.min(b.x1 - RADIUS, p.x));
    p.z = Math.max(b.z0 + RADIUS, Math.min(b.z1 - RADIUS, p.z));
    active.colliders.forEach(function (c) {
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
    walk.pos.y = active.eyeY + bobY;
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

  var canvas, renderer, roomRT, crtMat, crtScene, crtCam;
  var fadeEl;

  function initRenderer() {
    canvas = document.getElementById('gl');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;

    roomRT = new THREE.WebGLRenderTarget(IW, IH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true
    });
    roomRT.texture.colorSpace = THREE.LinearSRGBColorSpace;

    crtMat = new THREE.ShaderMaterial({
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
    crtScene = new THREE.Scene();
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    crtScene.add(new THREE.Mesh(g, crtMat));
    crtCam = new THREE.Camera();

    fadeEl = document.getElementById('fade');

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
  }

  // ====================== scene switching ==============================
  function applyFog() {
    if (active && active.fog && state.fog) {
      shared.uFogOn.value = 1;
      shared.uFogColor.value.fromArray(active.fog.color);
      shared.uFogNear.value = active.fog.near;
      shared.uFogFar.value = active.fog.far;
    } else {
      shared.uFogOn.value = 0;
    }
  }
  function applyParticleVis() {
    if (!active) return;
    var v = state.particles;
    (active.particles || []).forEach(function (p) { p.visible = v; });
  }
  function applyBlobVis() {
    if (!active) return;
    if (active.blobGroup) active.blobGroup.visible = state.shadow;
  }

  function applyScene(i) {
    sceneIdx = ((i % SCENES.length) + SCENES.length) % SCENES.length;
    active = SCENES[sceneIdx].rec;
    basePos.fromArray(active.idle.pos);
    baseTarget.fromArray(active.idle.target);
    walk.pos.set(active.spawn[0], (active.eyeY || EYE), active.spawn[1]);
    walk.yaw = active.spawn[2];
    walk.pitch = active.spawn[3] || 0;
    walk.lastInput = -99;
    camera.far = active.far || 200;
    camera.updateProjectionMatrix();
    applyFog();
    applyParticleVis();
    applyBlobVis();
    active.scene.traverse(function (o) {
      if (o.userData && o.userData.isSky) o.visible = state.sky !== false;
    });
    if (active.onShow) active.onShow();
    updateHud();
  }

  var switching = false;
  function nextScene() {
    if (switching) return;
    switching = true;
    if (fadeEl) fadeEl.style.opacity = '1';
    setTimeout(function () {
      applyScene(sceneIdx + 1);
      setTimeout(function () {
        if (fadeEl) fadeEl.style.opacity = '0';
        switching = false;
      }, 60);
    }, 240);
  }
  PS1.nextScene = nextScene;

  // ========================= input + HUD ==============================
  var hud, hint;
  function onoff(v) { return '<span class="' + (v ? 'on' : 'off') + '">' + (v ? 'ON ' : 'OFF') + '</span>'; }
  function updateHud() {
    if (!hud) return;
    hud.style.display = state.hud ? 'block' : 'none';
    hint.style.display = state.hud ? 'block' : 'none';
    var sc = active ? SCENES[sceneIdx].rec.name : '';
    var idx = '(' + (sceneIdx + 1) + '/' + SCENES.length + ')';
    hud.innerHTML =
      '<div class="title">PS1 SCENES &mdash; ' + sc.toUpperCase() + ' ' + idx + '</div>' +
      '<div>mode: ' + (walk.active ? '<span class="on">ROAM</span> WASD+mouse, M/Esc exit' : '<span class="off">IDLE DRIFT</span> click / M to roam') + '</div>' +
      '<div><kbd>N</kbd> scene: ' + sc + ' &mdash; next: ' + (SCENES[(sceneIdx + 1) % SCENES.length].rec.name) + '</div>' +
      '<div><kbd>1</kbd> affine&nbsp;&nbsp;' + onoff(state.affine) +
      '&nbsp;&nbsp;<kbd>2</kbd> snap&nbsp;&nbsp;' + onoff(state.snap) +
      '&nbsp;&nbsp;<kbd>3</kbd> nearest&nbsp;&nbsp;' + onoff(state.nearest) + '</div>' +
      '<div><kbd>4</kbd> flicker&nbsp;&nbsp;' + onoff(state.flicker) +
      '&nbsp;&nbsp;<kbd>5</kbd> crt&nbsp;&nbsp;' + onoff(state.crt) +
      '&nbsp;&nbsp;<kbd>6</kbd> hud&nbsp;&nbsp;' + onoff(state.hud) + '</div>' +
      '<div><kbd>7</kbd> shadows&nbsp;&nbsp;' + onoff(state.shadow) +
      '&nbsp;&nbsp;<kbd>8</kbd> fog&nbsp;&nbsp;' + onoff(state.fog && !!(active && active.fog)) +
      '&nbsp;&nbsp;<kbd>9</kbd> particles&nbsp;&nbsp;' + onoff(state.particles && (active && active.particles && active.particles.length > 0)) + '</div>' +
      '<div><kbd>[</kbd><kbd>]</kbd> fov ' + state.fov.toFixed(0) + '&deg;</div>';
  }
  function setFilter() {
    var f = state.nearest ? THREE.NearestFilter : THREE.LinearFilter;
    ALLTEX.forEach(function (t) { t.magFilter = t.minFilter = f; t.needsUpdate = true; });
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

  var nowT = 0;

  function initInput() {
    hud = document.getElementById('hud');
    hint = document.getElementById('hint');
    var lookDownX = 0, lookDownY = 0, lookMoved = 0, lookDragged = false, lockWasOnPress = false;
    canvas.addEventListener('mousedown', function (e) {
      lookDownX = e.clientX; lookDownY = e.clientY;
      lookMoved = 0; lookDragged = false;
      lockWasOnPress = !!document.pointerLockElement;
    });
    document.addEventListener('mousemove', function (e) {
      if (!walk.active || !(e.buttons & 1)) return;
      lookMoved += Math.abs(e.movementX) + Math.abs(e.movementY)
        + Math.abs(e.clientX - lookDownX) + Math.abs(e.clientY - lookDownY);
      lookDownX = e.clientX; lookDownY = e.clientY;
      if (lookMoved > 8) lookDragged = true;
    });
    canvas.addEventListener('click', function () {
      var consumed = false;
      if (lookDragged) {
        consumed = true;                       // drag-look release, not a toggle
      } else if (!document.pointerLockElement && lockWasOnPress) {
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
      if (k === 'n') { nextScene(); return; }
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
      else if (k === '7') { state.shadow = !state.shadow; applyBlobVis(); }
      else if (k === '8') { state.fog = !state.fog; applyFog(); }
      else if (k === '9') { state.particles = !state.particles; applyParticleVis(); }
      else return;
      updateHud();
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  }

  // ============================ main loop =============================
  var clock = null;

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());
    nowT += dt;
    shared.uTime.value = nowT;
    updateIdle(nowT);
    updateWalk(nowT, dt);
    poseBlend(nowT);

    shared.uAffine.value = state.affine ? 1 : 0;
    shared.uSnap.value = state.snap ? 1 : 0;
    shared.uFlicker.value = (active && active.noFlicker) ? 1 : flickerValue(nowT);
    shared.uShadow.value = state.shadow ? 1 : 0;

    if (active && active.update) active.update(nowT, dt);

    crtMat.uniforms.uTime.value = nowT;
    crtMat.uniforms.uCrt.value = state.crt ? 1 : 0;

    renderer.setRenderTarget(roomRT);
    renderer.render(active.scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(crtScene, crtCam);
  }

  // ============================== boot =================================
  PS1.boot = function () {
    initRenderer();
    // build all registered scenes once, in registration order
    SCENES.forEach(function (s) {
      s.rec = s();          // s is the builder function registered by each scene
      if (s.rec.eyeY == null) s.rec.eyeY = EYE;
    });
    initInput();
    var startIdx = parseInt((location.hash.match(/scene=(\d+)/) || [])[1] || '0', 10) || 0;
    // optional deep-link overrides: #scene=1&crt=0&hud=0&shadow=0&fog=0&affine=1&snap=0&particles=0
    (location.hash.match(/[a-z]+=[0-9]+/g) || []).forEach(function (kv) {
      var pair = kv.split('='), k = pair[0], v = pair[1] === '1';
      if (k in state) {
        state[k] = v;
        if (k === 'nearest') setFilter();
      }
    });
    applyScene(startIdx);
    // debug: #cam=x,y,z&look=x,y,z overrides the idle framing (no validation, debug only)
    var camM = location.hash.match(/cam=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/);
    var lookM = location.hash.match(/look=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/);
    if (camM) {
      basePos.set(+camM[1], +camM[2], +camM[3]);
      if (lookM) baseTarget.set(+lookM[1], +lookM[2], +lookM[3]);
      else baseTarget.set(0, 1, 0);
    }
    updateHud();
    clock = new THREE.Clock();
    frame();
  };
})();
