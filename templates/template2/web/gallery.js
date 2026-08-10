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

  var current = -1;
  var cache = {}; // index -> preloaded Image

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
      if (!cache[i]) { var p = new Image(); p.src = images[i].full; cache[i] = p; }
    }
    Object.keys(cache).forEach(function (k) {
      var n = +k; if (n < lo || n > hi) delete cache[n];
    });
  }

  // ---- Lightbox --------------------------------------------------------------

  function open(index) {
    current = Math.max(0, Math.min(images.length - 1, index));
    show();
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function show() {
    var img = images[current];
    lbImg.classList.add("loading");
    lbImg.onload = function () { lbImg.classList.remove("loading"); };
    lbImg.src = (cache[current] && cache[current].src) || img.full;
    lbImg.alt = img.title || img.fileName;

    var meta = [];
    if (img.dateTaken) meta.push(img.dateTaken);
    if (img.camera) meta.push(img.camera);
    if (img.width && img.height) meta.push(img.width + "×" + img.height);
    var title = img.title ? "<b>" + esc(img.title) + "</b>" : "";
    var desc = img.description ? " " + esc(img.description) : "";
    var metaStr = meta.length ? " — " + esc(meta.join(" · ")) : "";
    lbCaption.innerHTML = title + desc + metaStr;

    lbPrev.style.visibility = current > 0 ? "visible" : "hidden";
    lbNext.style.visibility = current < images.length - 1 ? "visible" : "hidden";
    preloadNeighbours(current);
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

  // Swipe / drag inside the lightbox.
  var dragX = null, dragging = false;
  lb.addEventListener("pointerdown", function (e) {
    if (e.target === lbPrev || e.target === lbNext || e.target === lbClose) return;
    dragX = e.clientX; dragging = true;
  });
  lb.addEventListener("pointerup", function (e) {
    if (!dragging) return;
    dragging = false;
    var dx = e.clientX - dragX;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
  });
  lb.addEventListener("pointercancel", function () { dragging = false; });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
