import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.MODEL || "claude-opus-4-8";
const MOCK = process.env.MOCK === "1";
const BEARER = process.env.X_BEARER_TOKEN; // paid X/Twitter API bearer token
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export const fintwitEnabled = !!BEARER || MOCK;

// Curated accounts: env override, else the config file.
function curatedAccounts() {
  if (process.env.FINTWIT_ACCOUNTS) {
    return process.env.FINTWIT_ACCOUNTS.split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/fintwit-accounts.json"), "utf8"));
    return cfg.accounts || [];
  } catch {
    return [];
  }
}

// Query the X API recent-search for tweets from the curated accounts that
// mention the company/ticker, grouped by author.
async function fetchFromX(symbol, company) {
  const accounts = curatedAccounts().slice(0, 20);
  if (!accounts.length) return [];
  const from = accounts.map((a) => `from:${a}`).join(" OR ");
  const mention = [symbol, company].filter(Boolean).map((t) => `"${t}"`).join(" OR ");
  const query = `(${from})${mention ? ` (${mention})` : ""} -is:retweet`;
  const url = new URL("https://api.twitter.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", "50");
  url.searchParams.set("tweet.fields", "author_id,created_at");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username,name");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${BEARER}` } });
  if (!res.ok) throw new Error(`X API error (HTTP ${res.status}). ${res.status === 429 ? "Rate limit reached." : ""}`);
  const data = await res.json();
  const users = new Map((data.includes?.users || []).map((u) => [u.id, u]));
  const byAuthor = new Map();
  for (const t of data.data || []) {
    const u = users.get(t.author_id);
    if (!u) continue;
    if (!byAuthor.has(u.username)) byAuthor.set(u.username, { handle: u.username, name: u.name, tweets: [] });
    byAuthor.get(u.username).tweets.push(t.text);
  }
  return [...byAuthor.values()]
    .sort((a, b) => b.tweets.length - a.tweets.length)
    .slice(0, 5)
    .map((i) => ({ ...i, tweets: i.tweets.slice(0, 6) }));
}

function mockInfluencers(symbol) {
  return [
    { handle: "unusual_whales", name: "unusual_whales", tweets: [`Flow into ${symbol} calls has been heavy; someone's positioning for a beat.`, `${symbol} membership renewals look sticky per card data.`] },
    { handle: "awealthofcs", name: "A Wealth of Common Sense", tweets: [`${symbol} is the definition of a boring compounder — buy-and-hold quality.`] },
  ];
}

// ---- list relevant influencers ----
router.get("/fintwit", requireAuth, async (req, res) => {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  const company = String(req.query.company || "").trim();
  try {
    if (MOCK) return res.json({ influencers: mockInfluencers(symbol || "COST") });
    if (!BEARER) return res.status(400).json({ error: "No X_BEARER_TOKEN configured for the Fintwit feature." });
    if (!symbol && !company) return res.json({ influencers: [] });
    res.json({ influencers: await fetchFromX(symbol, company) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---- summarize one influencer's stance into a scenario ----
const scenarioTool = {
  name: "submit_fintwit_scenario",
  description: "Summarize the influencer's implied view for this company into an alternative valuation scenario.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short scenario name attributing the view (e.g. '@handle: sticky renewals')." },
      description: { type: "string", description: "2-4 sentences describing the future this influencer implies for the company's key inputs." },
    },
    required: ["name", "description"],
  },
};

router.post("/fintwit/scenario", requireAuth, async (req, res) => {
  const p = req.body || {};
  try {
    if (MOCK) {
      return res.json({
        name: `@${p.handle}: sticky quality compounder`,
        description: `${p.handle} frames ${p.company || "the company"} as a durable compounder with sticky demand — implying steady free-cash-flow growth and a premium multiple holding. (Demo — add X_BEARER_TOKEN + ANTHROPIC_API_KEY for real summaries.)`,
      });
    }
    if (!anthropic) return res.status(400).json({ error: "No Anthropic API key configured." });
    const tweets = (p.tweets || []).map((t, i) => `(${i + 1}) ${t}`).join("\n");
    const prompt = `The Fintwit account @${p.handle} recently posted the following about ${p.company || "a company"}${p.ticker ? ` (${p.ticker})` : ""}:\n${tweets || "(no tweets provided)"}\n\nThe analyst is valuing it with: ${p.formulaText || "(unspecified)"}. Summarize @${p.handle}'s implied view into ONE alternative scenario: how would this account expect the valuation inputs to differ from a neutral base case? Attribute it to the handle. Call submit_fintwit_scenario once.`;
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      tools: [scenarioTool],
      tool_choice: { type: "tool", name: "submit_fintwit_scenario" },
      messages: [{ role: "user", content: prompt }],
    });
    const tool = message.content.find((b) => b.type === "tool_use");
    if (!tool) return res.status(502).json({ error: "Could not summarize the influencer." });
    res.json(tool.input);
  } catch (e) {
    res.status(e?.status || 500).json({ error: e.message });
  }
});

export default router;
