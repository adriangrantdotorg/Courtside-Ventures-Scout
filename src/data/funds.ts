// The fund lists from the brief, in the brief's order (the launch seed's item ids follow this order).
export type Shared = { company: string; round?: string; date?: string; url: string };
export type FundDef = { name: string; focus: "specialist" | "broad"; shared?: Shared[]; site?: string; note?: string; area?: string; edgarName?: string; youtube?: string[]; feeds?: string[] };

const SYSTEM = "https://medium.com/@courtsidevc/why-we-invested-system-ef69ca021854";
const FANSTAKE = "https://medium.com/@courtsidevc/why-we-invested-fanstake-c745d2f4554b";
const ETERNAL = "https://medium.com/@courtsidevc/why-we-invested-eternal-2ef438464b11";
const CAMB = "https://medium.com/@courtsidevc/why-we-invested-camb-ai-be0eb654d5e8";
const ELOELO = "https://medium.com/@courtsidevc/why-we-invested-eloelo-38bb501834cf";
const JUMP = "https://www.jump.com/articles/series-a";
const ID = "https://finance.yahoo.com/news/incredible-dream-raises-2m-seed-152400678.html";
const ROS = "https://www.sportsbusinessjournal.com/Daily/Issues/2020/07/23/Finance/Religion-Of-Sports/";
const PACKZ = "https://raising.fi/news/packz-undisclosed-april-2026";
const HTGF = "https://www.htgf.de/en/htgf-series-a-venly/";
const EQT = "https://stories.eqtventures.com/articles/baller-league-why-we-believe-in-a-new-era-of-football";
const STORY = "https://www.storycraft.gg/posts/storycraft-raises-3M-seed-round-led-by-khosla-ventures/";
const PL1 = "https://www.gamedeveloper.com/game-platforms/players-lounge-raises-3m-for-a-wager-based-competitive-video-game-platform";
const PL2 = "https://www.linkedin.com/posts/austin-woolridge-64b81730_i-am-pleased-to-announce-that-players-lounge-activity-6958522628911284224-s8a6";
const BETTY = "https://www.prnewswire.com/news-releases/betty-a-real-money-entertainment-startup-raises-5-million-seed-round-301745916.html";
const FANAI = "https://www.prnewswire.com/news-releases/fanai-closes-a-venture-round-led-by-courtside-ventures-300495646.html";

const s = (company: string, round: string, date: string, url: string): Shared => ({ company, round, date, url });

