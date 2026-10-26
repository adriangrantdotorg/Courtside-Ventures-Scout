(() => {
  const root = document.documentElement;
  const qs = new URLSearchParams(location.search);
  const MEDIA = JSON.parse(document.getElementById("x-media").textContent);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---- preview strip: page note, theme, and the three option sets (?f= ?h= ?o=) ----
  const note = document.body.dataset.note;
  if (note) $("#pvnote").textContent = note;
  function setTheme(t) {
    root.dataset.theme = t;
    $$(".x-modes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === t)));
  }
  $$(".x-modes button").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.theme)));
  const chip = $("[data-theme-chip]");
  if (chip) chip.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));
  if (qs.get("theme") === "light") setTheme("light");

  function carryParams() {
    const p = new URLSearchParams();
    ["f", "h", "o", "w"].forEach((k) => p.set(k, root.dataset[k]));
    if (root.dataset.theme === "light") p.set("theme", "light");
    $$(".x-preview nav a, a[href$='.html'], a[href*='.html?']").forEach((a) => {
      const base = a.getAttribute("href").split("?")[0];
      if (!base.endsWith(".html")) return;
      const own = new URLSearchParams(a.getAttribute("href").split("?")[1] || "");
      const merged = new URLSearchParams(p); own.forEach((v, k) => merged.set(k, v));
      a.setAttribute("href", base + "?" + merged.toString());
    });
  }
  function setOpt(k, v) {
    root.dataset[k] = v;
    $$(`.x-sw[data-sw="${k}"] button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    const u = new URL(location.href); u.searchParams.set(k, v); history.replaceState(null, "", u);
    carryParams();
    applyFilter();
  }
  $$(".x-sw button").forEach((b) => b.addEventListener("click", () => setOpt(b.closest(".x-sw").dataset.sw, b.dataset.v)));

  // Money Moves menu in the live header
  $$(".nav .dd > button").forEach((b) => b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const m = b.nextElementSibling, open = m.hidden;
    m.hidden = !open; b.setAttribute("aria-expanded", String(open));
  }));

  // Tracking's tabs (the live page switches panels the same way)
  $$(".tabs button[id^='tab-']").forEach((b) => b.addEventListener("click", () => {
    $$(".tabs button[id^='tab-']").forEach((x) => {
      const on = x === b;
      x.setAttribute("aria-selected", String(on)); x.classList.toggle("on", on);
      const panel = document.getElementById("panel-" + x.id.slice(4)); if (panel) panel.hidden = !on;
    });
  }));

  // ---- popovers: sources, signals, More, filter menus ----
  function closePops(except) {
    $$(".x-pop > button[aria-expanded='true']").forEach((b) => {
      if (b === except) return;
      b.setAttribute("aria-expanded", "false");
      b.nextElementSibling.hidden = true;
    });
    $$(".nav .dd .menu").forEach((m) => { m.hidden = true; });
  }
  // A popover opens downward unless the card it sits in (which clips) or the window would cut it off
  function place(box) {
    box.classList.remove("up", "left");
    const r = box.getBoundingClientRect(), btn = box.previousElementSibling.getBoundingClientRect();
    const clip = box.closest(".x-tile"), cr = clip ? clip.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    const below = Math.min(innerHeight, cr.bottom) - btn.bottom, above = btn.top - Math.max(0, cr.top);
    if (r.height > below - 8 && above > below) box.classList.add("up");
    if (r.right > innerWidth - 8) box.classList.add("left");
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest(".x-pop > button");
    if (b) {
      ev.stopPropagation();
      const open = b.getAttribute("aria-expanded") !== "true";
      closePops(b);
      b.setAttribute("aria-expanded", String(open));
      b.nextElementSibling.hidden = !open;
      if (open) place(b.nextElementSibling);
      return;
    }
    if (ev.target.closest(".x-menu button, .x-ddmenu button")) { setTimeout(closePops, 0); return; }
    if (!ev.target.closest(".x-popbox")) closePops();
  });

  // Track and votes
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest(".x-track");
    if (t) {
      const on = t.getAttribute("aria-pressed") !== "true";
      t.setAttribute("aria-pressed", String(on));
      t.querySelector("span").textContent = on ? "Tracking" : "Track";
      return;
    }
    const v = ev.target.closest(".x-votes button");
    if (v) {
      const box = v.closest(".x-votes"), was = box.querySelector("button.on");
      box.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      let val = 0;
      if (was !== v) { v.classList.add("on"); val = v.classList.contains("up") ? 1 : -1; }
      box.querySelector("b").textContent = String(val);
    }
  });

  // ---- a card is a link to its company page (its own buttons and links still work) ----
  function openCard(tile) { location.href = tile.dataset.href + location.search; }
  document.addEventListener("click", (ev) => {
    const tile = ev.target.closest(".x-tile.link");
    if (!tile || ev.target.closest("a, button")) return;
    openCard(tile);
  });
  document.addEventListener("keydown", (ev) => {
    const tile = ev.target.closest && ev.target.closest(".x-tile.link");
    if (tile && ev.target === tile && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); openCard(tile); }
  });

  // ---- the on-site player: every video plays here, never on another site ----
  const th = $(".x-theater"), stage = $(".x-thstage"), btnPlay = $(".x-thplay"), btnSound = $(".x-thsound");
  let lastFocus = null;
  const ICON_PLAY = '<svg class="x-ico fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  const ICON_PAUSE = '<svg class="x-ico fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  function playState(playing) { btnPlay.innerHTML = (playing ? ICON_PAUSE : ICON_PLAY) + `<span>${playing ? "Pause" : "Play"}</span>`; }
  function soundState(on) { btnSound.querySelector("span").textContent = on ? "Mute" : "Unmute"; }
  function ytCmd(func) {
    const f = stage.querySelector("iframe");
    if (f) f.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  }
  function openTheater(key, from) {
    const m = MEDIA[key]; if (!m) return;
    lastFocus = from || document.activeElement;
    $(".x-thco").innerHTML = (m.logo ? `<img class="x-logo sm" src="${m.logo}" alt="">` : "") + `${m.name}<span>${m.play.replace(/^Play /, "")}</span>`;
    const site = $(".x-thsite");
    site.hidden = !m.site; if (m.site) site.href = "https://" + m.site;
    stage.innerHTML = ""; $(".x-thnote").textContent = "";
    if (m.kind === "mp4") {
      stage.style.aspectRatio = m.fit === "contain" ? "16 / 10" : "16 / 9";
      const v = document.createElement("video");
      v.src = m.mp4; v.playsInline = true; v.autoplay = true; v.poster = m.poster;
      v.addEventListener("play", () => playState(true));
      v.addEventListener("pause", () => playState(false));
      v.addEventListener("dblclick", () => (v.requestFullscreen || v.webkitRequestFullscreen || (() => {})).call(v));
      stage.appendChild(v);
      v.play().catch(() => playState(false));
      playState(true); soundState(true); btnSound.disabled = false; btnPlay.disabled = false;
    } else {
      stage.style.aspectRatio = "16 / 9";
      if (location.protocol === "file:") {
        stage.innerHTML = `<img class="back" src="${m.poster}" alt=""><img src="${m.poster}" alt=""><span class="x-thmsg">On the live site the YouTube video plays right here, in this player.</span>`;
        btnPlay.disabled = true; btnSound.disabled = true; playState(true); soundState(true);
        $(".x-thnote").textContent = "Preview: YouTube can't play from a local file.";
      } else {
        const f = document.createElement("iframe");
        f.allow = "autoplay; encrypted-media; fullscreen"; f.title = m.name;
        f.src = `https://www.youtube-nocookie.com/embed/${m.yt}?autoplay=1&controls=0&enablejsapi=1&rel=0&modestbranding=1&playsinline=1`;
        stage.appendChild(f);
        btnPlay.disabled = false; btnSound.disabled = false; playState(true); soundState(true);
      }
    }
    th.hidden = false;
    $(".x-thclose").focus();
  }
  function closeTheater() {
    if (th.hidden) return;
    stage.innerHTML = ""; th.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  btnPlay.addEventListener("click", () => {
    const v = stage.querySelector("video");
    if (v) { v.paused ? v.play() : v.pause(); return; }
    const playing = btnPlay.textContent.includes("Pause");
    ytCmd(playing ? "pauseVideo" : "playVideo"); playState(!playing);
  });
  btnSound.addEventListener("click", () => {
    const v = stage.querySelector("video");
    const on = btnSound.textContent.trim() === "Mute";
    if (v) v.muted = on; else ytCmd(on ? "mute" : "unMute");
    soundState(!on);
  });
  $(".x-thclose").addEventListener("click", closeTheater);
  th.addEventListener("click", (ev) => { if (ev.target === th) closeTheater(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { closeTheater(); closePops(); } });
  document.addEventListener("click", (ev) => {
    const p = ev.target.closest(".x-play");
    if (p) { ev.stopPropagation(); openTheater(p.dataset.co, p); }
  }, true);

  // ---- the homepage filter: three designs, one state, all drive On the Radar ----
  const st = { bucket: "", area: "", fit50: false, newonly: false };
  const BUCKET_NAMES = ["Unknown", "Under $1M", "$1–5M", "$5–15M"];
  function syncControls() {
    $$("[data-set]").forEach((b) => b.setAttribute("aria-pressed", String(st[b.dataset.set] === b.dataset.val)));
    $$("[data-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(!!st[b.dataset.toggle])));
    $$(".x-ddbtn").forEach((b) => {
      const key = b.closest(".x-dd").querySelector("[data-set]").dataset.set;
      const v = st[key];
      b.querySelector("[data-shown]").textContent = !v ? "All" : key === "bucket" ? BUCKET_NAMES[+v] : v.charAt(0).toUpperCase() + v.slice(1);
      b.classList.toggle("on", !!v);
    });
  }
  function applyFilter() {
    const tiles = $$("#radar .x-tile");
    if (!tiles.length) return;
    let shown = 0;
    tiles.forEach((t) => {
      const ok = (st.bucket === "" || t.dataset.bucket === st.bucket) && (!st.area || t.dataset.area === st.area) &&
        (!st.fit50 || +t.dataset.fit >= 50) && (!st.newonly || t.dataset.new === "1");
      t.hidden = !ok; if (ok) shown++;
    });
    $("#empty").hidden = shown > 0;
    $$("[data-count]").forEach((c) => { c.textContent = `${shown} of ${tiles.length} Companies`; });
    const c2 = $("[data-count2]"); if (c2) c2.textContent = `${shown} ${shown === 1 ? "Company" : "Companies"} by Fit`;
  }
  document.addEventListener("click", (ev) => {
    const s = ev.target.closest("[data-set]");
    const tg = ev.target.closest("[data-toggle]");
    const cl = ev.target.closest("[data-clear]");
    if (!s && !tg && !cl) return;
    if (s) st[s.dataset.set] = (st[s.dataset.set] === s.dataset.val && s.dataset.val !== "") ? "" : s.dataset.val;
    if (tg) st[tg.dataset.toggle] = !st[tg.dataset.toggle];
    if (cl) Object.assign(st, { bucket: "", area: "", fit50: false, newonly: false });
    syncControls(); applyFilter();
  });
  syncControls();
  ["f", "h", "o", "w"].forEach((k) => setOpt(k, qs.get(k) || root.dataset[k]));  // last: the filter state above must exist first

  // ---- the Pipeline's filters ----
  const prows = $("#prows");
  if (prows) {
    function applyPipe() {
      const sel = Object.fromEntries($$("[data-psel]").map((s) => [s.dataset.psel, s.value]));
      const q = ($("[data-psearch]").value || "").trim().toLowerCase();
      let shown = 0;
      $$(".x-row", prows).forEach((r) => {
        const ok = (!sel.bucket || r.dataset.bucket === sel.bucket) && (!sel.area || r.dataset.area === sel.area) &&
          (!sel.fit || +r.dataset.fit >= +sel.fit) && (!q || r.textContent.toLowerCase().includes(q));
        r.hidden = !ok; if (ok) shown++;
      });
      $$("[data-psel]").forEach((s) => s.closest(".fsel").classList.toggle("on", !!s.value));
      $("#pempty").hidden = shown > 0;
    }
    $$("[data-psel]").forEach((s) => s.addEventListener("change", applyPipe));
    $("[data-psearch]").addEventListener("input", applyPipe);
    $("[data-pclear]").addEventListener("click", () => { $$("[data-psel]").forEach((s) => { s.value = ""; }); $("[data-psearch]").value = ""; applyPipe(); });
  }
})();
