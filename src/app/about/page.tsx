import { Phase2Link } from "@/components/Phase2Link";
import type { Metadata } from "next";
import { DocHead, Toc } from "@/components/doc";
import { JOBS } from "@/lib/jobs";
import { ADRIAN_LINKEDIN } from "@/lib/phase2";

export const metadata: Metadata = { title: "About" };

const TOC = [
  { id: "how", label: "How it works" },
  { id: "sources", label: "Sources" },
  { id: "schedule", label: "Schedule" },
  { id: "phase2", label: "Phase II" },
];

function et(hourUtc: number) {
  const h = (hourUtc - 4 + 24) % 24;
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"} ET`;
}

export default function Page() {
  return (
    <div>
      <DocHead
        label="About"
        title="Courtside Ventures Scout"
        lede={
          <>
            A prototype deal-sourcing site for Courtside Ventures built by Adrian Grant.
            <span style={{ display: "block", marginTop: 14 }}>
              <a className="btn red" href={ADRIAN_LINKEDIN} target="_blank" rel="noopener noreferrer" title="Opens Adrian Grant on LinkedIn in a new window" data-talk>
                Talk to Adrian
              </a>
            </span>
          </>
        }
        slackText="About Courtside Ventures Scout."
      />
      <div className="doc">
        <div className="main">
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
          <h2 id="phase2">Phase II</h2>
          <p>Phase I is a quick prototype; <Phase2Link /> is the production-ready version we build together: team-only access, trusted ratings, real-time updates, email alerts, social networks through the firm&apos;s accounts, PitchBook and Crunchbase, and LinkedIn.</p>
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
