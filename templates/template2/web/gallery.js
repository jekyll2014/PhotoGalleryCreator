/*
 * template2 gallery runtime — masonry grid + fullscreen lightbox.
 *
 * Reads the static data island (window.__GALLERY__) baked at generation time and drives:
 *   - a row of subfolder cards shown FIRST, above the photos,
 *   - a CSS-column masonry grid of thumbnails (native lazy-loading),
 *   - a fullscreen lightbox with neighbour preloading (cacheRadius each side),
 *   - navigation by arrows, keyboard, and swipe (finger on mobile / mouse drag on desktop).
 *
 * All client-side over pre-generated static files; the server only serves static assets.
 */
(function () {
  "use strict";

  var data = window.__GALLERY__ || {};
  var images = data.images || [];
  var subfolders = data.subfolders || [];
  var settings = data.settings || {};
  var RADIUS = Math.max(0, settings.cacheRadius == null ? 2 : settings.cacheRadius);

  var foldersEl = document.getElementById("folders");
  var grid = document.getElementById("grid");
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCaption = document.getElementById("lbCaption");
  var lbPrev = document.getElementById("lbPrev");
  var lbNext = document.getElementById("lbNext");
  var lbClose = document.getElementById("lbClose");
  var lbPano = document.getElementById("lbPano");

  var current = -1;
  var cache = {};   // index -> preloaded Image
  var pano = null;  // active 360 viewer handle, if any

  // ---- Subfolders first ------------------------------------------------------

  subfolders.forEach(function (f) {
    var a = document.createElement("a");
    a.className = "folder-card";
    a.href = f.link;
    a.title = f.title || f.name;
    if (f.thumb) {
      var cover = document.createElement("span");
      cover.className = "folder-cover";
      var cimg = document.createElement("img");
      cimg.src = f.thumb; cimg.alt = "";
      cover.appendChild(cimg);
      a.appendChild(cover);
    }
    var icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.textContent = "📁"; // folder
    var name = document.createElement("span");
    name.className = "folder-name";
    name.textContent = f.title || f.name;
    a.appendChild(icon);
    a.appendChild(name);
    foldersEl.appendChild(a);
  });

  // ---- Photo grid ------------------------------------------------------------

  images.forEach(function (img, index) {
    var cell = document.createElement("figure");
    cell.className = "cell";
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.title = img.title || img.fileName;

    var im = document.createElement("img");
    im.loading = "lazy";
    im.src = img.thumb;
    im.alt = img.title || img.fileName;
    if (img.width && img.height) { im.width = img.width; im.height = img.height; }
    cell.appendChild(im);

    if (img.is360) {
      var badge = document.createElement("span");
      badge.className = "badge-360";
      badge.textContent = "360°";
      cell.appendChild(badge);
    }

    if (img.title) {
      var cap = document.createElement("figcaption");
      cap.className = "cell-title";
      cap.textContent = img.title;
      cell.appendChild(cap);
    }

    cell.addEventListener("click", function () { open(index); });
    cell.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(index); }
    });
    grid.appendChild(cell);
  });

  // ---- Neighbour cache -------------------------------------------------------

  function preloadNeighbours(index) {
    var lo = Math.max(0, index - RADIUS);
    var hi = Math.min(images.length - 1, index + RADIUS);
    for (var i = lo; i <= hi; i++) {
      if (images[i].is360) continue; // panoramas are huge; the viewer loads them on open
      if (!cache[i]) { var p = new Image(); p.src = images[i].full; cache[i] = p; }
    }
    Object.keys(cache).forEach(function (k) {
      var n = +k; if (n < lo || n > hi) delete cache[n];
    });
  }

  // ---- Lightbox --------------------------------------------------------------

  function open(index) {
    current = Math.max(0, Math.min(images.length - 1, index));
    // Make the lightbox visible FIRST so the pano container has real dimensions when the
    // WebGL viewer measures it (a hidden container would size the canvas to 1x1).
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    show();
  }

  function close() {
    destroyPano();
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function destroyPano() {
    if (pano) { pano.destroy(); pano = null; }
    lbPano.classList.remove("active");
  }

  function show() {
    var img = images[current];
    destroyPano();

    if (img.is360 && window.PanoViewer) {
      // Spherical panorama: hide the flat <img>, mount the WebGL sphere viewer.
      lbImg.style.display = "none";
      lbPano.classList.add("active");
      try { pano = window.PanoViewer.mount(lbPano, img.full); }
      catch (err) { lbImg.style.display = ""; lbPano.classList.remove("active"); showFlat(img); }
    } else {
      showFlat(img);
    }

    setCaption(img);
    lbPrev.style.visibility = current > 0 ? "visible" : "hidden";
    lbNext.style.visibility = current < images.length - 1 ? "visible" : "hidden";
    preloadNeighbours(current);
  }

  function showFlat(img) {
    lbImg.style.display = "";
    resetZoom();
    lbImg.classList.add("loading");
    lbImg.onload = function () { lbImg.classList.remove("loading"); };
    lbImg.src = (cache[current] && cache[current].src) || img.full;
    lbImg.alt = img.title || img.fileName;
  }

  function setCaption(img) {
    var meta = [];
    if (img.dateTaken) meta.push(img.dateTaken);
    if (img.camera) meta.push(img.camera);
    if (img.width && img.height) meta.push(img.width + "×" + img.height);
    var title = img.title ? "<b>" + esc(img.title) + "</b>" : "";
    var desc = img.description ? " " + esc(img.description) : "";
    var metaStr = meta.length ? " — " + esc(meta.join(" · ")) : "";
    lbCaption.innerHTML = title + desc + metaStr;
  }

  function next() { if (current < images.length - 1) { current++; show(); } }
  function prev() { if (current > 0) { current--; show(); } }

  lbNext.addEventListener("click", function (e) { e.stopPropagation(); next(); });
  lbPrev.addEventListener("click", function (e) { e.stopPropagation(); prev(); });
  lbClose.addEventListener("click", function (e) { e.stopPropagation(); close(); });

  // Click on the dark backdrop (not the image) closes.
  lb.addEventListener("click", function (e) {
    if (e.target === lb || e.target.classList.contains("lb-figure")) close();
  });

  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
  });

  // ---- Flat-image zoom (max 2:1) + pan, plus swipe-nav when not zoomed ----
  var MAX_ZOOM = 2, zoom = 1, panX = 0, panY = 0;

  function applyZoom() {
    lbImg.style.transformOrigin = "center center";
    lbImg.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + zoom + ")";
    lbImg.style.cursor = zoom > 1 ? "grab" : "";
  }
  function resetZoom() { zoom = 1; panX = 0; panY = 0; applyZoom(); }
  function clampPan() {
    var mx = lbImg.offsetWidth * (zoom - 1) / 2;
    var my = lbImg.offsetHeight * (zoom - 1) / 2;
    panX = Math.max(-mx, Math.min(mx, panX));
    panY = Math.max(-my, Math.min(my, panY));
  }

  lb.addEventListener("wheel", function (e) {
    if (pano) return; // 360 viewer handles its own zoom
    e.preventDefault();
    zoom = Math.min(MAX_ZOOM, Math.max(1, zoom + (e.deltaY > 0 ? -0.2 : 0.2)));
    if (zoom === 1) { panX = 0; panY = 0; }
    clampPan(); applyZoom();
  }, { passive: false });

  lbImg.addEventListener("dblclick", function (e) {
    e.preventDefault(); e.stopPropagation();
    cancelTap();
    if (zoom > 1) resetZoom(); else { zoom = MAX_ZOOM; applyZoom(); }
  });

  // Drag: pans when zoomed, otherwise a swipe navigates.
  var downX = 0, downY = 0, dragX = 0, dragY = 0, dragging = false, moved = false;
  lb.addEventListener("pointerdown", function (e) {
    if (e.target === lbPrev || e.target === lbNext || e.target === lbClose) return;
    if (pano) return; // 360 viewer owns drag-to-look
    downX = e.clientX; downY = e.clientY; dragX = e.clientX; dragY = e.clientY;
    dragging = true; moved = false;
  });
  lb.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    if (Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8) moved = true;
    if (zoom <= 1) return;
    panX += e.clientX - dragX; panY += e.clientY - dragY;
    dragX = e.clientX; dragY = e.clientY;
    clampPan(); applyZoom();
  });
  lb.addEventListener("pointerup", function (e) {
    if (!dragging) return;
    dragging = false;
    if (zoom > 1) return; // was panning, not a swipe
    var dx = e.clientX - downX;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
  });
  lb.addEventListener("pointercancel", function () { dragging = false; });

  // ---- Click the image to toggle browser fullscreen (nav still works there) ----
  var tapTimer = null;
  function cancelTap() { if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; } }
  function tapFullscreen() {
    if (moved || tapTimer) return; // ignore drags / the second click of a dbl-click
    tapTimer = setTimeout(function () { tapTimer = null; toggleFullscreen(lb); }, 250);
  }
  lbImg.addEventListener("click", function (e) { e.stopPropagation(); tapFullscreen(); });
  lbPano.addEventListener("click", function (e) { e.stopPropagation(); tapFullscreen(); });
  lbPano.addEventListener("dblclick", cancelTap); // pano dbl-click resets its own view

  function toggleFullscreen(el) {
    var d = document;
    var cur = d.fullscreenElement || d.webkitFullscreenElement;
    var fn = cur ? (d.exitFullscreen || d.webkitExitFullscreen).call(d)
                 : (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if (fn && fn.catch) fn.catch(function () {}); // ignore if the browser blocks fullscreen
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
