/* The page's brickwork, breakable: the course of bricks under the film, and the bars at the seams between its worlds
   (a sector level's bar between its two screens: Rebounded's worlds/second_screen.py BAR_TOP and BAR_LOW, two rows
   in a checkerboard of the world's tough brick and its cargo, each brick shimmering through its own frames). Click or
   tap a brick and it breaks as Rebounded's stone does (render/bits.py debris 'stone': seven chips in its colours flung
   up and falling, a little dust), and a few seconds later it settles back into place. The course's light (the glint
   running along it now and then) drawn here too, so a gap never catches it. Every pattern centred on the page.

   <div class="bricks"></div>                    img/bricks.png, 20 bricks of 16 x 8
   <div class="bar" data-world="tideglass"></div> art/bars.json's world, two rows
   (at three times size; without this script the page shows each as a still background) */
(function () {
  "use strict";
  var BRICK = 16, TALL = 8, ROOM = 40;  // (ROOM: art px above and below for the chips to fly in)
  var BACK = 4.5;                                  // s until a broken brick settles back
  var GRAVITY = 220, CHIPS = 7;                    // (bits.py GRAVITY['chip'], debris 'stone')
  var GLINT = { every: 12, delay: 3, travel: 0.22, band: 50 };  // (the CSS .bricks::after it replaces)
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mod(a, n) { return ((a % n) + n) % n; }

  function load(src) {
    return new Promise(function (done) {
      var im = new Image();
      im.onload = function () { done(im); };
      im.onerror = function () { done(null); };
      im.src = src;
    });
  }

  function colours(im, spots) {  // each brick's colour (its middle), a shade darker and lighter (bits.py mix)
    var c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    var g = c.getContext("2d");
    g.drawImage(im, 0, 0);
    return spots.map(function (s) {
      var p = g.getImageData(s[0], s[1], 1, 1).data;
      var mid = [p[0], p[1], p[2]];
      return [mid, mid.map(function (v) { return Math.round(v * 0.55); }),
              mid.map(function (v) { return Math.round(v + (255 - v) * 0.5); })];
    });
  }

  // ----- the kinds of brickwork: which brick is where, and its picture now -----
  function course(art) {
    var n = art.width / BRICK, spots = [];
    for (var i = 0; i < n; i++) spots.push([i * BRICK + 8, 3]);
    var shades = colours(art, spots);
    return {
      rows: 1, glint: true,
      brick: function (c) { var k = mod(c, n); return { sx: k * BRICK, sy: 0, shade: shades[k] }; },
      art: art
    };
  }

  function bar(art, info) {
    var shades = colours(art, [[8, 3], [8, 11], [8, 19]]);  // ('S', '3', '6': tough1, motif2, motif5)
    var frames = info.frames, ms = info.ms;
    return {
      rows: 2, glint: false,
      brick: function (c, r, t) {
        var ch = r === 0 ? (mod(c, 2) === 0 ? 0 : (mod(Math.floor(c / 2), 2) === 0 ? 1 : 2))
                         : (mod(c, 2) === 1 ? 0 : (mod(Math.floor(c / 2), 2) === 0 ? 2 : 1));
        var f = still ? 0 : mod(Math.floor(t * 1000 / ms) + c * 3 + r * 5, frames);  // (its shimmer, along the bar)
        return { sx: f * BRICK, sy: ch * TALL, shade: shades[ch] };
      },
      art: art
    };
  }

  Promise.all([load("img/bricks.png"), fetch("art/bars.json").then(function (r) { return r.json(); }).catch(function () { return {}; })])
    .then(function (got) {
      if (got[0]) Array.prototype.forEach.call(document.querySelectorAll(".bricks"), function (el) { live(el, course(got[0])); });
      var book = got[1];
      Array.prototype.forEach.call(document.querySelectorAll(".bar[data-world]"), function (el) {
        var info = book[el.dataset.world];
        if (info) load(info.image).then(function (im) { if (im) live(el, bar(im, info)); });
      });
    });

  function live(strip, kind) {
    var canvas = document.createElement("canvas");
    canvas.className = "bricks-live";
    canvas.setAttribute("aria-hidden", "true");
    strip.appendChild(canvas);
    strip.classList.add("live");
    var ctx = canvas.getContext("2d");
    var light = document.createElement("canvas");  // (the glint, cut to the bricks before it's laid on them)
    var lctx = light.getContext("2d");
    var tall = kind.rows * TALL;
    var broken = {}, bits = [], W = 0, mid = 0, SCALE = 3, t0 = performance.now(), prev = t0;

    function fit() {
      SCALE = parseFloat(getComputedStyle(strip).getPropertyValue("--scale")) || 3;  // (the page's: 2 on a phone)
      W = Math.ceil(strip.getBoundingClientRect().width / SCALE);
      mid = Math.floor(W / 2) - BRICK / 2;  // (brick 0 in the middle of the page: every pattern lined up on it)
      canvas.width = light.width = W;
      canvas.height = light.height = tall + ROOM * 2;
      canvas.style.width = (W * SCALE) + "px";
      canvas.style.height = (canvas.height * SCALE) + "px";
      canvas.style.top = (-ROOM * SCALE) + "px";
      ctx.imageSmoothingEnabled = false;
      draw(performance.now());
    }

    function glintAt(t) {  // where the light is along the strip (0..1), or null
      if (still || !kind.glint) return null;
      var k = ((t - GLINT.delay) % GLINT.every) / GLINT.every;
      if (t < GLINT.delay || k < 1 - GLINT.travel) return null;
      var u = (k - (1 - GLINT.travel)) / GLINT.travel;
      return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;  // (ease-in-out)
    }

    function draw(now) {
      var t = (now - t0) / 1000, dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var first = Math.floor(-mid / BRICK) - 1, last = Math.ceil((W - mid) / BRICK);
      for (var r = 0; r < kind.rows; r++) {
        for (var c = first; c <= last; c++) {
          var key = c + "," + r, gone = broken[key], dy = 0, alpha = 1;
          if (gone !== undefined) {
            var age = t - gone;
            if (age < BACK) continue;
            if (age < BACK + 0.3) { var k = (age - BACK) / 0.3; dy = -Math.round((1 - k) * 3); alpha = k; }  // settling back
            else delete broken[key];
          }
          var b = kind.brick(c, r, t);
          ctx.globalAlpha = alpha;
          ctx.drawImage(kind.art, b.sx, b.sy, BRICK, TALL, mid + c * BRICK, ROOM + r * TALL + dy, BRICK, TALL);
          ctx.globalAlpha = 1;
        }
      }
      var g = glintAt(t);
      if (g !== null) {
        lctx.clearRect(0, 0, W, light.height);
        lctx.globalCompositeOperation = "source-over";
        var x = -GLINT.band + g * (W + GLINT.band * 2);
        var grad = lctx.createLinearGradient(x - GLINT.band / 2, 0, x + GLINT.band / 2, 0);
        grad.addColorStop(0, "rgba(255,250,225,0)");
        grad.addColorStop(0.38, "rgba(255,250,225,.35)");
        grad.addColorStop(0.5, "rgba(255,250,225,.95)");
        grad.addColorStop(0.62, "rgba(255,250,225,.35)");
        grad.addColorStop(1, "rgba(255,250,225,0)");
        lctx.fillStyle = grad;
        lctx.fillRect(0, ROOM, W, tall);
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = "soft-light";
        ctx.drawImage(light, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }
      for (var i = bits.length - 1; i >= 0; i--) {
        var p = bits[i];
        p.age += dt;
        if (p.age >= p.life) { bits.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
        ctx.globalAlpha = Math.min(1, (p.life - p.age) / (p.life * 0.35));
        ctx.fillStyle = "rgb(" + p.col.join(",") + ")";
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        ctx.globalAlpha = 1;
      }
    }

    var seen = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { seen = e[0].isIntersecting; }, { rootMargin: "120px 0px" }).observe(strip);
    }
    function tick(now) {
      if (seen) draw(now);
      else prev = now;
      requestAnimationFrame(tick);
    }

    function burst(c, r) {
      var cols = kind.brick(c, r, 0).shade, cx = mid + c * BRICK + BRICK / 2, cy = ROOM + r * TALL + TALL / 2;
      if (still) return;
      for (var n = 0; n < CHIPS + 3; n++) {
        var dust = n >= CHIPS;  // (the last three: a little dust, drifting)
        var a = -Math.PI / 2 + (Math.random() - 0.5) * (dust ? Math.PI * 2 : Math.PI);
        var v = dust ? 6 + Math.random() * 10 : 30 + Math.random() * 45;
        bits.push({ x: cx + (Math.random() - 0.5) * 10, y: cy + (Math.random() - 0.5) * 4,
                    vx: Math.cos(a) * v, vy: Math.sin(a) * v * 1.2, g: dust ? -8 : GRAVITY,
                    life: dust ? 0.5 + Math.random() * 0.2 : 0.45 + Math.random() * 0.15, age: 0,
                    size: dust ? 1 : 2,
                    col: dust ? cols[2] : cols[Math.floor(Math.random() * 3)] });
      }
    }

    strip.addEventListener("click", function (e) {
      var box = strip.getBoundingClientRect();
      var c = Math.floor(((e.clientX - box.left) / SCALE - mid) / BRICK);
      var r = Math.max(0, Math.min(kind.rows - 1, Math.floor((e.clientY - box.top) / SCALE / TALL)));
      var key = c + "," + r;
      if (broken[key] !== undefined) return;
      broken[key] = (performance.now() - t0) / 1000;
      burst(c, r);
      if (still) draw(performance.now());
    });

    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(strip);
    fit();
    if (!still) requestAnimationFrame(tick);
    else setInterval(function () { draw(performance.now()); }, 500);  // (no motion: just its bricks coming back)
  }
})();
