import type { Metadata } from "next";
import { DocHead, Toc } from "@/components/doc";
import { JOBS } from "@/lib/jobs";
import { ADRIAN_LINKEDIN } from "@/lib/phase2";

export const metadata: Metadata = { title: "About" };

const TOC = [
  { id: "what", label: "What this is" },
  { id: "how", label: "How it works" },
  { id: "sources", label: "Sources" },
  { id: "schedule", label: "Schedule" },
  { id: "privacy", label: "Privacy" },
  { id: "phase2", label: "Phase II" },
  { id: "credit", label: "Credit" },
];

function et(hourUtc: number) {
  const h = (hourUtc - 4 + 24) % 24;
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"} ET`;
}

export default function Page() {
  return (
    <div>
      <DocHead label="About" title="Courtside Ventures Scout" lede="A deal-sourcing site for Courtside Ventures: startups, trends, sponsors, culture and funds inside Courtside's thesis, found every morning from free public sources, every fact linked to its source." slackText="About Courtside Ventures Scout." />
      <div className="doc">
        <div className="main">
          <h2 id="what">What This Is</h2>
          <p>A prototype Adrian Grant built alone, on free public sources, to start a conversation with Courtside. It runs on Vercel&apos;s free Hobby plan and a free Neon database, with no paid keys. AI drafting is optional and off unless it is switched on; everything on the home page works without it. The social networks come with Phase II, through the firm&apos;s accounts.</p>
          <p>A non-commercial demo built by Adrian Grant to show what&apos;s possible. No payments, no ads.</p>
          <h2 id="how">How It Works</h2>
          <p>Every morning Scout reads SEC filings, startup launches, funding news, the App Store charts, the creators and shows Courtside&apos;s world listens to, and the funds around Courtside. It resolves what it finds into one card per real company, scores each one for thesis fit with a breakdown anyone can open, writes a one-line &quot;why it fits&quot;, and checks it against the 73 portfolio companies. The Spotlight is picked by rules, never AI. Votes are shared: every visitor sees the same counts, and the votes nudge the scores (by at most 15 points).</p>
          <h2 id="sources">Sources</h2>
          <ul>
            <li>SEC EDGAR: the daily Form D and Form C index, filing details and full-text search</li>
            <li>Hacker News, Y Combinator&apos;s company list, Product Hunt, App Store charts</li>
            <li>Google News, Google Trends&apos; daily feed, and industry news: Front Office Sports, Sportico, TechCrunch, Crunchbase News, Passionfruit, Tubefilter, Variety, Deadline, Puck, GamesIndustry.biz, The Verge</li>
            <li>The creators and shows: YouTube channel feeds and podcast feeds (titles, descriptions and show notes)</li>
            <li>Fund watch: news, blogs, newsletters, videos and Form D filings for about 107 funds</li>
            <li>Courtside itself: its Medium posts, its portfolio page and The 4th Quarter</li>
            <li>Off by default (Settings › Sources): GitHub and GDELT</li>
          </ul>
          <h2 id="schedule">Schedule</h2>
          <ul>
            {Object.entries(JOBS).map(([k, j]) => (
              <li key={k}>
                {j.label}: {j.weekday === 1 ? "Mondays" : j.weekday === 0 ? "Sundays" : "every day"}, around {et(j.hourUtc)}
              </li>
            ))}
            <li>Refresh Now: any time, once an hour for everyone</li>
          </ul>
          <h2 id="privacy">Privacy</h2>
          <p>No personal data. An anonymous visitor ID (a cookie that names nobody) keeps one vote per browser. IP addresses are hashed for rate limits and never stored in the clear. No ad trackers. Theme, density and saved filters stay in your browser.</p>
          <h2 id="phase2">Phase II</h2>
          <p>Phase I is a quick prototype; Phase II is the production-ready version we build together: team-only access, trusted ratings, real-time updates, email alerts, social networks through the firm&apos;s accounts, PitchBook and Crunchbase, and LinkedIn.</p>
          <h2 id="credit">Credit</h2>
          <p>Designed and specified by Adrian Grant. Built by an AI coding agent from his prompt.</p>
          <p>
            <a className="btn red" href={ADRIAN_LINKEDIN} target="_blank" rel="noopener noreferrer" title="Opens Adrian Grant on LinkedIn in a new window" data-talk>
              Talk to Adrian
            </a>
          </p>
        </div>
        <aside className="rail">
          <div className="stick">
            <div>
              <p className="kicker">On This Page</p>
              <Toc items={TOC} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
