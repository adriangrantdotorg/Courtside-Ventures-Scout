// Screen-copy rules shared by the loader, the jobs and the pages.
/** HTML entities to characters. Feeds double-encode ("&amp;#8217;"), so callers may run it twice; cleanCopy runs it on every screen string. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;|&lsquo;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&");
}
/** Nothing on screen ever shows "&#8217;" or "&amp;": two passes cover a double-encoded feed. */
export function unescapeTwice(s: string): string {
  return decodeEntities(decodeEntities(s));
}
/** Screen copy never says "lane" or "Context only": the seed's older wording is cleaned here. */
export function cleanCopy(s: string | null | undefined): string {
  if (!s) return "";
  return unescapeTwice(s)
    .replace(/\bSame lane\b/g, "Same area of the thesis")
    .replace(/\b([A-Z][a-z]+) lane\b/g, "$1")
    .replace(/\boutside the lanes\b/gi, "outside the thesis")
    .replace(/\binside the lanes\b/gi, "inside the thesis")
    .replace(/\bthe lanes\b/gi, "the thesis")
    .replace(/\blanes\b/gi, "thesis")
    .replace(/\blane\b/gi, "thesis")
    // a portfolio tie in prose ("near Religion of Sports in the portfolio", "close to Wizard and Stay Tuned in the
    // portfolio") is gone: only real competitors get one, as the Overlaps With tag (Adrian, 10-30-26)
    .replace(/ in the [A-Z][a-z]+ area of the thesis, (near|close to|next to) [^;.]+? in the portfolio/g, ", inside Courtside's thesis")
    .replace(/,? (near|close to|next to) [^;.]+? in the portfolio/g, "")
    .replace(/thesis areas?/gi, "thesis")
    .replace(/Context only: /g, "Rejected because ")
    .replace(/\bPre-seed\b/g, "Pre-Seed")
    .replace(/\s*\(the ([^()]+?) pattern\)/g, ", like $1")
    .replace(/,? the ([A-Z][\w' ]+?) pattern\b/g, ", like $1")
    .replace(/\bthe ([a-z][\w-]*) pattern\b/g, "the $1 play")
    // only Scout's own "the X pattern" is rewritten: a company's words stay ("nightly sleep patterns" read "sleep play"
    // on the Must See card, 10-27-26)
    .replace(/\bvoices\b/g, "creators and shows")
    .replace(/\bKey Insight\b/gi, "Spotlight")
    .replace(/,\s*,/g, ",");
}

