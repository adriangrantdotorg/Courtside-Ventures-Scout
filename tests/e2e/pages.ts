export const HOME = process.env.LIVE_URL ? "/" : "/preview";
export const PAGES = [HOME, "/pipeline", "/company/3", "/trends", "/sponsors", "/culture", "/tracking", "/brief", "/backtest", "/throw-some-ds", "/neighborhood", "/synergistic-funders", "/settings", "/about"];
export const LIVE = !!process.env.LIVE_URL;
export const IGNORE_CONSOLE = /favicon|Failed to load resource|s2\/favicons|status of 404|ERR_BLOCKED|net::ERR|Download the React DevTools|unavatar/i;
