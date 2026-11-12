/* The games' living backdrops on the page: Pocket Edition's parallax scenes (its scripts/view/backdrop.gd, line for
   line, by day or at dusk by the visitor's clock: each layer drifting at its own speed, wrapping, its frames running, shifting a little with the pointer as the
   game's do with the deck), drawn in whole pixels at a whole-number scale, with a world's flood water along the foot.

   <canvas class="scene" data-scene="tideglass-above" data-water="tideglass"></canvas>

   Still for anyone who asks for less motion (prefers-reduced-motion), and only running while on screen. */
(function () {
  "use strict";
  var FOLLOW_PX = 100;  // (backdrop.gd's: a layer with follow=1 shifts this far as the deck crosses half the field)
  var WATER = { frames: 8, rate: 8, w: 256, h: 11 };  // (every world's flood surface: 8 frames of 256 x 11, at 8 fps)
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var images = {};
  // (day from seven till five by the visitor's own clock, dusk's frames the rest: its sunset, its stars and lit windows;
  //  ?day or ?dusk in the address to see either)
  var hour = new Date().getHours();
  var DUSK = /[?&]dusk/.test(location.search) ? 5 : /[?&]day/.test(location.search) ? 4 : (hour >= 7 && hour < 17 ? 4 : 5);
  var follow = 0, aim = 0;

  function image(src) {
    if (!images[src]) {
      var im = new Image();
      im.src = src;
      images[src] = new Promise(function (done) {
        im.onload = function () { done(im); };
        im.onerror = function () { done(null); };
      });
    }
    return images[src];
  }

  function mod(a, n) { return ((a % n) + n) % n; }

  function Scene(canvas, data, atlas, surface, body) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.data = data;
    this.atlas = atlas;
    this.surface = surface;
    this.body = body;
    this.visible = true;
    this.fit();
  }

  Scene.prototype.fit = function () {
    var box = this.canvas.parentNode.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var tall = this.data.height + (this.surface ? 6 : 0);
    // (whole pixels: the scene covers the box's height, and never smaller than 2 of the page's pixels to one of its own,
    //  so a short box on a phone shows it cropped from the top rather than tiny)
    var px = Math.max(Math.floor(box.height * dpr / tall), Math.ceil(2 * dpr));
    this.w = Math.ceil(box.width * dpr / px);
    this.h = Math.ceil(box.height * dpr / px);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = (this.w * px / dpr) + "px";
    this.canvas.style.height = (this.h * px / dpr) + "px";
    this.ctx.imageSmoothingEnabled = false;
  };

  Scene.prototype.draw = function (t) {
    var c = this.ctx, d = this.data, W = this.w, H = this.h;
    var sea = this.surface ? H - WATER.h - 3 : H;
    var base = sea - d.height + (this.surface ? 6 : 0);
    var x0 = Math.round((W - 384) / 2);
    c.clearRect(0, 0, W, H);
    var sky = d.layers[0][DUSK][0];  // (past the scene's top, its sky carried on up: the back layer's top row)
    if (base + sky[5] > 0) {
      for (var sx = x0 + sky[4] - Math.ceil((x0 + sky[4]) / sky[2]) * sky[2]; sx < W; sx += sky[2])
        c.drawImage(this.atlas, sky[0], sky[1], sky[2], 1, sx, 0, sky[2], base + sky[5]);
    }
    for (var i = 0; i < d.layers.length; i++) {
      var L = d.layers[i];
      var x = Math.round(t * L[0] + follow * L[1] * FOLLOW_PX);
      var run = L[DUSK];
      var fr = L[2] ? run[Math.floor(t * L[2]) % run.length] : run[0];
      var wrap = L[3];
      var start = -mod(x, wrap);
      while (x0 + start + wrap > 0) start -= wrap;
      for (; x0 + start < W; start += wrap)
        c.drawImage(this.atlas, fr[0], fr[1], fr[2], fr[3], x0 + start + fr[4], base + fr[5], fr[2], fr[3]);
    }
    if (this.surface) {  // (the pad's little sea, play_view.gd _pad_water: the body, its painted surface over it)
      var f = Math.floor(t * WATER.rate) % WATER.frames;
      var top = sea + Math.floor(WATER.h / 2);
      for (var bx = 0; bx < W; bx += this.body.width)
        for (var by = top; by < H; by += this.body.height)
          c.drawImage(this.body, bx, by);
      for (var wx = 0; wx < W; wx += WATER.w)
        c.drawImage(this.surface, f * WATER.w, 0, WATER.w, WATER.h, wx, sea, WATER.w, WATER.h);
    }
  };

  function start(scenes) {
    var all = [];
    var canvases = document.querySelectorAll("canvas.scene");
    Array.prototype.forEach.call(canvases, function (canvas) {
      var data = scenes[canvas.dataset.scene];
      if (!data) return;
      var water = canvas.dataset.water;
      Promise.all([
        image(data.image),
        water ? image("art/water_" + water + "_surface.png") : null,
        water ? image("art/water_" + water + "_body.png") : null
      ]).then(function (got) {
        if (!got[0]) return;
        var s = new Scene(canvas, data, got[0], got[1], got[2]);
        s.draw(0);
        canvas.classList.add("ready");
        all.push(s);
        if ("ResizeObserver" in window) {  // (its box settling as the page lays out, fonts arriving, a window resized)
          new ResizeObserver(function () { s.fit(); s.draw(s.t || 0); }).observe(canvas.parentNode);
        }
        if ("IntersectionObserver" in window) {
          new IntersectionObserver(function (seen) { s.visible = seen[0].isIntersecting; }).observe(canvas);
        }
      });
    });

    var t0 = performance.now();
    function tick(now) {
      follow += (aim - follow) * 0.04;
      var t = (now - t0) / 1000;
      for (var i = 0; i < all.length; i++) if (all[i].visible) { all[i].t = t; all[i].draw(t); }
      requestAnimationFrame(tick);
    }
    if (!still) {
      window.addEventListener("pointermove", function (e) { aim = (e.clientX / window.innerWidth) * 2 - 1; }, { passive: true });
      requestAnimationFrame(tick);
    }
  }

  fetch("art/scenes.json").then(function (r) { return r.json(); }).then(start).catch(function () {});
})();
