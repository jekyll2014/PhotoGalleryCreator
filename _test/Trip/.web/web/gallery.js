/*
 * template1 gallery runtime.
 *
 * Reads the static data island (window.__GALLERY__) baked at generation time and drives:
 *   - a bottom thumbnail strip that loads the first N thumbs and lazy-loads the rest,
 *   - a big "stage" image for the current selection,
 *   - neighbour preloading (cacheRadius each side => 2 prev + current + 2 next by default),
 *   - navigation by arrows, keyboard, and swipe (pointer drag on desktop / finger on mobile),
 *   - subfolder tiles rendered as folder icons at the end of the strip.
 *
 * Everything here is client-side over pre-generated files; the server only serves static assets.
 */
(function () {
  "use strict";

  var data = window.__GALLERY__ || {};
  var images = data.images || [];
  var subfolders = data.subfolders || [];
  var settings = data.settings || {};
  var INITIAL = Math.max(1, settings.initialThumbnails || 10);
  var RADIUS = Math.max(0, settings.cacheRadius == null ? 2 : settings.cacheRadius);

  var stage = document.getElementById("stage");
  var stageImg = document.getElementById("stageImg");
  var caption = document.getElementById("stageCaption");
  var track = document.getElementById("stripTrack");
  var strip = document.getElementById("strip");
  var btnPrev = document.getElementById("navPrev");
  var btnNext = document.getElementById("navNext");

  var current = -1;
  var loadedThumbs = 0;      // count of image tiles rendered so far
  var tileEls = [];          // image tile elements by image index
  var cache = {};            // index -> preloaded Image (neighbour cache)

  if (images.length === 0 && subfolders.length === 0) {
    caption.textContent = "No images in this folder.";
    return;
  }

  // ---- Strip building -------------------------------------------------------

  // Folders render first, at the start of the strip.
  function renderFolders() {
    subfolders.forEach(function (f) {
      var a = document.createElement("a");
      a.className = "tile tile-folder";
      a.href = f.link;
      a.title = f.title || f.name;
      if (f.thumb) {
        var cover = document.createElement("span");
        cover.className = "folder-cover";
        var cimg = document.createElement("img");
        cimg.src = f.thumb;
        cimg.alt = "";
        cover.appendChild(cimg);
        a.appendChild(cover);
      }
      var icon = document.createElement("span");
      icon.className = "folder-icon";
      icon.textContent = "📁"; // 📁
      var name = document.createElement("span");
      name.className = "folder-name";
      name.textContent = f.title || f.name;
      a.appendChild(icon);
      a.appendChild(name);
      track.appendChild(a);
    });
  }

  function makeTile(index) {
    var img = images[index];
    var el = document.createElement("div");
    el.className = "tile";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.title = img.title || img.fileName;
    var im = document.createElement("img");
    im.loading = "lazy";
    im.src = img.thumb;
    im.alt = img.title || img.fileName;
    el.appendChild(im);
    el.addEventListener("click", function () { select(index); });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(index); }
    });
    return el;
  }

  // Ensure image tiles are rendered up to (and including) the given index.
  function ensureThumbs(upto) {
    var target = Math.min(images.length - 1, upto);
    while (loadedThumbs <= target) {
      var el = makeTile(loadedThumbs);
      tileEls[loadedThumbs] = el;
      track.appendChild(el); // folders already occupy the start of the strip
      loadedThumbs++;
    }
  }

  // Load more when the strip is scrolled near its right edge.
  strip.addEventListener("scroll", function () {
    if (loadedThumbs >= images.length) return;
    if (strip.scrollLeft + strip.clientWidth >= track.scrollWidth - 300) {
      ensureThumbs(loadedThumbs + INITIAL - 1);
    }
  });

  // ---- Neighbour cache ------------------------------------------------------

  function preloadNeighbours(index) {
    var lo = Math.max(0, index - RADIUS);
    var hi = Math.min(images.length - 1, index + RADIUS);
    for (var i = lo; i <= hi; i++) {
      if (!cache[i]) {
        var pre = new Image();
        pre.src = images[i].full;
        cache[i] = pre;
      }
    }
    // Evict anything outside the window to keep memory bounded (~5 images).
    Object.keys(cache).forEach(function (k) {
      var n = +k;
      if (n < lo || n > hi) delete cache[n];
    });
  }

  // ---- Selection / stage ----------------------------------------------------

  function select(index) {
    if (images.length === 0) return;
    index = Math.max(0, Math.min(images.length - 1, index));
    current = index;
    var img = images[index];

    stageImg.classList.add("loading");
    stageImg.onload = function () { stageImg.classList.remove("loading"); };
    stageImg.src = (cache[index] && cache[index].src) || img.full;
    stageImg.alt = img.title || img.fileName;

    var meta = [];
    if (img.dateTaken) meta.push(img.dateTaken);
    if (img.camera) meta.push(img.camera);
    if (img.width && img.height) meta.push(img.width + "×" + img.height);
    var title = img.title ? "<b>" + escapeHtml(img.title) + "</b>" : "";
    var desc = img.description ? " " + escapeHtml(img.description) : "";
    var metaStr = meta.length ? '<span class="meta"> — ' + escapeHtml(meta.join(" · ")) + "</span>" : "";
    caption.innerHTML = title + desc + metaStr;

    ensureThumbs(index + 1);
    markActive(index);
    preloadNeighbours(index);
  }

  function markActive(index) {
    for (var i = 0; i < tileEls.length; i++) {
      if (tileEls[i]) tileEls[i].classList.toggle("active", i === index);
    }
    var el = tileEls[index];
    if (el) el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  function next() { if (current < images.length - 1) select(current + 1); }
  function prev() { if (current > 0) select(current - 1); }

  // ---- Navigation: arrows, keyboard, swipe ---------------------------------

  btnPrev.addEventListener("click", function (e) { e.stopPropagation(); prev(); });
  btnNext.addEventListener("click", function (e) { e.stopPropagation(); next(); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
  });

  // Reveal edge arrows only as the cursor approaches an edge of the stage.
  stage.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var r = stage.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    stage.classList.toggle("show-prev", x < 0.18 && current > 0);
    stage.classList.toggle("show-next", x > 0.82 && current < images.length - 1);
  });
  stage.addEventListener("pointerleave", function () {
    stage.classList.remove("show-prev", "show-next");
  });

  // Swipe / drag on the stage.
  var dragX = null, dragging = false;
  stage.addEventListener("pointerdown", function (e) {
    if (e.target === btnPrev || e.target === btnNext) return;
    dragX = e.clientX; dragging = true;
  });
  stage.addEventListener("pointerup", function (e) {
    if (!dragging) return;
    dragging = false;
    var dx = e.clientX - dragX;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
  });
  stage.addEventListener("pointercancel", function () { dragging = false; });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- Boot -----------------------------------------------------------------

  renderFolders();            // folders first, at the start of the strip
  ensureThumbs(INITIAL - 1);
  if (images.length > 0) select(0);
})();
