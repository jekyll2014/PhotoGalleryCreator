/*
 * Minimal dependency-free WebGL viewer for equirectangular (spherical 360°) panoramas.
 *
 * window.PanoViewer.mount(container, imageUrl) renders the image onto the inside of a sphere
 * with the camera at its centre. Drag (mouse or touch) to look around, wheel / pinch to zoom
 * the field of view. Returns a handle with destroy() to tear everything down.
 *
 * No three.js, no external assets — everything ships as static files.
 */
(function () {
  "use strict";

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
    return s;
  }

  // ---- tiny mat4 helpers ----
  function perspective(fovyDeg, aspect, near, far) {
    var f = 1 / Math.tan((fovyDeg * Math.PI / 180) / 2);
    var nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ];
  }
  // View rotation from yaw (around Y) then pitch (around X).
  function viewMatrix(yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    // Ry * Rx
    return [
      cy, sy * sp, -sy * cp, 0,
      0, cp, sp, 0,
      sy, -cy * sp, cy * cp, 0,
      0, 0, 0, 1
    ];
  }

  function sphere(seg, ring) {
    var pos = [], uv = [], idx = [];
    for (var y = 0; y <= ring; y++) {
      var v = y / ring, theta = v * Math.PI;
      var st = Math.sin(theta), ct = Math.cos(theta);
      for (var x = 0; x <= seg; x++) {
        var u = x / seg, phi = u * 2 * Math.PI;
        var sp = Math.sin(phi), cp = Math.cos(phi);
        pos.push(st * cp, ct, st * sp);
        uv.push(1 - u, v); // flip u so text reads correctly from inside
      }
    }
    for (var yy = 0; yy < ring; yy++) {
      for (var xx = 0; xx < seg; xx++) {
        var a = yy * (seg + 1) + xx, b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos: pos, uv: uv, idx: idx };
  }

  // Downscale the source to fit the GPU's max texture size (5760px panoramas exceed 4096 on
  // many GPUs). Returns a canvas or the original image if it already fits.
  function fitTexture(gl, img) {
    var max = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    if (img.width <= max && img.height <= max) return img;
    var scale = max / Math.max(img.width, img.height);
    var c = document.createElement("canvas");
    c.width = Math.floor(img.width * scale);
    c.height = Math.floor(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function mount(container, imageUrl) {
    var canvas = document.createElement("canvas");
    canvas.className = "pano-canvas";
    canvas.style.cssText = "width:100%;height:100%;display:block;cursor:grab;touch-action:none;";
    container.appendChild(canvas);

    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) { container.removeChild(canvas); throw new Error("WebGL unavailable"); }

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER,
      "attribute vec3 p;attribute vec2 u;uniform mat4 proj;uniform mat4 view;varying vec2 vu;" +
      "void main(){vu=u;gl_Position=proj*view*vec4(p,1.0);}"));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER,
      "precision mediump float;varying vec2 vu;uniform sampler2D tex;" +
      "void main(){gl_FragColor=texture2D(tex,vu);}"));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    var geo = sphere(64, 48);
    var pBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.pos), gl.STATIC_DRAW);
    var pLoc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 0, 0);

    var uBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.uv), gl.STATIC_DRAW);
    var uLoc = gl.getAttribLocation(prog, "u");
    gl.enableVertexAttribArray(uLoc);
    gl.vertexAttribPointer(uLoc, 2, gl.FLOAT, false, 0, 0);

    var iBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), gl.STATIC_DRAW);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // 1x1 placeholder until the image loads.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([20, 24, 30, 255]));

    var projLoc = gl.getUniformLocation(prog, "proj");
    var viewLoc = gl.getUniformLocation(prog, "view");

    var yaw = 0, pitch = 0, fov = 75, aspect = 1, alive = true, loaded = false;

    var img = new Image();
    // No crossOrigin: the gallery is served same-origin as static files. Forcing CORS mode
    // would taint the texture upload on servers that omit CORS headers and blank the sphere.
    img.onload = function () {
      if (!alive) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fitTexture(gl, img));
      loaded = true;
    };
    img.src = imageUrl;

    function resize() {
      var w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return; // container not laid out yet (e.g. still hidden) — try again later
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      aspect = canvas.width / canvas.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);
    // Re-measure when the container gains size / changes (handles mounting while hidden).
    var ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(container);
    resize();

    function render() {
      if (!alive) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (loaded) {
        gl.uniformMatrix4fv(projLoc, false, new Float32Array(perspective(fov, aspect, 0.1, 10)));
        gl.uniformMatrix4fv(viewLoc, false, new Float32Array(viewMatrix(yaw, pitch)));
        gl.drawElements(gl.TRIANGLES, geo.idx.length, gl.UNSIGNED_SHORT, 0);
      }
      raf = requestAnimationFrame(render);
    }
    var raf = requestAnimationFrame(render);

    // ---- interaction ----
    var dragging = false, lx = 0, ly = 0;
    function down(e) { dragging = true; canvas.style.cursor = "grabbing"; lx = px(e); ly = py(e); e.preventDefault(); }
    function move(e) {
      if (!dragging) return;
      var x = px(e), y = py(e);
      yaw -= (x - lx) * 0.005;
      pitch -= (y - ly) * 0.005;
      var lim = Math.PI / 2 - 0.01;
      if (pitch > lim) pitch = lim; if (pitch < -lim) pitch = -lim;
      lx = x; ly = y;
    }
    function up() { dragging = false; canvas.style.cursor = "grab"; }
    function px(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
    function py(e) { return e.touches ? e.touches[0].clientY : e.clientY; }
    function wheel(e) { fov = Math.max(30, Math.min(100, fov + (e.deltaY > 0 ? 4 : -4))); e.preventDefault(); }

    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    return {
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        gl.deleteTexture(tex);
        gl.deleteBuffer(pBuf); gl.deleteBuffer(uBuf); gl.deleteBuffer(iBuf);
        gl.deleteProgram(prog);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  window.PanoViewer = { mount: mount };
})();