export const NEIGHBORHOOD: FundDef[] = [
  { name: "Patron Fund", focus: "specialist", shared: [s("System", "$20M (lead)", "2026-09-09", SYSTEM)] },
  { name: "Will Ventures", focus: "specialist", shared: [s("System", "$20M", "2026-09-09", SYSTEM), s("Fanstake", "$6.25M seed", "2025-04-29", FANSTAKE)] },
  { name: "Scrum Ventures", focus: "specialist", shared: [s("Fanstake", "$6.25M seed", "2025-04-29", FANSTAKE)] },
  { name: "Griffin Gaming Partners", focus: "specialist", shared: [s("Eloelo", "Series A", "2023-09-20", ELOELO)] },
  { name: "Vine Ventures", focus: "broad", shared: [s("System", "$20M", "2026-09-09", SYSTEM)] },
  { name: "Daybreak", focus: "broad", shared: [s("System", "$20M", "2026-09-09", SYSTEM)] },
  { name: "SV Angel", focus: "broad", shared: [s("System", "$20M", "2026-09-09", SYSTEM)] },
  { name: "Susa Ventures", focus: "broad", shared: [s("Fanstake", "$6.25M seed", "2025-04-29", FANSTAKE)] },
  { name: "Myriad Ventures", focus: "broad", shared: [s("Fanstake", "$6.25M seed", "2025-04-29", FANSTAKE)] },
  { name: "Alumni Ventures", focus: "broad", shared: [s("Fanstake", "$6.25M seed", "2025-04-29", FANSTAKE)] },
  { name: "Lightspeed Venture Partners", focus: "broad", shared: [s("Eternal", "$13M seed (co-lead)", "2025-01-14", ETERNAL)] },
  { name: "Founders Fund", focus: "broad", shared: [s("Eternal", "$13M seed", "2025-01-14", ETERNAL)] },
  { name: "Next Ventures", focus: "broad", shared: [s("Eternal", "$13M seed", "2025-01-14", ETERNAL)] },
  { name: "Bling Capital", focus: "broad", shared: [s("Eternal", "$13M seed", "2025-01-14", ETERNAL)] },
  { name: "Dubai Future District Fund (DFDF)", focus: "broad", shared: [s("Camb AI", "$4M seed", "2024-02-09", CAMB)] },
  { name: "TRTL Ventures", focus: "broad", shared: [s("Camb AI", "$4M seed", "2024-02-09", CAMB)] },
  { name: "Blue Star Innovation Partners", focus: "broad", shared: [s("Camb AI", "$4M seed", "2024-02-09", CAMB)] },
  { name: "Seven Seven Six", focus: "specialist", shared: [s("Jump", "$23M Series A", "2025-08-12", JUMP)] },
  { name: "Forerunner Ventures", focus: "broad", shared: [s("Jump", "Series A", "2025-08-12", "https://www.forerunnerventures.com/perspectives/the-sports-fan-revolution-why-were-betting-on-jump")] },
  { name: "Drive by DraftKings", focus: "specialist", shared: [s("Jump", "Series A", "2025-08-12", JUMP)] },
  { name: "Slow Ventures", focus: "broad", shared: [s("Incredible Dream", "$2M seed", "2021-12-15", ID)], youtube: ["UCYxUZQULtqk9FP4sbyaGNGw"] },
  { name: "LightShed Ventures", focus: "specialist", shared: [s("Incredible Dream", "seed", "2021-12-15", ID)] },
  { name: "General Catalyst", focus: "broad", shared: [s("Incredible Dream", "seed (lead)", "2021-12-15", ID)] },
  { name: "Advancit Capital", focus: "specialist", shared: [s("Incredible Dream", "seed", "2021-12-15", ID), s("Religion of Sports", "round", "2020-07-23", ROS)] },
  { name: "Elysian Park Ventures", focus: "specialist", shared: [s("Religion of Sports", "round", "2020-07-23", ROS)] },
  { name: "Lumikai", focus: "specialist", shared: [s("Eloelo", "$22M", "2023-09-20", "https://www.lumikai.com/post/eloelo-raises-22-million-in-funding-from-courtside-ventures-and-griffin-gaming-partners")] },
  { name: "Play Ventures", focus: "specialist", shared: [s("Eloelo", "2023 (secondary source only)", "2023-09-20", "https://www.clay.com/dossier/eloelo-funding")] },
  { name: "Makers Fund", focus: "specialist", shared: [s("Packz", "$10.7M seed", "2026-04-01", PACKZ)] },
  { name: "The Raine Group", focus: "specialist", shared: [s("Packz", "seed", "2026-04-01", PACKZ)] },
  { name: "RiverPark Ventures", focus: "broad", shared: [s("Packz", "seed", "2026-04-01", PACKZ)] },
  { name: "Sharp Alpha", focus: "specialist", shared: [s("Packz", "seed", "2026-04-01", PACKZ)] },
  { name: "Transcend Fund", focus: "specialist", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "Powerhouse Capital", focus: "specialist", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "High-Tech Gründerfonds", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "Coinbase Ventures", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "Tioga Capital", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "Fortino Capital", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "LeadBlock Partners", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "Plug and Play", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "imec.istart", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "Alpaca VC", focus: "broad", shared: [s("Venly", "Series A", "2022-04-28", HTGF)] },
  { name: "EQT Ventures", focus: "broad", shared: [s("Baller League", "Series A (lead)", "2025-01-28", EQT)] },
  { name: "V3 Ventures", focus: "specialist", shared: [s("Baller League", "Series A", "2025-01-28", EQT)] },
  { name: "APEX Capital", focus: "specialist", shared: [s("Baller League", "round", "2025-01-28", "https://www.sportcal.com/news/apex-invests-in-baller-league-expansion-with-premier-league-stars-in-tow/")] },
  { name: "Dreamcraft Ventures", focus: "specialist", shared: [s("Baller League", "earlier round", "2024-11-25", EQT)] },
  { name: "Khosla Ventures", focus: "broad", shared: [s("Storycraft", "$3M seed (lead)", "2025-04-11", STORY)] },
  { name: "SignalFire", focus: "broad", shared: [s("Storycraft", "pre-seed", "2025-04-11", STORY)] },
  { name: "London Venture Partners", focus: "specialist", shared: [s("Storycraft", "pre-seed", "2025-04-11", STORY)] },
  { name: "Comcast Ventures", focus: "broad", shared: [s("Players' Lounge", "$3M seed", "2019-03-28", PL1)] },
  { name: "Canaan", focus: "broad", shared: [s("Players' Lounge", "seed", "2019-03-28", PL1)] },
  { name: "RRE Ventures", focus: "broad", shared: [s("Players' Lounge", "seed", "2019-03-28", PL1)] },
  { name: "Samsung Next", focus: "broad", shared: [s("Players' Lounge", "Series A", "2022-07-28", PL2)] },
  { name: "WndrCo", focus: "broad", shared: [s("Players' Lounge", "Series A", "2022-07-28", PL2)] },
  { name: "AlleyCorp", focus: "broad", shared: [s("Players' Lounge", "Series A", "2022-07-28", PL2)] },
  { name: "MaC Venture Capital", focus: "broad", shared: [s("Players' Lounge", "Series A", "2022-07-28", PL2)] },
  { name: "Karlani Capital", focus: "broad", shared: [s("Betty", "$5M seed", "2023-02-14", BETTY)] },
  { name: "CEAS Investments", focus: "broad", shared: [s("Betty", "seed", "2023-02-14", BETTY)] },
  { name: "OCA Ventures", focus: "broad", shared: [s("Betty", "seed", "2023-02-14", BETTY)] },
  { name: "Subversive Capital", focus: "broad", shared: [s("Betty", "seed", "2023-02-14", BETTY)] },
  { name: "Gaingels", focus: "broad", shared: [s("Betty", "seed", "2023-02-14", BETTY)] },
  { name: "Ikemori Ventures", focus: "broad", shared: [s("Camb AI", "$4M seed", "2024-02-06", "https://www.camb.ai/blog-post/announcing-camb-ais-4m-seed-round-led-by-courtside-ventures")] },
  { name: "The Chernin Group", focus: "specialist", shared: [s("The Athletic", "Series A", "2017-07-01", "https://multiples.vc/private-comps/the-athletic")] },
  { name: "BDMI (Bertelsmann)", focus: "specialist", shared: [s("The Athletic", "seed", "2017-01-09", "https://www.prnewswire.com/news-releases/courtside-ventures-announces-first-year-investment-portfolio-leads-seed-round-in-y-combinator-alum-the-athletic-300387918.html")] },
  { name: "Catalyst Sports", focus: "specialist", shared: [s("FanAI", "seed", "2017-07-27", FANAI)] },
  { name: "Greycroft", focus: "broad", shared: [s("FanAI", "seed (GC Tracker Fund)", "2017-07-27", FANAI)] },
];

