/* The course of bricks, breakable: click or tap a brick and it breaks as Rebounded's stone does (render/bits.py
   debris 'stone': seven chips in its colours flung up and falling, a little dust), and a few seconds later it settles
   back into place. The strip's light (the glint running along it now and then) drawn here too, so a gap never
   catches it.

   <div class="bricks"></div>   (img/bricks.png, 20 bricks of 16 x 8, at three times size; without this script the
                                 page shows it as a plain background) */
(function () {
  "use strict";
  var SCALE = 3, BRICK = 16, TALL = 8, ROOM = 40;  // (ROOM: art px above and below for the chips to fly in)
  var BACK = 4.5;                                  // s until a broken brick settles back
  var GRAVITY = 220, CHIPS = 7;                    // (bits.py GRAVITY['chip'], debris 'stone')
  var GLINT = { every: 12, delay: 3, travel: 0.22, band: 50 };  // (the CSS .bricks::after it replaces)
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var art = new Image();
  art.src = "img/bricks.png";
  art.onload = function () {
    var shades = colours(art);
    Array.prototype.forEach.call(document.querySelectorAll(".bricks"), function (strip) { live(strip, shades); });
  };

  function colours(im) {  // each brick's colour (its middle), a shade darker and lighter (bits.py mix)
    var c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    var g = c.getContext("2d");
    g.drawImage(im, 0, 0);
    var out = [];
    for (var i = 0; i < im.width / BRICK; i++) {
      var p = g.getImageData(i * BRICK + 8, 3, 1, 1).data;
      var mid = [p[0], p[1], p[2]];
      out.push([mid, mid.map(function (v) { return Math.round(v * 0.55); }),
                mid.map(function (v) { return Math.round(v + (255 - v) * 0.5); })]);
    }
    return out;
  }

  function live(strip, shades) {
    var canvas = document.createElement("canvas");
    canvas.className = "bricks-live";
    canvas.setAttribute("aria-hidden", "true");
    strip.appendChild(canvas);
    strip.classList.add("live");
    var ctx = canvas.getContext("2d");
    var light = document.createElement("canvas");  // (the glint, cut to the bricks before it's laid on them)
    var lctx = light.getContext("2d");
    var broken = {}, bits = [], W = 0, t0 = performance.now(), prev = t0, running = false;

    function fit() {
      W = Math.ceil(strip.getBoundingClientRect().width / SCALE);
      canvas.width = light.width = W;
      canvas.height = light.height = TALL + ROOM * 2;
      canvas.style.width = (W * SCALE) + "px";
      canvas.style.height = (canvas.height * SCALE) + "px";
      canvas.style.top = (-ROOM * SCALE) + "px";
      ctx.imageSmoothingEnabled = false;
      draw(performance.now());
    }

    function glintAt(t) {  // where the light is along the strip (0..1), or null
      if (still) return null;
      var k = ((t - GLINT.delay) % GLINT.every) / GLINT.every;
      if (t < GLINT.delay || k < 1 - GLINT.travel) return null;
      var u = (k - (1 - GLINT.travel)) / GLINT.travel;
      return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;  // (ease-in-out)
    }

    function draw(now) {
      var t = (now - t0) / 1000, dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var n = Math.ceil(W / BRICK);
      for (var i = 0; i < n; i++) {
        var gone = broken[i], dy = 0, alpha = 1;
        if (gone !== undefined) {
          var age = t - gone;
          if (age < BACK) continue;
          if (age < BACK + 0.3) { var k = (age - BACK) / 0.3; dy = -Math.round((1 - k) * 3); alpha = k; }  // settling back in
          else delete broken[i];
        }
        var sx = (i % (art.width / BRICK)) * BRICK;
        ctx.globalAlpha = alpha;
        ctx.drawImage(art, sx, 0, BRICK, TALL, i * BRICK, ROOM + dy, BRICK, TALL);
        ctx.globalAlpha = 1;
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
        lctx.fillRect(0, ROOM, W, TALL);
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = "soft-light";
        ctx.drawImage(light, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }
      for (var b = bits.length - 1; b >= 0; b--) {
        var p = bits[b];
        p.age += dt;
        if (p.age >= p.life) { bits.splice(b, 1); continue; }
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

    function burst(i) {
      var cols = shades[i % shades.length], cx = i * BRICK + BRICK / 2, cy = ROOM + TALL / 2;
      if (still) return;
      for (var c = 0; c < CHIPS + 3; c++) {
        var dust = c >= CHIPS;  // (the last three: a little dust, drifting)
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
      var r = strip.getBoundingClientRect();
      var i = Math.floor((e.clientX - r.left) / SCALE / BRICK);
      if (broken[i] !== undefined) return;
      broken[i] = (performance.now() - t0) / 1000;
      burst(i);
      if (still) draw(performance.now());
    });

    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(strip);
    fit();
    if (!still) requestAnimationFrame(tick);
    else setInterval(function () { draw(performance.now()); }, 500);  // (no motion: just its bricks coming back)
  }
})();
