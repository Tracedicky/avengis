/* The flood at the foot: Tideglass's water (its surface frames running, its body under them, as the game's pad
   water is laid: play_view.gd _pad_water) rising up the footer's town as the page nears its end, falling back as
   you scroll up. Still, half risen, for anyone who asks for less motion. */
(function () {
  "use strict";
  var water = document.querySelector(".flood i");
  if (!water) return;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NEAR = 700;  // px from the page's end where it starts to rise
  var level = 0, aim = 0, running = false;

  function style(name) { return parseFloat(getComputedStyle(water.parentNode).getPropertyValue(name)) || 0; }

  function set(px) {
    var step = style("--step") || 1;  // (whole art pixels)
    water.style.setProperty("--level", Math.round(px / step) * step + "px");
  }

  function measure() {
    var left = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    aim = Math.max(0, Math.min(1, 1 - left / NEAR)) * style("--rise");
  }

  function tick() {
    level += (aim - level) * 0.06;
    if (Math.abs(aim - level) < 0.5) level = aim;
    set(level);
    running = level !== aim;
    if (running) requestAnimationFrame(tick);
  }

  if (still) { set(style("--rise") / 2); return; }
  function moved() {
    measure();
    if (!running && level !== aim) { running = true; requestAnimationFrame(tick); }
  }
  window.addEventListener("scroll", moved, { passive: true });
  window.addEventListener("resize", moved);
  moved();
})();
