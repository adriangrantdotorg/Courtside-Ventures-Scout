// Find a brand's website when the show notes carried none (10-14-26: Claude, DraftKings and 38 more showed a letter
// instead of a logo). Clearbit's company suggest is keyless and free; the first result whose name matches the brand wins.
import { fetchJSON } from "./http";

/** Brands the lookup gets wrong or cannot know: the sponsor as named in show notes, and its real site. */
const KNOWN: Record<string, string> = {
  claude: "https://claude.ai", symphonic: "https://symphonic.com", bmi: "https://www.bmi.com", ascap: "https://www.ascap.com",
  bodyarmor: "https://www.drinkbodyarmor.com", reese: "https://www.reeses.com", reeses: "https://www.reeses.com", applecard: "https://www.apple.com/apple-card/",
  nflsundayticket: "https://www.nfl.com/sundayticket", nomono: "https://nomono.co", dk: "https://draftkings.com", amazonprime: "https://www.amazon.com/prime",
  callofdutymobile: "https://www.callofduty.com/mobile", chartmetricflow: "https://chartmetric.com", happydadhardseltzer: "https://happydad.com", nissan: "https://www.nissanusa.com",
};

export async function findSite(brand: string): Promise<string | null> {
  const clean = brand.replace(/['’]s$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const key = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (KNOWN[key]) return KNOWN[key];
  if (clean.length < 3 || /^[A-Z0-9]{5,}$/.test(clean)) return null; // a promo code, not a brand
  const r = (await fetchJSON(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(clean)}`, { source: "clearbit-suggest" })) as { name: string; domain: string }[] | null;
  if (!r?.length) return null;
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  // only an exact name match: a looser match once turned "Booka" into bookauthority.org and "TAD" into tadpoles.com
  const hit = r.find((c) => norm(c.name) === norm(clean));
  return hit?.domain ? `https://${hit.domain}` : null;
}
