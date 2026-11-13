/* A page's title laid in brick by brick as it opens: Rebounded's splash (rebounded/render/frontend.py draw_logo and
   the splash's born()): each letter's bricks falling in from above, its bottom rows first, landing with a little
   bounce; its mortar setting in as its last brick lands, a puff of brick dust; one letter after another, one word
   after another (AVENGIS then GAMES); then its line stamped in under them.

   <h1 class="mark"><span class="logo" data-build="avengis" data-at="0">...   (art/build.json's, from data-at s)

   Never for anyone who asks for less motion: the <head> only hides the title for it (html.building) when it will run,
   and lets it go after a few seconds whatever happens; html[data-built] names the visit's note (sessionStorage) that
   it's been seen, so a page plays it once a visit. Tells the page when it's done (the 'avengis:built' event). */
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("building")) return;
  clearTimeout(window.buildSafety);  // (from here this script lets the mark go, whatever happens)
  if (document.hidden) { root.classList.remove("building"); return; }  // (opened in a tab behind: no show to miss)

  var FALL = 0.32;                  // s a brick takes to fall in
  var LAND = 0.35, STEP = 0.1;      // (frontend.py SPLASH_LAND, SPLASH_STEP) the first letter's landing; each next
  var ABOVE = 62, SIDE = 20, BELOW = 8;  // room round the logo for the falling bricks and the dust
  var DUST = [[150, 120, 80], [110, 90, 60]];

  function finish() {
    root.classList.remove("building");
    try { if (root.dataset.built) sessionStorage.setItem(root.dataset.built, "1"); } catch (e) {}
    document.dispatchEvent(new CustomEvent("avengis:built"));
  }

  function ease(k) {  // (frontend.py ease_drop: how far down a falling brick is, a little bounce as it lands)
    if (k >= 1) return 1;
    if (k < 0.8) return Math.pow(k / 0.8, 2);
    return 1 - Math.sin((k - 0.8) / 0.2 * Math.PI) * 0.06;
  }

  function Logo(host, data, atlas, start) {
    var img = host.querySelector("img");
    var scale = img.getBoundingClientRect().width / data.w;
    this.data = data;
    this.atlas = atlas;
    this.start = start;
    this.dust = [];
    this.landed = {};
    var c = this.canvas = document.createElement("canvas");
    c.width = data.w + SIDE * 2;
    c.height = data.h + ABOVE + BELOW;
    c.className = "building-canvas";
    c.setAttribute("aria-hidden", "true");
    c.style.width = (c.width * scale) + "px";
    c.style.height = (c.height * scale) + "px";
    c.style.left = (-SIDE * scale) + "px";
    c.style.top = (-ABOVE * scale) + "px";
    host.appendChild(c);
    this.ctx = c.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
  }

  Logo.prototype.draw = function (t, dt) {
    var c = this.ctx, d = this.data, a = this.atlas, t0 = t - this.start;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (var li = 0; li < d.letters.length; li++) {
      var L = d.letters[li];
      var lands = LAND + li * STEP;
      var born = function (by) { return t0 - (lands - (28 - by) * 0.004 - FALL); };
      var last = born(0);
      if (last >= FALL) {  // its mortar, setting in as it lands
        c.globalAlpha = Math.min(1, (last - FALL) / 0.18);
        c.drawImage(a, li * d.setting[0], 0, d.setting[0], d.setting[1], SIDE + L.x, ABOVE, d.setting[0], d.setting[1]);
        c.globalAlpha = 1;
      }
      if (t0 >= lands && !this.landed[li]) {  // a puff of brick dust as it lands
        this.landed[li] = true;
        for (var i = 0; i < 6; i++) {
          var ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 10 + Math.random() * 20;
          this.dust.push({ x: SIDE + L.x + d.setting[0] / 2, y: ABOVE + d.h - 4, vx: Math.cos(ang) * sp * 1.6,
                           vy: Math.sin(ang) * sp, life: 0.4 + Math.random() * 0.3, age: 0, col: DUST[i % 2] });
        }
      }
      for (var b = 0; b < L.bricks.length; b++) {
        var B = L.bricks[b], age = born(B[1]);
        if (age < 0) continue;
        var dy = -Math.round((1 - ease(Math.min(1, age / FALL))) * (B[1] + 60));
        var s = B[2] ? d.double : d.single;
        c.drawImage(a, s[0], 0, s[1], s[2], SIDE + B[0], ABOVE + B[1] + dy, s[1], s[2]);
      }
    }
    for (var k = this.dust.length - 1; k >= 0; k--) {
      var p = this.dust[k];
      p.age += dt;
      if (p.age >= p.life) { this.dust.splice(k, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt;
      c.fillStyle = "rgba(" + p.col.join(",") + "," + Math.min(1, (p.life - p.age) / (p.life * 0.4)) + ")";
      c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  };

  function run(book) {
    var parts = Array.prototype.map.call(document.querySelectorAll(".mark [data-build]"), function (el) {
      return [el, book[el.dataset.build], parseFloat(el.dataset.at || "0")];
    });
    if (!parts.length || parts.some(function (p) { return !p[1] || !p[0].querySelector("img").getBoundingClientRect().width; })) {
      finish();
      return;
    }
    Promise.all(parts.map(function (p) {
      return new Promise(function (done) {
        var im = new Image();
        im.onload = function () { done(im); };
        im.onerror = function () { done(null); };
        im.src = p[1].image;
      });
    })).then(function (atlases) {
      if (atlases.some(function (a) { return !a; })) { finish(); return; }
      var logos = parts.map(function (p, i) { return new Logo(p[0], p[1], atlases[i], p[2]); });
      var whole = Math.max.apply(null, parts.map(function (p) { return p[2] + LAND + (p[1].letters.length - 1) * STEP; }));
      var TAGLINE = whole + 0.45, DONE = TAGLINE + 0.55;  // (its line stamped in once the last letter's down)
      var tagline = document.querySelector(".tagline");
      var t0 = null, prev = null;
      var ended = false;
      function end() {
        if (ended) return;
        ended = true;
        logos.forEach(function (l) { l.canvas.remove(); });  // (whole now: the logo itself, its shine, in their place)
        if (tagline) tagline.classList.add("stamped");
        finish();
      }
      document.addEventListener("visibilitychange", function () { if (document.hidden) end(); });
      function tick(now) {
        if (ended) return;
        if (t0 === null) t0 = prev = now;
        var t = (now - t0) / 1000, dt = Math.min(0.05, (now - prev) / 1000);
        prev = now;
        logos.forEach(function (l) { l.draw(t, dt); });
        if (t >= TAGLINE && tagline && !tagline.classList.contains("stamped")) tagline.classList.add("stamped");
        if (t < DONE) { requestAnimationFrame(tick); return; }
        end();
      }
      requestAnimationFrame(tick);
    });
  }

  fetch("art/build.json").then(function (r) { return r.json(); }).then(run).catch(finish);
})();
