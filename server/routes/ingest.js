import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const MODEL = process.env.MODEL || "claude-opus-4-8";
const MOCK = process.env.MOCK === "1";
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Force a structured verdict: is the article relevant, and if so, the scenario.
const scenarioTool = {
  name: "submit_article_scenario",
  description:
    "Report whether the article contains enough relevant information about THIS company/thesis to define an alternative valuation scenario, and if so, describe that scenario.",
  input_schema: {
    type: "object",
    properties: {
      relevant: { type: "boolean", description: "True only if the article has substantive, company-relevant content that implies a distinct scenario." },
      name: { type: "string", description: "A short scenario name (e.g. 'Margin compression from tariffs'). Empty if not relevant." },
      description: { type: "string", description: "2-4 sentences describing the future the article depicts for this company, in plain language. Empty if not relevant." },
      reason: { type: "string", description: "If not relevant, one sentence on why (e.g. 'The article is about a different company')." },
    },
    required: ["relevant", "name", "description", "reason"],
  },
};

function prompt(p) {
  return `An analyst is valuing ${p.company || "a company"}${p.ticker ? ` (${p.ticker})` : ""} with the formula: ${p.formulaText || "(unspecified)"}.
${p.thesis ? `Their thesis: ${p.thesis}\n` : ""}
Read the attached article. If it contains substantive information relevant to THIS company and thesis, extract the single alternative future scenario it implies (how conditions would differ from the analyst's base case) as a short name + a 2-4 sentence description the analyst could hand to a valuation model. If the article is off-topic, about a different company, or too thin to imply a scenario, mark it not relevant and say why. Call submit_article_scenario exactly once.`;
}

// Extract a compact, factual context brief from an uploaded PDF, to be fed into
// the scenario run as additional grounding (not turned into a scenario).
router.post("/ingest/context", requireAuth, async (req, res) => {
  try {
    const { dataBase64, name, company, ticker } = req.body || {};
    if (MOCK) {
      return res.json({
        title: name || "document.pdf",
        text: `Demo context extracted from ${name || "the document"}: key figures and claims relevant to ${company || "the company"} would be summarized here. (Add an ANTHROPIC_API_KEY for real extraction.)`,
      });
    }
    if (!anthropic) return res.status(400).json({ error: "No Anthropic API key configured (or set MOCK=1)." });
    if (!dataBase64) return res.status(400).json({ error: "No file provided." });

    const instruction = `Extract a tight, factual brief from the attached document to help value ${company || "a company"}${ticker ? ` (${ticker})` : ""}. Pull concrete figures, guidance, dates, risks, and claims relevant to the valuation. Use short bullet points with the figure and its period/source where stated. Do not add outside information or opinions; if the document is off-topic, say so in one line.`;
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: dataBase64 } },
          { type: "text", text: instruction },
        ],
      }],
    });
    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) return res.status(502).json({ error: "Could not read the document." });
    res.json({ title: name || "document.pdf", text });
  } catch (err) {
    console.error("Context ingest failed:", err);
    res.status(err?.status || 500).json({ error: err?.message || "Document analysis failed." });
  }
});

router.post("/ingest/article", requireAuth, async (req, res) => {
  try {
    const { dataBase64 } = req.body || {};
    if (MOCK) {
      return res.json({
        relevant: true,
        name: "Article: margin pressure",
        description: "The article argues near-term margins compress as input costs rise faster than the company can pass through price, with membership growth cushioning but not offsetting the hit. (Demo — add an ANTHROPIC_API_KEY for real article analysis.)",
        reason: "",
      });
    }
    if (!anthropic) return res.status(400).json({ error: "No Anthropic API key configured (or set MOCK=1)." });
    if (!dataBase64) return res.status(400).json({ error: "No file provided." });

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      tools: [scenarioTool],
      tool_choice: { type: "tool", name: "submit_article_scenario" },
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: dataBase64 } },
          { type: "text", text: prompt(req.body || {}) },
        ],
      }],
    });
    const tool = message.content.find((b) => b.type === "tool_use");
    if (!tool) return res.status(502).json({ error: "Could not analyze the article." });
    res.json(tool.input);
  } catch (err) {
    console.error("Article ingest failed:", err);
    res.status(err?.status || 500).json({ error: err?.message || "Article analysis failed." });
  }
});

export default router;
