import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { brandBits } from "@/lib/enrich";
import { AREA_SKY, hexToRgb, luminance, mainColors, skyFor, skyPlan, toneOf, usesSky } from "@/lib/brand";
import { brandFor } from "@/lib/jobs/brand";
import { transport, resetBackoff } from "@/lib/sources/http";
import type { Media } from "@/db/schema";

// Brand Sky (Adrian, 10-30-26): the Must See masthead for a startup with no product picture, and it must always work.

const fx = (f: string) => readFileSync(`tests/fixtures/${f}`, "utf8");

describe("brandBits: what a homepage offers Brand Sky", () => {
  it("Helios: the sky it loads first, its own lockups, never its backer's logo", () => {
    const b = brandBits(fx("helios-home.html"), "https://www.heliosinc.ai/", "Helios Intelligence");
    expect(b.art[0]).toContain("clouds_poster.jpg");
    expect(b.marks).toContain("https://www.heliosinc.ai/brand/helios-lockup-cypress.svg"); // "cypress" is not "press"
    expect(b.marks).toContain("https://www.heliosinc.ai/brand/helios-lockup-cream.svg");
    expect(b.marks.some((u) => u.includes("formation"))).toBe(false);
  });
  it("Axo Longevity: no hero art, its header logos, not the payment logos", () => {
    const b = brandBits(fx("axo-home.html"), "https://www.axolongevity.com/", "Axo Longevity");
    expect(b.art).toEqual([]);
    expect(b.marks).toEqual(["https://join.axolongevity.com/assets/images/logo-white.png", "https://join.axolongevity.com/assets/images/logo-dark.png"]);
  });
});

describe("usesSky: Must See draws Brand Sky unless Scout has a real product picture", () => {
  const m = (x: Partial<Media>) => ({ kind: "logo", ...x }) as Media;
  it.each([
    [m({ kind: "yt", yt: "abcdefghijk" }), false],
    [m({ kind: "shots", shots: ["a"] }), false],
    [m({ kind: "mp4", mp4: "v.mp4" }), false],
    [m({ kind: "mp4", mp4: "v.mp4", poster: "share.jpg" }), true], // the poster is the site's share image
    [m({ kind: "site", img: "share.jpg" }), true],
    [m({ kind: "logo" }), true],
  ])("%j → %s", (media, want) => expect(usesSky(media)).toBe(want));
});

describe("skyPlan: every tier, and the last one needs nothing", () => {
  const base = { name: "Helios Intelligence", thesisArea: "health", logo: "https://heliosinc.ai/apple-icon.png" };
  it("tier 1: site art with the logo that reads on it", () => {
    const p = skyPlan({ ...base, media: { kind: "mp4", brand: { art: "a.jpg", artTone: "light", mark: "cypress.svg", markTone: "dark", colors: ["#153828"] } } });
    expect(p).toMatchObject({ tier: 1, art: "a.jpg", mark: { kind: "logo", src: "cypress.svg" }, flip: false });
  });
  it("tier 1: only a light logo on light art is drawn dark", () => {
    expect(skyPlan({ ...base, media: { kind: "mp4", brand: { art: "a.jpg", artTone: "light", mark: "cream.svg", markTone: "light" } } }).flip).toBe(true);
  });
  it("tier 2: a logo on the painted sky, a dark one drawn white", () => {
    expect(skyPlan({ ...base, media: { kind: "logo", brand: { mark: "white.png", markTone: "light" } } })).toMatchObject({ tier: 2, flip: false });
    expect(skyPlan({ ...base, media: { kind: "logo", brand: { mark: "dark.png", markTone: "dark" } } })).toMatchObject({ tier: 2, flip: true });
  });
  it("tier 2: no logo found, the app or touch icon next to the name", () => {
    expect(skyPlan({ ...base, media: { kind: "logo" } })).toMatchObject({ tier: 2, mark: { kind: "icon", src: base.logo } });
  });
  it("tier 3: nothing at all (or only Google's favicon) is a letter tile on the area's sky", () => {
    for (const logo of [null, "https://www.google.com/s2/favicons?sz=128&domain=x.com"]) {
      const p = skyPlan({ name: "Chaos", thesisArea: "media", logo, media: { kind: "logo" } });
      expect(p).toMatchObject({ tier: 3, art: null, mark: { kind: "letter" } });
    }
  });
});