export const SYNERGISTIC: FundDef[] = [
  { name: "Slow Ventures Creator Fund", focus: "specialist", site: "https://creatorfund.co/", area: "media", edgarName: "Slow Ventures Creator Fund", youtube: ["UCYxUZQULtqk9FP4sbyaGNGw"], note: "Megan Lightcap (Partner) leads it with Sam Lessin. $60M, $1M to $3M checks into creator-led businesses." },
  { name: "Creator Ventures", focus: "specialist", site: "https://www.creator.ventures/", area: "media" },
  { name: "Animal Capital", focus: "specialist", site: "https://animalcapital.com/", area: "media" },
  { name: "Behind Genius Ventures", focus: "specialist", site: "https://www.behindgeniusventures.com/", area: "media" },
  { name: "Gallery Ventures", focus: "specialist", site: "https://gallery.vc/", area: "media", note: "Formerly Crossbeam Venture Partners" },
  { name: "Position Ventures", focus: "specialist", site: "https://www.positionventures.com/", area: "media" },
  { name: "UTA Ventures", focus: "specialist", site: "https://www.unitedtalent.com/uta-ventures", area: "media" },
  { name: "Offline Ventures", focus: "specialist", site: "https://offlineventures.com/", area: "media" },
  { name: "Shrug Capital", focus: "specialist", site: "https://shrug.vc/", area: "media" },
  { name: "Connect Ventures", focus: "specialist", site: "https://connectventures.com/", area: "media", note: "CAA and NEA's fund, not the London firm with the same name" },
  { name: "Lerer Hippeau", focus: "broad", site: "https://lererhippeau.com/", area: "media" },
  { name: "359 Capital", focus: "specialist", site: "https://www.359capital.com/", area: "sports", note: "Formerly Sapphire Sport" },
  { name: "SeventySix Capital", focus: "specialist", site: "https://www.seventysixcapital.com/", area: "sports" },
  { name: "KB Partners", focus: "specialist", site: "https://kbpartners.com/", area: "sports" },
  { name: "ADvantage Sports Tech Fund", focus: "specialist", site: "https://advantage.vc/", area: "sports" },
  { name: "LEAD", focus: "specialist", site: "https://www.lead.vc/", area: "sports", note: "Formerly leAD Sports & Health Tech" },
  { name: "TitletownTech", focus: "specialist", site: "https://titletowntech.com/", area: "sports" },
  { name: "Athletic Ventures", focus: "specialist", site: "https://athletic.vc/", area: "sports" },
  { name: "Game Changers Ventures", focus: "specialist", site: "https://gamechangers.vc/", area: "sports" },
  { name: "Stadia Ventures", focus: "specialist", site: "https://stadiaventures.com/", area: "sports" },
  { name: "Rabil Ventures", focus: "specialist", site: "https://rabilventures.com/", area: "sports" },
  { name: "Mindspring Capital", focus: "specialist", site: "https://mindspring.capital/", area: "sports" },
  { name: "Aser Ventures", focus: "specialist", area: "sports", note: "No site found on 10-12-26; followed through news only" },
  { name: "24Haymarket", focus: "specialist", site: "https://24haymarket.com/", area: "sports" },
  { name: "Causeway Media Partners", focus: "specialist", site: "https://causeway.vc/", area: "sports", note: "Growth stage" },
  { name: "BITKRAFT Ventures", focus: "specialist", site: "https://bitkraft.vc/", area: "gaming", note: "Possible co-investor: a shared deal was claimed but not proven" },
  { name: "GFR Fund", focus: "specialist", site: "https://gfrfund.com/", area: "gaming", note: "Possible co-investor: a shared deal was claimed but not proven" },
  { name: "Konvoy Ventures", focus: "specialist", site: "https://www.konvoy.vc/", area: "gaming" },
  { name: "HIRO Capital", focus: "specialist", site: "https://hiro.capital/", area: "gaming" },
  { name: "Galaxy Interactive", focus: "broad", site: "https://www.galaxy.com/", area: "gaming" },
  { name: "vgames", focus: "specialist", site: "https://www.vgames.vc/", area: "gaming" },
  { name: "The Games Fund", focus: "specialist", site: "https://gamesfund.vc/", area: "gaming" },
  { name: "Sisu Game Ventures", focus: "specialist", site: "https://sisu.vc/", area: "gaming" },
  { name: "Laton Ventures", focus: "specialist", site: "https://laton.vc/", area: "gaming" },
  { name: "Behold Ventures", focus: "specialist", site: "https://behold.vc/", area: "gaming" },
  { name: "FOV Ventures", focus: "specialist", site: "https://fov.ventures/", area: "gaming" },
  { name: "a16z speedrun", focus: "specialist", site: "https://speedrun.a16z.com/", area: "gaming", note: "The games program only, not all of a16z" },
  { name: "Animoca Brands", focus: "broad", site: "https://www.animocabrands.com/", area: "gaming" },
  { name: "Torch Capital", focus: "specialist", site: "https://torchcapital.vc/", area: "lifestyle" },
  { name: "XRC Ventures", focus: "broad", site: "https://xrcventures.com/", area: "lifestyle" },
  { name: "M13", focus: "broad", site: "https://m13.co/", area: "lifestyle" },
];

