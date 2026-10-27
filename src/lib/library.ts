// The startups the team saved, for the Library backfill (Adrian, 10-26-26): each gets a name search for its funding
// story, and the AI Thesis Check is the screen, so only a consumer startup in the thesis, under the cap, gets a card.
// Scout can't read Notion: this list was pulled on 10-26-26 and is pulled again when the pages change.
import { isSubject } from "./backtest";
import { stageOf, moneyOf } from "./companies";
import { usd, CAP } from "./v2";

export type LibraryPick = { name: string; domain?: string; from: "library" | "thesis" | "team" };

const lib = (name: string, domain?: string): LibraryPick => ({ name, domain, from: "library" });
const thesis = (name: string, domain?: string): LibraryPick => ({ name, domain, from: "thesis" });
const team = (name: string, domain?: string): LibraryPick => ({ name, domain, from: "team" });

export const LIBRARY: LibraryPick[] = [
  // The Library of Links: Growth List's funded audio startups plus the companies named in the saved articles.
  // Private-equity deals and rounds of $15M or more were left out: Scout never recommends those.
  ...["Audicin", "Troveo", "EVEN", "Mozart AI", "Kreo", "The Footnote", "Breeze Blue", "ListenHub", "Clipto.AI", "Sticks & Glass",
    "Typecast", "Acrylic", "Stationhead", "MADverse", "CriticAI", "BNE Productions", "Totally Innovation", "Spin It Up", "Onesonic",
    "Soundable Health", "EverMemory", "SELF"].map((n) => lib(n)),
  // The Investment Thesis - Consumer / AI page. Left out: what the page itself marks later stage (ElevenLabs, Canva,
  // Splice at Series D), Runway, Nucleus ($32M raised), VCs, newsletters and podcasts, and names whose search finds
  // other news first (Nero, Brat: Charli XCX's album, Moss: Kate Moss).
  thesis("Galaxy Brain", "galaxybrain.com"),
  thesis("Composio", "composio.dev"),
  thesis("QUITTR", "quittrapp.com"),
  thesis("Nightmarket", "nightmarket.ai"),
  thesis("Something Else", "somethingelse.ai"),
  thesis("Springrose", "springrose.co"),
  thesis("The Shade Room"),
  thesis("Breaking Points"),
  thesis("AMP Collective"),
  thesis("Brit + Co", "brit.co"),
  thesis("PureWow"),
  thesis("Spill"),
  thesis("Setapp"),
  thesis("MacPaw"),
  thesis("Udio", "udio.com"),
  thesis("VideoDB", "videodb.io"),
  thesis("Pierre Laborde", "pierrelaborde.com"),
  thesis("District", "district.net"),
  thesis("Particl", "particl.com"),
  thesis("Lil Bucks", "lovelilbucks.com"),
  thesis("RPM Raceway"),
  thesis("Maison Vive", "maisonvive.co"),
  thesis("Seraphinne Vallora", "seraphinnevallora.com"),
  thesis("Let's Date", "letsdate.lol"),
  thesis("Tip Top Cocktails", "tiptopcocktails.com"),
  thesis("Marble Health", "marblehealth.com"),
  thesis("Flair.ai", "flair.ai"),
  thesis("Ember AI"),
  thesis("Into It"),
  thesis("Rogue Amoeba", "rogueamoeba.com"),
  thesis("Keyboard Maestro"),
  thesis("Whop", "whop.com"),
  thesis("Noplace"),
  thesis("Spread"),
  thesis("Verse"),
  // Named by the team: Adrian, 10-26-26, "this is a company that should be let in"
  team("A Vinyl Bar in Shibuya"),
];

// "bags" only with an amount after it: "the viral Pierre Laborde bags" are handbags, not a raise (10-26-26)
const FUNDING = /\b(raises|raised|secures|closes|nabs|funding|seed round|pre-seed|series a)\b|\bbags\s+(an?\s+)?[$€£\d]/i;
/** A funding story counts for two years: an older seed is likely past Courtside's stage by now. */
export const LIBRARY_DAYS = 730;

export type Story = { title: string; url: string; date: string | null; text?: string; outlet?: string };

/** The newest story that names this company as raising money, or null. A later round (Series B and on) or one round
 *  of $15M or more means the company is past Courtside's stage, so there is no card. */
export function libraryStory<T extends Story>(name: string, items: T[], now = Date.now()): (T & { stage: string; amount: number | null; currency: string }) | null {
  const fresh = items
    .filter((n) => isSubject(name, n.title) && FUNDING.test(n.title) && (!n.date || now - Date.parse(n.date) < LIBRARY_DAYS * 86400000))
    .sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  const n = fresh[0];
  if (!n) return null;
  const stage = stageOf(n.title);
  if (stage === "later" || stage === "series-b") return null;
  const m = moneyOf(n.title);
  if (m && (usd(m.amount, m.currency) ?? 0) >= CAP) return null;
  return { ...n, stage, amount: m?.amount ?? null, currency: m?.currency || "$" };
}
