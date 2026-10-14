// Screen-copy rules shared by the loader, the jobs and the pages.
/** Screen copy never says "lane" or "Context only": the seed's older wording is cleaned here. */
export function cleanCopy(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\bSame lane\b/g, "Same area of the thesis")
    .replace(/\b([A-Z][a-z]+) lane\b/g, "$1")
    .replace(/\boutside the lanes\b/gi, "outside the thesis")
    .replace(/\binside the lanes\b/gi, "inside the thesis")
    .replace(/\bthe lanes\b/gi, "the thesis")
    .replace(/\blanes\b/gi, "thesis")
    .replace(/\blane\b/gi, "thesis")
    .replace(/thesis areas?/gi, "thesis")
    .replace(/Context only: /g, "Rejected because ")
    .replace(/\bPre-seed\b/g, "Pre-Seed")
    .replace(/\s*\(the ([^()]+?) pattern\)/g, ", like $1")
    .replace(/,? the ([A-Z][\w' ]+?) pattern\b/g, ", like $1")
    .replace(/\bthe ([a-z][\w-]*) pattern\b/g, "the $1 play")
    .replace(/\bpatterns?\b/g, "play")
    .replace(/\bvoices\b/g, "creators and shows")
    .replace(/\bKey Insight\b/gi, "Spotlight")
    .replace(/,\s*,/g, ",");
}

