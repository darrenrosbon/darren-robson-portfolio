(function () {
  "use strict";

  var canvas = document.getElementById("curtainCanvas");
  if (!canvas) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var gl = canvas.getContext("webgl", { antialias: true, alpha: false }) ||
           canvas.getContext("experimental-webgl", { antialias: true, alpha: false });
  if (!gl) return; // CSS gradient fallback on .curtain-canvas stays visible

  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "uniform vec2 u_res;",
    "uniform float u_time;",
    "uniform float u_scroll;",
    "uniform float u_energy;",
    "uniform vec2 u_mouse;",
    "uniform float u_mouseE;",
    "uniform vec3 u_dark1;",
    "uniform vec3 u_dark2;",
    "uniform vec3 u_mint;",
    "uniform vec3 u_mint2;",
    "",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / u_res.xy;",
    "  float aspect = u_res.x / u_res.y;",
    "  float x = uv.x * aspect;",
    "  float y = uv.y;",
    "  float t = u_time;",
    "",
    "  float breathe = sin(t * 0.22) * 0.16 + 0.84;",
    "  float warp = sin(y * 2.2 + t * 0.15) * 0.09 + sin(y * 5.0 - t * 0.2) * 0.035;",
    "",
    "  vec2 mUv = vec2(u_mouse.x * aspect, u_mouse.y);",
    "  float mDist = distance(vec2(x, y), mUv);",
    "  float mFalloff = exp(-mDist * 2.6);",
    "  float mWarp = mFalloff * sin(t * 1.6 - mDist * 9.0) * (0.05 + u_mouseE * 0.05);",
    "",
    "  float xw = x + warp + u_scroll * 0.35 + mWarp;",
    "",
    "  float bands = 0.0;",
    "  bands += sin(xw * 17.0 + sin(y * 3.0 + t * 0.3) * 1.2);",
    "  bands += sin(xw * 31.0 - t * 0.4 + sin(y * 6.0) * 0.6) * 0.55;",
    "  bands += sin(xw * 8.0 + t * 0.12) * 0.75;",
    "  bands /= 2.3;",
    "  bands *= breathe;",
    "  bands += u_energy * sin(xw * 46.0 - t * 2.2) * 0.16;",
    "",
    "  float glow = smoothstep(0.15, 1.0, bands * 0.5 + 0.5);",
    "  glow = pow(glow, 2.2 - u_energy * 0.22);",
    "",
    "  float accentT = smoothstep(0.0, 1.0, y * 0.55 + 0.45 + sin(xw * 0.5 + t * 0.07) * 0.18);",
    "  vec3 accent = mix(u_mint, u_mint2, accentT);",
    "",
    "  vec3 base = mix(u_dark1, u_dark2, uv.y * 0.6 + 0.2);",
    "  vec3 col = mix(base, accent, glow * 0.5 + u_energy * 0.05);",
    "  col += accent * mFalloff * 0.05;",
    "",
    "  float vig = smoothstep(1.2, 0.2, length(vec2((uv.x - 0.5) * 1.4, uv.y - 0.38)));",
    "  col *= mix(0.82, 1.05, vig);",
    "",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  var quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(program, "u_res");
  var uTime = gl.getUniformLocation(program, "u_time");
  var uScroll = gl.getUniformLocation(program, "u_scroll");
  var uEnergy = gl.getUniformLocation(program, "u_energy");
  var uMouse = gl.getUniformLocation(program, "u_mouse");
  var uMouseE = gl.getUniformLocation(program, "u_mouseE");
  var uDark1 = gl.getUniformLocation(program, "u_dark1");
  var uDark2 = gl.getUniformLocation(program, "u_dark2");
  var uMint = gl.getUniformLocation(program, "u_mint");
  var uMint2 = gl.getUniformLocation(program, "u_mint2");

  function hexToRgb01(hex, fallback) {
    if (!hex) return fallback;
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return fallback;
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  }

  var d = canvas.dataset || {};
  var dark1 = hexToRgb01(d.dark1, [0.027, 0.075, 0.059]);
  var dark2 = hexToRgb01(d.dark2, [0.043, 0.122, 0.094]);
  var mint1 = hexToRgb01(d.accent, [0.247, 0.878, 0.627]);
  var mint2 = hexToRgb01(d.accent2, mint1);

  gl.uniform3f(uDark1, dark1[0], dark1[1], dark1[2]);
  gl.uniform3f(uDark2, dark2[0], dark2[1], dark2[2]);
  gl.uniform3f(uMint, mint1[0], mint1[1], mint1[2]);
  gl.uniform3f(uMint2, mint2[0], mint2[1], mint2[2]);

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  var scrollNorm = 0;
  var energy = 0;
  var lastScrollY = window.scrollY || 0;

  function readScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var y = window.scrollY || doc.scrollTop || 0;
    var delta = y - lastScrollY;
    lastScrollY = y;
    energy = Math.min(energy + Math.min(Math.abs(delta) * 0.006, 0.35), 0.6);
    scrollNorm = max > 0 ? y / max : 0;
  }

  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", resize);

  // Mouse reactivity: smoothed cursor position gently bends the curtain
  // nearby; fast movement adds a small, quickly-decaying energy boost.
  var mouseTarget = [-1, -1]; // off-canvas until the pointer is actually used
  var mouseCurrent = [-1, -1];
  var mouseEnergy = 0;
  var mouseEnergyTarget = 0;
  var hasPointer = window.matchMedia("(pointer: fine)").matches;

  if (hasPointer && !reduceMotion) {
    window.addEventListener("mousemove", function (e) {
      var nx = e.clientX / window.innerWidth;
      var ny = 1 - e.clientY / window.innerHeight; // flip to match gl_FragCoord (bottom-up)
      var dx = nx - (mouseTarget[0] < 0 ? nx : mouseTarget[0]);
      var dy = ny - (mouseTarget[1] < 0 ? ny : mouseTarget[1]);
      mouseEnergyTarget = Math.min(mouseEnergyTarget + Math.hypot(dx, dy) * 1.6, 0.4);
      mouseTarget[0] = nx;
      mouseTarget[1] = ny;
    }, { passive: true });

    window.addEventListener("mouseleave", function () {
      mouseTarget[0] = -1;
      mouseTarget[1] = -1;
    });
  }

  var startTime = performance.now();
  var elapsed = 0;
  var running = true;
  var rafId = null;

  function render(now) {
    elapsed = (now - startTime) / 1000;
    resize();
    energy *= 0.9;
    mouseEnergyTarget *= 0.9;
    mouseEnergy += (mouseEnergyTarget - mouseEnergy) * 0.06;
    mouseCurrent[0] += (mouseTarget[0] - mouseCurrent[0]) * 0.035;
    mouseCurrent[1] += (mouseTarget[1] - mouseCurrent[1]) * 0.035;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform1f(uScroll, scrollNorm);
    gl.uniform1f(uEnergy, energy);
    gl.uniform2f(uMouse, mouseCurrent[0], mouseCurrent[1]);
    gl.uniform1f(uMouseE, mouseEnergy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduceMotion && running) rafId = requestAnimationFrame(render);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    } else if (!reduceMotion) {
      running = true;
      startTime = performance.now() - elapsed * 1000;
      rafId = requestAnimationFrame(render);
    }
  });

  resize();
  if (reduceMotion) {
    render(performance.now());
  } else {
    rafId = requestAnimationFrame(render);
  }
})();