describe("skyFor: the painted sky is always dark enough for Scout's white words", () => {
  const contrast = (hex: string) => 1.05 / (luminance(hexToRgb(hex)!) + 0.05);
  const cases: [string[] | undefined, string | null][] = [
    [undefined, null],
    ...Object.keys(AREA_SKY).map((a) => [undefined, a] as [undefined, string]),
    [["#0f3d3d", "#d3f963"], "health"],
    [["#ffde00"], "sports"], // a bright yellow brand
    [["#fbf7ea"], "health"], // cream is not a brand color: the area's sky
    [["#ffffff", "#000000"], "gaming"],
  ];
  it.each(cases)("%j in %s", (colors, area) => {
    const s = skyFor(colors, area);
    for (const k of [s.top, s.mid, s.low]) expect(contrast(k)).toBeGreaterThanOrEqual(7);
  });
  it("tints the sky with the brand's own color, and falls back to the area's", () => {
    const axo = skyFor(["#0f3d3d", "#d3f963"], "health");
    expect(axo.sun).toBe("rgba(211,249,99,0.42)"); // Axo's lime is the sun
    expect(skyFor(["#fbf7ea"], "media")).toEqual(skyFor(undefined, "media"));
  });
});

describe("pixels: tone and main colors", () => {
  const px = (...cs: [number, number, number, number][]) => Buffer.from(cs.flat());
  it("reads light and dark logos, ignoring transparent pixels", () => {
    expect(toneOf(px([251, 247, 234, 255], [0, 0, 0, 0]))).toBe("light");
    expect(toneOf(px([15, 51, 35, 255], [255, 255, 255, 0]))).toBe("dark");
    expect(toneOf(px([0, 0, 0, 0]))).toBeNull();
  });
  it("finds the two colors that make a brand, not the white and black around them", () => {
    const teal: [number, number, number, number] = [15, 61, 61, 255], lime: [number, number, number, number] = [211, 249, 99, 255];
    const cs = mainColors(px(...Array(60).fill(teal), ...Array(30).fill(lime), ...Array(80).fill([255, 255, 255, 255]), ...Array(40).fill([0, 0, 0, 255])));
    expect(cs).toEqual(["#0f3d3d", "#d3f963"]);
  });
});

describe("brandFor: loads and measures what the homepage names", () => {
  const real = transport.fetch;
  afterEach(() => {
    transport.fetch = real;
  });
  it("picks the art, the logo that reads on it, and the icon's colors; skips what doesn't load", async () => {
    resetBackoff();
    const sky = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#dfe8f5" } }).jpeg().toBuffer();
    const svg = (fill: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="${fill}"/></svg>`);
    const icon = await sharp({ create: { width: 180, height: 180, channels: 4, background: "#0f3323" } }).png().toBuffer();
    const files: Record<string, [Buffer, string]> = {
      "https://cdn.example.com/hero.jpg": [sky, "image/jpeg"],
      "https://acme.example/brand/acme-logo-light.svg": [svg("#fbf7ea"), "image/svg+xml"],
      "https://acme.example/brand/acme-logo-dark.svg": [svg("#0f3323"), "image/svg+xml"],
      "https://acme.example/icon.png": [icon, "image/png"],
    };
    transport.fetch = (async (url: string) => {
      const f = files[String(url)];
      return f ? new Response(new Uint8Array(f[0]), { status: 200, headers: { "content-type": f[1] } }) : new Response("nope", { status: 404, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    const html = `<head><link rel="preload" as="image" href="https://cdn.example.com/gone.jpg" fetchpriority="high"><link rel="preload" as="image" href="https://cdn.example.com/hero.jpg" fetchpriority="high"></head>
      <img class="logo" src="/brand/acme-logo-light.svg" alt="Acme"><img class="logo" src="/brand/acme-logo-dark.svg" alt="Acme"><img src="/brand/investor-logo.png" alt="Formation">`;
    const b = await brandFor(html, "https://acme.example/", "Acme", "https://acme.example/icon.png");
    expect(b).toMatchObject({ art: "https://cdn.example.com/hero.jpg", artTone: "light", mark: "https://acme.example/brand/acme-logo-dark.svg", markTone: "dark" });
    expect(b.colors?.[0]).toBe("#0f3323");
  });
});
