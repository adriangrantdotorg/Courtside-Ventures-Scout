// Thesis classification by keyword rules, with the traps that cost earlier runs a rescore.
export type Area = "sports" | "gaming" | "lifestyle" | "health" | "media";

// Strong terms count 2; weak terms count 1. Traps are removed before matching.
const TERMS: Record<Area, { strong: string[]; weak: string[] }> = {
  sports: {
    strong: ["sports", "athlete", "athletes", "fan engagement", "fantasy sports", "sports betting", "sportsbook", "nil", "name image likeness", "league", "leagues", "football", "soccer", "basketball", "baseball", "hockey", "pickleball", "golf", "tennis", "nfl", "nba", "wnba", "mlb", "nhl", "ufc", "mma", "boxing", "cricket", "padel", "college athletics", "ncaa", "youth sports", "esports league", "stadium"],
    weak: ["fans", "fan", "fandom", "betting", "fantasy", "wager", "coach", "coaching", "olympic", "racing", "f1", "running club"],
  },
  gaming: {
    strong: ["gaming", "video game", "video games", "mobile game", "game studio", "esports", "e-sports", "roblox", "fortnite", "minecraft", "steam deck", "on steam", "playstation", "xbox", "nintendo", "multiplayer game", "battle royale", "mmo", "rpg", "game engine", "indie game", "social casino", "real-money gaming", "skill gaming", "poker"],
    weak: ["game", "games", "gamer", "gamers", "twitch", "speedrun", "lottery", "multiplayer"],
  },
  lifestyle: {
    strong: ["collectibles", "collectible", "trading cards", "trading card", "sneakers", "sneaker", "streetwear", "live commerce", "live shopping", "resale", "luxury watches", "memorabilia", "pokemon cards", "marketplace for", "dtc brand", "direct-to-consumer", "consumer brand", "activewear", "athleisure"],
    weak: ["marketplace", "fashion", "apparel", "luxury", "watches", "secondhand", "beauty", "skincare", "jewelry", "toys", "vintage", "beverage", "drinks", "coffee", "snack", "dating", "pets", "travel", "home goods"],
  },
  health: {
    strong: ["longevity", "wellness", "fitness", "recovery", "peptides", "peptide", "glp-1", "weight loss", "metabolic", "biomarkers", "blood test", "wearable", "strength training", "athletic performance", "therapy app", "mental health", "telehealth", "physical therapy", "cold plunge", "sauna", "menopause", "fertility", "testosterone", "hormone", "sleep", "nutrition", "supplements", "supplement", "out-of-pocket"],
    weak: ["health", "workout", "gym", "diet", "protein", "hydration", "electrolytes", "running", "cycling", "pilates", "yoga", "clinic"],
  },
  media: {
    strong: ["creator economy", "creators", "creator", "influencer", "influencers", "youtuber", "streamer", "podcast", "podcasts", "microdrama", "microdramas", "short-form", "dubbing", "ai video", "animation", "superfans", "fan club", "record label", "live events", "ticketing", "concert", "concerts", "newsletter"],
    weak: ["media", "entertainment", "film", "tv", "television", "music", "artist", "artists", "content", "video", "audio", "comedy", "studio", "publisher", "festival", "storytelling", "streaming"],
  },
};

const TRAPS = [/gathers? steam/gi, /full steam/gi, /steam(?:s|ed)? ahead/gi, /\bgame[- ]changer/gi, /\bgame plan\b/gi, /\bthe game\b(?= of)/gi, /\bdata center/gi, /\bhealth ?care it\b/gi, /\bperformance (?:review|marketing|management|monitoring)/gi, /\bplayers? in the (?:market|space|industry)/gi, /\bleague of legends\b/gi];

function norm(s: string) {
  let t = ` ${s.toLowerCase()} `;
  for (const r of TRAPS) t = t.replace(r, " ");
  return t.replace(/[^a-z0-9+.\- ]+/g, " ").replace(/\s+/g, " ");
}

function count(text: string, term: string): number {
  const re = new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "g");
  return (text.match(re) || []).length;
}

export type Classified = { area: Area | null; confidence: number; hits: string[]; scores: Record<Area, number> };

/** Confidence 0.27 + 0.15 per hit (a weak keyword is half a hit); an area needs 0.4. One weak keyword is not a thesis area. */
export function classify(text: string, extra?: Partial<Record<Area, string[]>>): Classified {
  const t = norm(text || "");
  const scores = { sports: 0, gaming: 0, lifestyle: 0, health: 0, media: 0 } as Record<Area, number>;
  const hitsBy: Record<string, string[]> = {};
  for (const a of Object.keys(TERMS) as Area[]) {
    const strong = [...TERMS[a].strong, ...(extra?.[a] || [])];
    for (const k of strong) if (count(t, k)) ((scores[a] += 1), (hitsBy[a] ||= []).push(k));
    for (const k of TERMS[a].weak) if (count(t, k)) ((scores[a] += 0.5), (hitsBy[a] ||= []).push(k));
  }
  if (/\b(pharma|pharmaceuticals?|biotech|drug discovery|clinical trials?|therapeutics|medical devices?|hospitals?|oncology|diagnostics lab)\b/.test(t)) scores.health = Math.max(0, scores.health - 2);
  let best: Area | null = null;
  for (const a of Object.keys(scores) as Area[]) if (!best || scores[a] > scores[best]) best = a;
  if (!best || scores[best] === 0) return { area: null, confidence: 0, hits: [], scores };
  const confidence = Math.min(0.99, 0.27 + 0.15 * scores[best]);
  return { area: confidence >= 0.4 ? best : null, confidence, hits: hitsBy[best] || [], scores };
}

/** Not venture scale: agencies, services, single-location businesses. */
export function notVentureScale(text: string): boolean {
  return /\b(agency|consultancy|consulting firm|law firm|accounting|restaurant|bar and grill|salon|barbershop|dental practice|real estate|property management|staffing|construction|plumbing|landscaping|church|nonprofit|charity)\b/i.test(text);
}

/** Industry groups Form D filings carry that are never startups for Courtside. */
export const DROP_INDUSTRY = /pooled investment fund|real estate|reits|oil and gas|coal|mining|banking|commercial banking|insurance|lodging|investing|other banking|energy conservation|electric utilities|agriculture|construction|airlines|manufacturing/i;
export const THESIS_INDUSTRY: Record<string, Area | null> = {
  "Other Health Care": "health",
  "Health Insurance": null,
  Biotechnology: null,
  Pharmaceuticals: null,
  "Other Technology": null,
  "Computers": null,
  Retailing: "lifestyle",
  Restaurants: null,
  "Other Travel": "lifestyle",
  Tourism: "lifestyle",
};

/** Developer, B2B and enterprise tools are never consumer startups for Courtside. */
export const NOT_CONSUMER = /\b(api|apis|sdk|cli|developers?|devs|markdown|database|servers?|llms?|ai agents?|agents|coding|devops|open[- ]source|self[- ]hosted|framework|library|b2b|saas|enterprise|crm|linkedin|outreach|sales teams?|workflow|productivity|after effects|business video|for businesses|for teams|compliance|cybersecurity|fintech infrastructure|payroll|accounting|logistics)\b/i;
/** Big companies are not startups: a Form D or a launch from them is not a find. */
export const INCUMBENT = /^(google|apple|meta|amazon|microsoft|samsung|sony|nintendo|netflix|disney|warner|universal|nike|adidas|espn|nfl|nba|mlb|fox|nbc|cbs|paramount|spotify|tiktok|youtube|bytedance|tencent)\b/i;
