// Every Phase II door, one shape. Opened by locked chips; "Talk to Adrian" goes to his LinkedIn.
export const ADRIAN_LINKEDIN = "https://www.linkedin.com/in/adriangrant3/";

export type Door = { title: string; today: string; now: string[]; later: string[] };

export const DOORS: Record<string, Door> = {
  realtime: {
    title: "Real-time alerts",
    today: "In this prototype Scout checks once a day, around 8 AM ET. Watching all day is Phase II work.",
    now: ["Once-a-day runs, hits by 8 AM ET", "Every hit linked to its source", "Built solo, on free public sources"],
    later: ["Minutes, not mornings: a watcher on Form D, HN, YC and news", "The Spotlight, Trending and the taste map through the day", "Email digests and Slack posts as hits land"],
  },
  funding: {
    title: "Funding history",
    today: "In this prototype Scout shows the rounds it finds in public filings and news. Full funding history is Phase II work.",
    now: ["Form D and Form C filings from SEC EDGAR", "Funding news with its link", "Amounts labeled with their source"],
    later: ["PitchBook and Crunchbase rounds and valuations", "Cap-table context for every company", "Fund profiles for every co-investor"],
  },
  mutuals: {
    title: "Mutual connections",
    today: "In this prototype Scout names the people in public filings and posts. Mapping who the team knows is Phase II work.",
    now: ["Founders named in filings and posts", "Co-investors from shared rounds", "Portfolio overlap in plain words"],
    later: ["LinkedIn mutual connections for every founder", "Warm-intro paths through the portfolio", "Posts from Courtside, co-investors and synergistic funders"],
  },
  socials: {
    title: "Their posts",
    today: "In this prototype Scout follows these people through news, shows and the brands they work with. Reading their own posts is Phase II work.",
    now: ["News mentions by name, every day", "Appearances on the tracked shows and channels", "Brands they are tied to, through Sponsor Radar"],
    later: ["X, Instagram, TikTok, Facebook, Reddit, Twitch and Kick, through the firm's accounts", "Every post from the influencers tracked by name", "Posts from fund partners such as Megan Lightcap"],
  },
  xposts: {
    title: "X posts",
    today: "In this prototype Scout reads public videos, posts, podcasts and news. X needs the firm's account, so it is Phase II work.",
    now: ["YouTube uploads and podcast appearances", "Medium and Substack posts", "News mentions by name"],
    later: ["Every X post, read through the firm's account", "A weekly summary of what they said", "Alerts when they say something new"],
  },
  linkedin: {
    title: "LinkedIn posts",
    today: "In this prototype LinkedIn is a link only. Reading posts there needs the firm's account, so it is Phase II work.",
    now: ["YouTube uploads and podcast appearances", "Medium and Substack posts", "News mentions by name"],
    later: ["LinkedIn posts from Courtside, co-investors and synergistic funders", "Mutual connections for every founder", "Alerts when someone changes roles"],
  },
  pitchbook: {
    title: "PitchBook and Crunchbase",
    today: "PitchBook, X and LinkedIn are links only in this prototype. Reading them is Phase II, through the firm's accounts.",
    now: ["Fund news, deals and new funds from public sources", "Form D filings for new funds", "Newsletter and video posts"],
    later: ["PitchBook and Crunchbase fund profiles", "Every round with its valuation", "LinkedIn posts from fund partners"],
  },
  team: {
    title: "Team-only access",
    today: "In this prototype Scout is a public link with shared votes. Locking it to the Courtside team is Phase II work.",
    now: ["Open link, no sign-in", "One shared pipeline for every visitor", "Anonymous votes, one per browser"],
    later: ["Sign-in for the Courtside team only", "Trusted ratings: only the team's votes train the feed", "Notes and status changes with names"],
  },
  email: {
    title: "Email alerts",
    today: "In this prototype alerts land inside the site, and in Slack when it is connected. Email is Phase II work.",
    now: ["Alerts inbox on the site", "Hits on Today", "Optional Slack posts"],
    later: ["A morning email digest", "One email per alert hit, if wanted", "The Monday brief by email"],
  },
};

export const PHASE2_ITEMS = [
  ["team", "Team-only access: the dashboard locks to the Courtside team."],
  ["team", "Trusted ratings: only the team's votes train the feed."],
  ["realtime", "Real-time updates: the Spotlight, alerts, Trending and the taste map through the day, not once a day."],
  ["email", "Email alerts."],
  ["socials", "X, Instagram, TikTok, Facebook, Reddit, Twitch and Kick monitoring, through the firm's accounts."],
  ["pitchbook", "PitchBook and Crunchbase: funding history, valuations and fund profiles."],
  ["linkedin", "LinkedIn: mutual connections, and posts from Courtside, its co-investors and the synergistic funders."],
] as const;
