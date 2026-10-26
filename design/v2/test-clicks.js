// Presses each page's controls in off-screen WebKit and reports what happened.
// Run per page: webprobe design/v2/<page>.html design/v2/test-clicks.js
const out = { page: location.pathname.split("/").pop() };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
const hit = (el) => {
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return t === el || el.contains(t);
};
const s = document.createElement("style"); s.textContent = "*{transition:none!important}"; document.head.appendChild(s);
const text = document.querySelector("main").textContent;  // textContent: CSS uppercase would hide the real casing

// Words and rules from the 10-26-26 notes
out.saysNotYetPublic = /not yet public/i.test(text);
out.saysNear = /\bNear [A-Z]/.test(text);
out.overlapsWith = $$(".x-ov").filter(vis).length;
out.capped = ["International Dance League", "POV Beauty"].filter((n) => $$(".x-tile .x-name, .x-row .x-name, .x-rname").some((e) => e.textContent.includes(n)));
out.fullScreenButtons = $$("button").filter((b) => /full ?screen/i.test(b.textContent)).length;
out.websiteLabels = [...new Set($$(".x-btn.site").map((a) => a.textContent.trim()))];
const play = $(".x-play");
if (play) out.playColor = getComputedStyle(play).backgroundColor;

// The option switches change what shows
out.websiteIcons = [...new Set($$(".x-web").filter(vis).map((x) => x.classList[1] + " " + x.classList[2]))];
const known = $$(".x-web.known").find(vis), search = $$(".x-web.search").find(vis);
out.webKnown = known && [known.getAttribute("aria-label"), known.getAttribute("href").slice(0, 30)];
out.webSearch = search && [search.getAttribute("aria-label"), search.getAttribute("href").slice(0, 40)];
out.webHit = known ? hit(known) : null;
// Homepage: the picked filter (Dropdown Bar) sits under On the Radar and filters it
if ($("#radar")) {
  const shown = () => $$("#radar .x-tile").filter((t) => !t.hidden).map((t) => t.dataset.k);
  out.radarCount = shown().length;
  out.filterUnderHeading = $("#fbar").previousElementSibling.textContent.includes("On the Radar");
  out.onlyPickedFilter = $$(".x-filter").map((x) => x.className.split(" ")[1]);
  const ddb = $$(".x-filter.f2 .x-ddbtn")[0]; out.f2_ddHit = hit(ddb); ddb.click(); await sleep(30);
  ddb.nextElementSibling.querySelector('[data-val="2"]').click(); await sleep(30);
  out.f2_1to5M = shown(); out.f2_label = ddb.querySelector("[data-shown]").textContent;
  const cat = $$(".x-filter.f2 .x-ddbtn")[1]; cat.click(); await sleep(30); cat.nextElementSibling.querySelector('[data-val="gaming"]').click(); await sleep(30);
  out.f2_1to5M_gaming = shown();
  $('.x-filter.f2 [data-clear]').click(); out.cleared = shown().length;
  out.count = $(".x-filter.f2 [data-count]").textContent;
  const hero = $(".x-tile.hero");
  out.mustSeeSubtitle = hero.closest("section").querySelector(".x-count").textContent;
  out.mustSeeHasWebsite = !!$(".x-web", hero) || !!$(".x-btn.site", hero);
  out.mustSeeShowsFunds = !!$(".x-funds", hero);
  out.combine = [...$$(".x-h2")].map((h) => h.textContent).filter((t) => /combine|race/i.test(t)).concat($$(".x-count").map((c) => c.textContent).filter((t) => /Top 10/.test(t)));
  out.looseOverlaps = ["sleepsense", "quippy", "mochi", "magic"].filter((k) => $(`[data-k="${k}"] .x-ov`));
  out.hoverLayers = [...new Set($$(".x-hov").map((h) => h.className))];
  out.radarCardHasSources = $$("#radar .x-srcbtn").length;
}

