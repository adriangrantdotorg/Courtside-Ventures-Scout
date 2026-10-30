// Brand Sky's parts for one startup (src/lib/brand.ts says what each tier draws). The homepage names the candidates
// (brandBits); this loads each one and measures it: hero art must be a real landscape picture, a logo is light or
// dark, and the colors come from the site's theme color, then its icon, then its logo. Anything that doesn't load or
// decode is skipped, and without sharp the masthead still draws the lower tiers.
import type { Brand } from "@/db/schema";
import { brandBits } from "../enrich";
import { fetchImage } from "../sources/http";
import { distinct, hexToRgb, isBrandColor, mainColors, toneOf } from "../brand";

type Sharp = typeof import("sharp").default;
let sharpMod: Sharp | null | undefined;
async function sharp(): Promise<Sharp | null> {
  if (sharpMod === undefined) {
    try {
      sharpMod = (await import("sharp")).default;
    } catch {
      sharpMod = null;
    }
  }
  return sharpMod;
}

type Measured = { w: number; h: number; px: Buffer; right: Buffer };
/** An image's size and its pixels at 96 px wide (the whole image, and the right half where the mark sits). */
export async function measure(buf: Buffer): Promise<Measured | null> {
  const S = await sharp();
  if (!S) return null;
  try {
    const img = S(buf, { density: 144, failOn: "none" });
    const meta = await img.metadata();
    const w = meta.width || 0, h = meta.height || 0;
    if (!w || !h) return null;
    const small = await S(buf, { density: 144, failOn: "none" }).resize({ width: 96, height: 96, fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: sw, height: sh } = small.info;
    const right = Buffer.alloc(Math.ceil(sw / 2) * sh * 4);
    let o = 0;
    for (let y = 0; y < sh; y++) for (let x = Math.floor(sw / 2); x < sw; x++) for (let k = 0; k < 4; k++) right[o++] = small.data[(y * sw + x) * 4 + k];
    return { w, h, px: small.data, right: right.subarray(0, o) };
  } catch {
    return null;
  }
}

/** Hero art, the logo that reads on the backdrop, and up to two brand colors. `icon` is the site's app/touch icon. */
export async function brandFor(html: string, base: string, name: string, icon: string | null): Promise<Brand> {
  const bits = brandBits(html, base, name);
  const out: Brand = {};
  for (const u of bits.art) {
    const buf = await fetchImage(u);
    const m = buf && (await measure(buf));
    if (!m || m.w < 1000 || m.w / m.h < 1.3) continue; // a real landscape picture, not a thumbnail or a portrait
    out.art = u;
    out.artTone = toneOf(m.right) || "dark";
    break;
  }
  const want = out.art && out.artTone === "light" ? "dark" : "light";
  const marks: { u: string; tone: "light" | "dark" | null; px: Buffer }[] = [];
  for (const u of bits.marks) {
    const buf = await fetchImage(u);
    const m = buf && (await measure(buf));
    if (!m || m.w < 64) continue;
    marks.push({ u, tone: toneOf(m.px), px: m.px });
    if (marks.some((k) => k.tone === want)) break;
  }
  const mark = marks.find((k) => k.tone === want) || marks[0];
  if (mark) {
    out.mark = mark.u;
    if (mark.tone) out.markTone = mark.tone;
  }
  const colors: string[] = [];
  const add = (cs: string[]) => {
    for (const c of cs) if (colors.length < 2 && colors.every((k) => distinct(hexToRgb(k)!, hexToRgb(c)!))) colors.push(c);
  };
  const tc = bits.themeColor && hexToRgb(bits.themeColor);
  if (tc && isBrandColor(tc)) add([bits.themeColor!.toLowerCase()]);
  if (icon && colors.length < 2) {
    const buf = await fetchImage(icon);
    const m = buf && (await measure(buf));
    if (m) add(mainColors(m.px));
  }
  for (const k of marks) if (colors.length < 2) add(mainColors(k.px));
  if (colors.length) out.colors = colors;
  return out;
}

/** No website: the colors of the App Store icon, when there is one. */
export async function iconBrand(icon: string | null): Promise<Brand> {
  const buf = icon ? await fetchImage(icon) : null;
  const m = buf && (await measure(buf));
  const colors = m ? mainColors(m.px) : [];
  return colors.length ? { colors } : {};
}
