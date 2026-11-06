// Parts of Scout that can be switched off in one place.

/** Slack (11-06-26: "No Slack anywhere"): off. That hides Settings › Slack, Share to Slack on the IC Meeting, Backtest
 *  and About, the Connect Slack links, and the alert-hit and Monday-brief posts, and /api/slack/* answers 404. The code
 *  stays: turning it back on needs a Slack app of the firm's (its client id and secret as Vercel settings). */
export const SLACK = false;
