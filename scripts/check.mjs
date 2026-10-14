// Headless page check: console errors and the main text (off-screen, never shown).
import { chromium, webkit } from "@playwright/test";
const b = await (process.env.ENGINE === "webkit" ? webkit : chromium).launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
await p.goto(process.argv[2], { waitUntil: "domcontentloaded", timeout: 20000 });
await p.waitForTimeout(2500);
console.log(errs.join("\n").slice(0, 3000));
console.log("text:", (await p.locator("main").innerText()).slice(0, 400));
if (process.argv[3]) await p.screenshot({ path: process.argv[3] });
await b.close();
