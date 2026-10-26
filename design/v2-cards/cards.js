(() => {
  const root = document.documentElement;
  const qs = new URLSearchParams(location.search);

  // Appearance
  document.querySelectorAll(".modes button").forEach((b) => b.addEventListener("click", () => {
    root.dataset.mode = b.dataset.mode;
    document.querySelectorAll(".modes button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  if (qs.get("mode") === "light") document.querySelector('.modes [data-mode="light"]').click();

  // Jump bar: keys 1-4 and the design in view
  const jumps = [...document.querySelectorAll(".jump a")];
  document.addEventListener("keydown", (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const j = jumps.find((a) => a.dataset.key === ev.key);
    if (j) { ev.preventDefault(); document.querySelector(j.getAttribute("href")).scrollIntoView({ behavior: "smooth" }); }
    if (ev.key === "Escape") closePops();
  });
  const seen = new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) jumps.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll(".opt").forEach((s) => seen.observe(s));

  // Popovers: sources and More
  function closePops(except) {
    document.querySelectorAll(".pop > button[aria-expanded='true']").forEach((b) => {
      if (b === except) return;
      b.setAttribute("aria-expanded", "false");
      b.nextElementSibling.hidden = true;
    });
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest(".pop > button");
    if (b) {
      ev.stopPropagation();
      const open = b.getAttribute("aria-expanded") !== "true";
      closePops(b);
      b.setAttribute("aria-expanded", String(open));
      b.nextElementSibling.hidden = !open;
      return;
    }
    if (ev.target.closest(".popbox.menu button")) { closePops(); return; }
    if (!ev.target.closest(".popbox")) closePops();
  });

  // Track and votes
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest(".btn.track");
    if (t) {
      const on = t.getAttribute("aria-pressed") !== "true";
      t.setAttribute("aria-pressed", String(on));
      t.querySelector("span").textContent = on ? "Tracking" : "Track";
      return;
    }
    const v = ev.target.closest(".votes button");
    if (v) {
      const box = v.closest(".votes"), n = box.querySelector("b");
      const was = box.querySelector("button.on");
      box.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      let val = 0;
      if (was !== v) { v.classList.add("on"); val = v.classList.contains("up") ? 1 : -1; }
      n.textContent = String(val);
    }
  });

  // Tiles open on tap (touch screens have no hover)
  document.addEventListener("click", (ev) => {
    const tile = ev.target.closest(".tileB");
    if (!tile || ev.target.closest("a, button")) return;
    if (matchMedia("(hover: none)").matches) tile.classList.toggle("open");
  });

  // Media: silent hover previews, Play with sound, full screen. Controls live in the bar.
  const isFile = location.protocol === "file:";
  function videoFor(media) {
    let v = media.querySelector("video");
    if (!v) {
      v = document.createElement("video");
      v.className = media.dataset.fit || "cover";
      v.src = media.dataset.mp4;
      v.playsInline = true; v.muted = true; v.loop = true; v.preload = "none";
      v.addEventListener("pause", () => { const art = media.closest("article"); art.classList.remove("playing"); setPlayLabel(art, false); });
      media.appendChild(v);
    }
    return v;
  }
  function ytOpen(media) { window.open("https://www.youtube.com/watch?v=" + media.dataset.yt, "_blank", "noopener"); }
  function ytFrame(media) {
    let f = media.querySelector("iframe");
    if (!f) {
      f = document.createElement("iframe");
      f.allow = "autoplay; fullscreen; encrypted-media";
      f.src = "https://www.youtube-nocookie.com/embed/" + media.dataset.yt + "?autoplay=1&controls=0&enablejsapi=1&rel=0";
      media.appendChild(f);
    }
    return f;
  }
  function setPlayLabel(art, playing) {
    const b = art.querySelector(".mb.play span");
    if (b) b.textContent = playing ? "Pause" : "Play";
  }
  function play(media) {
    const art = media.closest("article");
    if (media.dataset.kind === "yt") {
      if (isFile) return ytOpen(media);
      ytFrame(media); art.classList.add("playing"); setPlayLabel(art, true); return;
    }
    const v = videoFor(media);
    if (!v.paused && !v.muted) { v.pause(); setPlayLabel(art, false); return; }
    v.muted = false; v.loop = false; v.currentTime = v.ended ? 0 : v.currentTime;
    art.classList.add("playing"); setPlayLabel(art, true);
    v.play().catch(() => { art.classList.remove("playing"); setPlayLabel(art, false); });
  }
  function full(media) {
    if (media.dataset.kind === "yt" && isFile) return ytOpen(media);
    const el = media.querySelector("video, iframe") || media;
    if (media.dataset.kind === "mp4" && el.tagName === "VIDEO" && el.paused) play(media);
    (el.requestFullscreen || el.webkitRequestFullscreen || el.webkitEnterFullscreen).call(el);
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest(".mb");
    if (!b) return;
    const media = b.closest("article").querySelector(".media");
    b.classList.contains("play") ? play(media) : full(media);
  });
  document.querySelectorAll('.media[data-kind="yt"], .media[data-kind="mp4"]').forEach((m) => {
    m.addEventListener("dblclick", () => full(m));
    if (m.dataset.hover) {
      m.addEventListener("mouseenter", () => { const v = videoFor(m); if (v.muted) v.play().catch(() => {}); });
      m.addEventListener("mouseleave", () => { const v = m.querySelector("video"); if (v && v.muted) v.pause(); });
    }
  });
  document.addEventListener("ended", (ev) => {
    const art = ev.target.closest && ev.target.closest("article");
    if (art) { art.classList.remove("playing"); setPlayLabel(art, false); }
  }, true);

  // D: the New strip fills once when it appears. Here it replays every 6 s.
  const strips = [...document.querySelectorAll(".strip.new")];
  const at = qs.get("at");
  if (at !== null) {
    root.classList.add("frozen");
    root.style.setProperty("--at", String(parseFloat(at) || 0));
    strips.forEach((s) => s.classList.add("play"));
  } else {
    const live = new Set();
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { if (!live.has(en.target)) { live.add(en.target); replay(en.target); } }
      else live.delete(en.target);
    }), { threshold: 0.5 });
    strips.forEach((s) => io.observe(s));
    function replay(s) { s.classList.remove("play"); void s.offsetWidth; s.classList.add("play"); }
    setInterval(() => { if (!document.hidden) live.forEach(replay); }, 6000);
  }
})();
