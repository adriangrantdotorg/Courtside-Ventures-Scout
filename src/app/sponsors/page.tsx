import type { Metadata } from "next";
import { sponsorCards } from "@/lib/queries";
import { SponsorsView } from "@/components/SponsorsView";

export const revalidate = 300;
export const metadata: Metadata = { title: "Sponsor Radar" };

export default async function Page() {
  const cards = await sponsorCards();
  return (
    <div>
      <div className="ph">
        <h1>Sponsor Radar</h1>
        <span className="count">{cards.length} brands · sorted by number of shows, then newest</span>
      </div>
      <p className="ph-lede">
        Brands buying ads on shows synergistic with Courtside&apos;s thesis. A brand that starts buying ads across several culture shows has usually just raised or is scaling. Example: Rhoback sponsored
        Spittin&apos; Chiclets in 100 episodes starting 01-07-25, then took its first outside money, about $50M from the athlete-backed CHAMP fund, on 06-16-26 (
        <a href="https://fashionunited.com/news/business/champ-fund-invests-in-american-activewear-brand-rhoback/2026061672997" target="_blank" rel="noopener noreferrer" title="Opens FashionUnited in a new window">
          FashionUnited
        </a>
        ).
      </p>
      <p className="ph-lede" style={{ color: "var(--text-3)", fontSize: 14.5 }}>
        Many shows insert ads automatically and leave them out of show notes, so the radar sees part of the picture; transcripts widen it.
      </p>
      <SponsorsView cards={cards} />
    </div>
  );
}
