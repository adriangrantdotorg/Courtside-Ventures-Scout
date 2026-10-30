// Brand Sky: the Must See masthead for a startup with no product picture (Adrian picked it 10-30-26, then asked that it
// always work). One layout: a backdrop, the startup's mark in the open sky on the right, a dark fade on the left. Each
// part takes the first thing that exists, and the last step needs nothing from the startup:
//   backdrop: the homepage's hero art → a sky painted in the startup's colors → a sky in its thesis area's colors
//   mark:     the logo from the site header → its app or touch icon next to the name → a letter tile and the name
//   colors:   the site's theme color → the logo's two main colors → the thesis area's palette
// Pure: the enrich job (src/lib/jobs/brand.ts) finds the parts; the masthead (BrandSky in V2.tsx) draws them.
import type { Brand, Media } from "@/db/schema";

export type Rgb = [number, number, number];
export type Sky = { top: string; mid: string; low: string; sun: string; cloud: string; tile: string; tileInk: string };

const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));

export function hexToRgb(hex: string): Rgb | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}
export const rgbToHex = (c: Rgb) => "#" + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");

export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** A color that says something about a brand: not near white, black or gray. */
export function isBrandColor(c: Rgb): boolean {
  const [, s, l] = rgbToHsl(c);
  return s >= 0.22 && l >= 0.1 && l <= 0.9;
}

/** Two colors a viewer tells apart: hues 30° apart, or one much lighter. */
export function distinct(a: Rgb, b: Rgb): boolean {
  const [ha, , la] = rgbToHsl(a), [hb, , lb] = rgbToHsl(b);
  return 180 - Math.abs(Math.abs(ha - hb) - 180) > 30 || Math.abs(la - lb) > 0.3;
}

/** The two main brand colors in an image's pixels (RGBA, 4 bytes each): opaque, colorful pixels, grouped by hue,
 *  the biggest group first; the second only when its hue is clearly different. */
export function mainColors(px: Uint8Array | Buffer, max = 2): string[] {
  const groups = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 200) continue;
    const c: Rgb = [px[i], px[i + 1], px[i + 2]];
    if (!isBrandColor(c)) continue;
    const [h, , l] = rgbToHsl(c);
    const key = Math.round(h / 20) * 10 + Math.round(l * 4); // 18 hues × 5 lightness steps
    const g = groups.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    g.n++;
    g.r += c[0];
    g.g += c[1];
    g.b += c[2];
    groups.set(key, g);
  }
  const total = [...groups.values()].reduce((a, g) => a + g.n, 0);
  const out: Rgb[] = [];
  for (const g of [...groups.values()].sort((a, b) => b.n - a.n)) {
    if (g.n < total * 0.04) break;
    const c: Rgb = [g.r / g.n, g.g / g.n, g.b / g.n];
    if (out.every((o) => distinct(o, c))) out.push(c);
    if (out.length >= max) break;
  }
  return out.map(rgbToHex);
}

/** Light or dark: the average luminance of an image's opaque pixels. A logo's tone decides whether it reads on the sky. */
export function toneOf(px: Uint8Array | Buffer): "light" | "dark" | null {
  let sum = 0, n = 0;
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    sum += luminance([px[i], px[i + 1], px[i + 2]]);
    n++;
  }
  return n ? (sum / n > 0.4 ? "light" : "dark") : null;
}

/** Each thesis area's sky, for a startup with no colors of its own. */
export const AREA_SKY: Record<string, { base: string; sun: string }> = {
  sports: { base: "#1d3b8f", sun: "#ff8a3d" },
  gaming: { base: "#4a1d8f", sun: "#ff3dc8" },
  lifestyle: { base: "#7a2357", sun: "#ffb38a" },
  health: { base: "#14595a", sun: "#9ef0c4" },
  media: { base: "#3a2378", sun: "#ffb347" },
};
const DEFAULT_SKY = { base: "#26304a", sun: "#9ec3ff" };

/** The painted sky: always dark enough for Scout's white text, tinted with the brand's main color, its second color
 *  (or a lighter take on the first) as the sun. */
export function skyFor(colors: string[] | undefined, area: string | null): Sky {
  const cs = (colors || []).map(hexToRgb).filter((c): c is Rgb => !!c && isBrandColor(c));
  const pal = AREA_SKY[area || ""] || DEFAULT_SKY;
  const base = cs[0] || hexToRgb(pal.base)!;
  const [h, s0] = rgbToHsl(base);
  const s = clamp(s0, 0.35, 0.75);
  const sunRgb = cs[1] || (cs[0] ? hslToRgb(h, clamp(s0 + 0.1, 0.5, 0.95), 0.72) : hexToRgb(pal.sun)!);
  const rgba = (c: Rgb, a: number) => `rgba(${c.map((v) => Math.round(v)).join(",")},${a})`;
  const tile = cs[0] ? sunRgb : hexToRgb(pal.sun)!;
  return {
    top: rgbToHex(hslToRgb(h, s, 0.11)),
    mid: rgbToHex(hslToRgb(h, s, 0.2)),
    low: rgbToHex(hslToRgb(h, s, 0.06)),
    sun: rgba(sunRgb, 0.42),
    cloud: rgba(hslToRgb(rgbToHsl(sunRgb)[0], 0.5, 0.92), 0.18),
    tile: rgbToHex(tile),
    tileInk: luminance(tile) > 0.35 ? rgbToHex(hslToRgb(h, s, 0.1)) : "#ffffff",
  };
}

/** Must See draws Brand Sky unless Scout has a real product picture: a YouTube frame, App Store screenshots, or a
 *  product video with no poster. A website's share image is never the masthead: it often carries its own headline
 *  (Helios's "Expanding the Frontier of Humanity" sat under Scout's text, 10-30-26). */
export function usesSky(m: Media): boolean {
  if (m.kind === "yt" || m.kind === "shots") return false;
  if (m.kind === "mp4") return !!m.poster;
  return true;
}

export type SkyPlan = {
  tier: 1 | 2 | 3;
  art: string | null;
  mark: { kind: "logo"; src: string; tone: "light" | "dark" | null } | { kind: "icon"; src: string } | { kind: "letter" };
  sky: Sky;
  /** a dark mark on the dark sky is drawn white, a light one on light art is drawn dark */
  flip: boolean;
};

/** What the masthead draws, from what the enrich job found (or nothing at all). */
export function skyPlan(c: { name: string; thesisArea: string | null; logo: string | null; media: Media }): SkyPlan {
  const b: Brand = c.media.brand || {};
  const sky = skyFor(b.colors, c.thesisArea);
  const art = b.art || null;
  const backdropLight = !!art && b.artTone === "light";
  const icon = c.logo && !c.logo.includes("google.com/s2/favicons") ? c.logo : null;
  const mark: SkyPlan["mark"] = b.mark ? { kind: "logo", src: b.mark, tone: b.markTone || null } : icon ? { kind: "icon", src: icon } : { kind: "letter" };
  const tone = mark.kind === "logo" ? mark.tone : null;
  const flip = !!tone && (backdropLight ? tone === "light" : tone === "dark");
  return { tier: art ? 1 : mark.kind === "letter" ? 3 : 2, art, mark, sky, flip };
}
