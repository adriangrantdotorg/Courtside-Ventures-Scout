// The live Today page as a browser draws it (live times filled in), in the dark look Adrian's Mac uses.
// Run with the repo's Playwright: cd <a folder with node_modules/@playwright/test> && node <this file> <url>
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const { chromium } = require("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await page.goto(process.argv[2], { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
process.stdout.write(await page.content());
await browser.close();