// Hover page: the forced hover shows the label for each design
if (out.page === "hover.html") {
  out.hoverShown = $$("[data-only-h]").map((g) => {
    const t = $(".x-tile[data-hov]", g), id = g.dataset.onlyH, lay = $(`.x-hov.h${id}`, t), cs = getComputedStyle(lay);
    return { id, display: cs.display, opacity: cs.opacity, transform: cs.transform, text: lay.textContent.trim() };
  });
}

// Popovers: sources (not clipped in the Pipeline), signals, More
const sb = $$(".x-srcbtn").find((b) => vis(b));
if (sb) {
  out.srcHit = hit(sb); sb.click(); await sleep(40);
  const box = sb.nextElementSibling;
  out.srcOpen = !box.hidden;
  const li = $("li", box); out.srcItemVisible = hit(li);
  document.body.click(); await sleep(30); out.srcClosed = box.hidden;
}
const sg = $$(".x-sigbtn").find((b) => vis(b));
if (sg) {
  out.sigHit = hit(sg); sg.click(); await sleep(30);
  out.sigItems = $$("li", sg.nextElementSibling).length; out.sigFirstHit = hit($("li a", sg.nextElementSibling));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); await sleep(30); out.sigClosed = sg.nextElementSibling.hidden;
}
const mb = $$(".x-more").find((b) => vis(b));
if (mb) {
  out.moreHit = hit(mb); mb.click(); await sleep(30);
  const box = mb.nextElementSibling, card = mb.closest(".x-tile");
  out.moreLastHit = hit($("button:last-child", box));
  if (card) { const br = box.getBoundingClientRect(), cr = card.getBoundingClientRect(); out.moreInsideCard = br.top >= cr.top && br.bottom <= cr.bottom; }
  out.moreOrder = [...mb.closest(".x-acts, .x-side").children].map((x) => x.matches(".x-votes") ? "votes" : x.matches(".x-pop") ? "more" : x.textContent.trim().split(" ")[0]);
  document.body.click();
}

// Pipeline filters
if ($("#prows")) {
  const rows = () => $$("#prows .x-row").filter((r) => !r.hidden).map((r) => r.dataset.k);
  const sel = $('[data-psel="bucket"]'); sel.value = "2"; sel.dispatchEvent(new Event("change")); out.p_1to5M = rows();
  const cat = $('[data-psel="area"]'); cat.value = "gaming"; cat.dispatchEvent(new Event("change")); out.p_1to5M_gaming = rows();
  $("[data-pclear]").click(); out.p_all = rows().length;
  out.p_ctaRed = getComputedStyle($(".x-row .x-btn.site.cta")).backgroundColor; out.p_find = $$(".x-row .x-btn.site.find").length; out.p_icons = $$(".x-row .x-web").length;
  out.p_hasLanes = !!$(".lanes");
  out.p_selects = $$("[data-psel]").map((s) => s.closest(".fsel").firstChild.textContent.trim());
}

// The player
const pb = $$(".x-play").find((b) => vis(b));
if (pb) {
  out.playHit = hit(pb); pb.click(); await sleep(120);
  out.theaterOpen = !$(".x-theater").hidden;
  $(".x-thclose").click(); await sleep(30); out.theaterClosed = $(".x-theater").hidden;
}

// Company page
if (out.page === "company.html") {
  out.co_funds = $(".x-funds.xxl .x-amt").textContent; out.co_fit = $(".x-fit.xl b").textContent;
  out.co_overlapCallout = $$(".x-ov.callout").filter(vis).map((x) => x.textContent.trim().slice(0, 40));
  out.co_redButtons = $$("main .x-btn.site.cta").length;
}

const look = (b) => { const c = getComputedStyle(b); return [c.backgroundColor, c.borderTopColor, c.color].join(" | "); };
out.secondaryLooks = [...new Set($$('.x-more, .x-track[aria-pressed="false"], a.x-btn.ghost').filter(vis).map(look))];  // one look, sitewide
out.pageOverflowX = document.documentElement.scrollWidth - innerWidth;
out.errors = window.__errors;
return out;
