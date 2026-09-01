// controllers/marketingAgent.controller.js
import MarketingDraft from "../models/marketingDraft.model.js";
import {
  anthropic,
  MODEL,
  SEARCH_PACKAGES_TOOL,
  SEARCH_PROPERTIES_TOOL,
  runSearchPackages,
  runSearchProperties,
} from "../utils/agentTools.js";
import { sendApprovalMessage } from "./telegram.controller.js";

const MAX_TOOL_ITERATIONS = 4;
const MAX_BRIEF_LENGTH = 500;

const SYSTEM_PROMPT = `You write marketing emails for The Bush Collection, a safari lodge and beach property company in East Africa. You write copy only — you never send anything yourself; a human always approves before anything goes out.

Rules:
- Use the search tools to pull real packages/properties before writing about them. Never invent a name, price, or detail — if you're not sure something exists, search for it or leave it out.
- Warm, inviting travel-marketing tone. Not pushy, no fake urgency ("only 2 left!"), no exclamation-mark spam.
- Subject line: under 60 characters, no ALL CAPS, no spammy words ("free", "act now").
- Body: 150-300 words, one clear call to action linking to https://thebushcollection.africa/packages or https://thebushcollection.africa/collections as appropriate.
- HTML body should be simple, valid, inline-styled email HTML (a wrapping <div> with a couple of <p> tags and one styled <a> button) — no external stylesheets, no <script>, no images unless you have a real image URL from a tool result.

When you are done gathering information, respond with ONLY a single JSON object (no markdown fences, no other text) in exactly this shape:
{"subject": "...", "html": "...", "plainText": "..."}
"plainText" is the same message with all HTML tags stripped, for the campaign's plain-text alternative.`;

const TOOLS = [SEARCH_PACKAGES_TOOL, SEARCH_PROPERTIES_TOOL];

async function executeTool(name, input) {
  switch (name) {
    case "search_packages":
      return { packages: await runSearchPackages(input) };
    case "search_properties":
      return { properties: await runSearchProperties(input) };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function parseDraftJson(text) {
  // The model sometimes adds a sentence before/after the JSON despite instructions
  // not to — pull the JSON out of a fenced block if present, else out of the raw text,
  // rather than assuming the whole response is bare JSON.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in response");
  }
  const parsed = JSON.parse(candidate.slice(start, end + 1));
  if (!parsed.subject || !parsed.html || !parsed.plainText) {
    throw new Error("Response JSON missing subject/html/plainText");
  }
  return parsed;
}

export const listDrafts = async (req, res) => {
  try {
    const drafts = await MarketingDraft.find().sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, drafts });
  } catch (err) {
    console.error("listDrafts error:", err);
    res.status(500).json({ message: "Failed to list drafts." });
  }
};

export const generateCampaignDraft = async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ message: "The marketing agent is not configured yet." });
    }

    const brief = String(req.body?.brief || "").trim().slice(0, MAX_BRIEF_LENGTH);
    if (!brief) {
      return res.status(400).json({ message: "brief is required" });
    }

    const conversation = [{ role: "user", content: brief }];
    let finalText = "";

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: conversation,
      });

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      const textBlocks = response.content.filter((b) => b.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n").trim();

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      conversation.push({ role: "assistant", content: response.content });
      const toolResults = [];
      for (const toolUse of toolUses) {
        const result = await executeTool(toolUse.name, toolUse.input || {});
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
      }
      conversation.push({ role: "user", content: toolResults });
    }

    let draftContent;
    try {
      draftContent = parseDraftJson(finalText);
    } catch (parseErr) {
      console.error("Marketing agent JSON parse failed:", parseErr, "raw:", finalText);
      return res.status(502).json({ message: "The agent didn't return a usable draft. Try rephrasing the brief." });
    }

    const draft = await MarketingDraft.create({
      brief,
      subject: draftContent.subject,
      htmlBody: draftContent.html,
      plainText: draftContent.plainText,
      status: "pending",
      createdBy: req.admin?._id,
    });

    try {
      await sendApprovalMessage(draft);
    } catch (telegramErr) {
      console.error("Telegram send failed for draft", draft._id, telegramErr);
      return res.status(200).json({
        success: true,
        draftId: draft._id,
        subject: draft.subject,
        warning: "Draft saved, but sending it to Telegram for approval failed — check TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID.",
      });
    }

    res.json({ success: true, draftId: draft._id, subject: draft.subject });
  } catch (err) {
    console.error("generateCampaignDraft error:", err);
    res.status(500).json({ message: "Failed to generate campaign draft." });
  }
};
