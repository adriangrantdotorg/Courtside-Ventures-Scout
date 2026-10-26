// Presses the page's controls in off-screen WebKit and reports what happened.
// Run: webprobe design/scout-v2-cards.html design/v2-cards/test-clicks.js
const out = {};
const hit = (el) => {
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return t === el || el.contains(t);
};
const overlaps = (art, v) => {
  const vr = v.getBoundingClientRect();
  return [...art.querySelectorAll("button, a")].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width && r.height && getComputedStyle(b).visibility !== "hidden" &&
      !(r.right <= vr.left || r.left >= vr.right || r.bottom <= vr.top || r.top >= vr.bottom);
  }).length;
};

// Sources popover opens, lists sources, closes on an outside click
const sb = document.querySelector("#opt-A .srcbtn");
out.srcHit = hit(sb); sb.click(); await sleep(50);
out.srcOpen = !sb.nextElementSibling.hidden && sb.getAttribute("aria-expanded") === "true";
out.srcItems = sb.nextElementSibling.querySelectorAll("li").length;
out.srcLinkHit = hit(sb.nextElementSibling.querySelector("a"));
document.body.click(); await sleep(50);
out.srcClosed = sb.nextElementSibling.hidden;

// More menu opens, its items are clickable, Esc closes it
const mb = document.querySelector("#opt-C .morebtn");
out.moreHit = hit(mb); mb.click(); await sleep(50);
const menu = mb.nextElementSibling;
out.moreOpen = !menu.hidden;
out.moreItems = [...menu.querySelectorAll("button")].map((b) => b.textContent);
out.menuItemHit = hit(menu.querySelector("button:last-child"));
document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); await sleep(30);
out.moreClosedByEsc = menu.hidden;

// Track toggles
const tr = document.querySelector("#opt-D .btn.track");
out.trackHit = hit(tr); tr.click();
out.track = [tr.getAttribute("aria-pressed"), tr.textContent.trim()];
tr.click(); out.trackBack = tr.getAttribute("aria-pressed");

// Votes
const up = document.querySelector("#opt-A .votes .up");
out.voteHit = hit(up); up.click();
out.voteUp = up.parentElement.querySelector("b").textContent;
up.click(); out.voteOff = up.parentElement.querySelector("b").textContent;

// Play an mp4 (Spash, Feed pipeline): video created with sound, label flips, no control over the picture
const row = [...document.querySelectorAll("#opt-A .rowA")].find((r) => r.textContent.includes("Spash"));
const play = row.querySelector(".mb.play");
out.playHit = hit(play); play.click(); await sleep(400);
const v = row.querySelector("video");
out.videoCreated = !!v; out.videoWithSound = !!v && !v.muted;
out.playLabel = play.textContent.trim();
out.controlsOverVideo = v ? overlaps(row, v) : null;
v && v.pause(); await sleep(50);
out.playLabelAfterPause = play.textContent.trim();

// Full screen button and double-click are wired (headless WebKit refuses real full screen)
out.fullHit = hit(row.querySelector(".mb.fs"));

// YouTube Play on a file:// page opens YouTube
let opened = null; const wo = window.open; window.open = (u) => { opened = u; return null; };
document.querySelector("#opt-A .cardA .mb.play").click();
out.ytOpened = opened; window.open = wo;

// Tile row playing hides the text over the picture, so nothing sits on the video
const brow = [...document.querySelectorAll("#opt-B .rowB")].find((r) => r.textContent.includes("ANORIA"));
brow.querySelector(".mb.play").click(); await sleep(300);
out.tileTextHiddenWhilePlaying = getComputedStyle(brow.querySelector(".bover")).display === "none";
const bv = brow.querySelector("video");
out.tileControlsOverVideo = bv ? overlaps(brow, bv) : null;
bv && bv.pause();

// Tile details lift on tap / hover / focus (off-screen WebKit runs no transitions, so measure the end state)
const tile = document.querySelector("#opt-B .tileB");
tile.querySelector(".reveal").style.transition = "none";
tile.classList.add("open"); void tile.offsetWidth;
out.tileRevealOpacity = getComputedStyle(tile.querySelector(".reveal")).opacity;
tile.classList.remove("open");

// Light mode swaps the logo and colors
document.querySelector('.modes [data-mode="light"]').click();
out.mode = document.documentElement.dataset.mode;
out.lightLogo = getComputedStyle(document.querySelector(".lg-light")).display;
document.querySelector('.modes [data-mode="dark"]').click();

// Key 3 jumps to Deal Sheet
document.dispatchEvent(new KeyboardEvent("keydown", { key: "3" })); await sleep(900);
out.jumpCTop = Math.round(document.querySelector("#opt-C").getBoundingClientRect().top);

// D: the New strip fills when it scrolls into view
document.querySelector("#opt-D .strip.new").scrollIntoView({ block: "center" }); await sleep(700);
out.stripPlays = document.querySelector("#opt-D .strip.new").classList.contains("play");

// Nothing spills sideways; no ellipsis anywhere
out.pageOverflowX = document.documentElement.scrollWidth - innerWidth;
out.escapes = [...document.querySelectorAll(".frame *")].filter((el) => {
  const card = el.closest("article"); if (!card || el === card) return false;
  const r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
  return r.width && (r.right > c.right + 1 || r.left < c.left - 1) && !el.closest(".popbox") && !el.matches(".back");
}).map((el) => el.className.baseVal ?? el.className).slice(0, 8);
out.errors = window.__errors;
return out;