/** Names shared with other things: queries need "venture OR VC OR seed" and a round in the headline. */
export const COMMON_NAMES = new Set(["LEAD", "M13", "Patron Fund", "Canaan", "APEX Capital", "Connect Ventures", "Catalyst Sports", "Athletic Ventures", "V3 Ventures", "Play Ventures", "Gallery Ventures", "Position Ventures", "Torch Capital"]);

export function normName(n: string) {
  return n.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
}

/** Seed fund ids were assigned in this order: the 65 co-investors, then the 41 synergistic funders. */
export const SEED_ORDER = [...NEIGHBORHOOD.map((f) => f.name), ...SYNERGISTIC.map((f) => f.name)];

export const COURTSIDE_DEALS = [
  { company: "System", domain: "systemlabs.com", date: "2026-09-09", url: SYSTEM, title: "Why We Invested: System" },
  { company: "Fanstake", domain: "fanstake.com", date: "2025-04-29", url: FANSTAKE, title: "Why We Invested: Fanstake" },
  { company: "Baller League", domain: "ballerleague.com", date: "2025-03-11", url: "https://medium.com/@courtsidevc/why-we-invested-baller-league-616e38d15903", title: "Why We Invested: Baller League" },
  { company: "Eternal", domain: "eternal.health", date: "2025-01-14", url: ETERNAL, title: "Why We Invested: Eternal" },
  { company: "Camb AI", domain: "camb.ai", date: "2024-02-09", url: CAMB, title: "Why We Invested: Camb AI" },
  { company: "Eloelo", domain: "eloelo.in", date: "2023-09-20", url: ELOELO, title: "Why We Invested: Eloelo" },
];
