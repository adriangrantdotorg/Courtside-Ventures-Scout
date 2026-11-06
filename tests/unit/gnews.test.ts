// Google News links → the story's own address (11-06-26): the newer links hold only an id, so Google's redirect page is
// opened once for a signature that its batchexecute call trades for the address.
import { describe, it, expect } from "vitest";
import { googleId, signatureOf, batchBody, addressOf, articleUrl, resetLinks } from "@/lib/sources/gnews";
import { transport } from "@/lib/sources/http";

describe("Google News links", () => {
  it("reads the id, the page's signature and the answer's address", () => {
    expect(googleId("https://news.google.com/rss/articles/CBMiABC_-1?oc=5")).toBe("CBMiABC_-1");
    expect(googleId("https://entrackr.com/a")).toBeNull();
    expect(signatureOf('<c-wiz data-n-a-sg="AbC" data-n-a-ts="1730000000">')).toEqual({ sg: "AbC", ts: "1730000000" });
    expect(signatureOf("<html></html>")).toBeNull();
    expect(decodeURIComponent(batchBody("ID1", { sg: "S", ts: "9" }))).toContain('\\"ID1\\",9,\\"S\\"');
    expect(addressOf('[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://entrackr.com/hoopr\\",1]"]]')).toBe("https://entrackr.com/hoopr");
  });
  it("any other link passes through, and a Google link Google won't open is null, never the redirect", async () => {
    const real = transport.fetch;
    transport.fetch = (async () => new Response("no signature", { status: 200 })) as typeof fetch;
    try {
      resetLinks();
      expect(await articleUrl("https://entrackr.com/hoopr")).toBe("https://entrackr.com/hoopr");
      expect(await articleUrl("https://news.google.com/rss/articles/NOPE?oc=5")).toBeNull();
    } finally {
      transport.fetch = real;
    }
  });
});
