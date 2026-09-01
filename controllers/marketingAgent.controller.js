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
import { sendApprovalMessage, supersedeApprovalMessage } from "./telegram.controller.js";

const MAX_TOOL_ITERATIONS = 4;
const MAX_BRIEF_LENGTH = 500;

const SYSTEM_PROMPT = `You write marketing emails for The Bush Collection, a safari lodge and beach property company in East Africa. You write copy only — you never send anything yourself; a human always approves before anything goes out.

Rules:
- Use the search tools to pull real packages/properties before writing about them. Never invent a name, price, or detail — if you're not sure something exists, search for it or leave it out.
- Warm, inviting travel-marketing tone. Not pushy, no fake urgency ("only 2 left!"), no exclamation-mark spam.
- Subject line: under 60 characters, no ALL CAPS, no spammy words ("free", "act now").
- Body: 150-300 words, one clear call to action linking to https://thebushcollection.africa/packages or https://thebushcollection.africa/collections as appropriate.
- HTML body should be simple, valid, inline-styled email HTML (a wrapping <div>, a couple of <p> tags, one styled <a> button) — no external stylesheets, no <script>.
- Images: when a package or property you're writing about has a real image URL in its tool result, prefer including ONE as a hero image at the top of the email: <img src="THE_URL" alt="..." style="width:100%;max-width:600px;border-radius:6px;margin-bottom:16px;" />. Never invent or guess an image URL — only use one that came directly from a tool result. If nothing suitable came back, skip the image entirely rather than leaving a broken one.

When you are done gathering information, respond with ONLY a single JSON object (no markdown fences, no other text) in exactly this shape:
{"subject": "...", "html": "...", "plainText": "...", "imageUrl": "... or null"}
"plainText" is the same message with all HTML tags and the image stripped, for the campaign's plain-text alternative. "imageUrl" is the same URL you used in the <img> tag (or null if you didn't include one) — it's tracked separately so the image survives if a human edits the text later.`;

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
  // Only trust it as an image if it's actually a URL — never let a stray string
  // or hallucinated non-URL value end up in an <img src>.
  if (typeof parsed.imageUrl !== "string" || !/^https?:\/\//i.test(parsed.imageUrl)) {
    parsed.imageUrl = undefined;
  }
  return parsed;
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Turns edited plain text back into the same simple inline-styled email HTML
// the agent generates, so staff only ever edit plain text (safe, no broken markup)
// while the actual sent email stays in the same visual style. Re-applies the
// draft's imageUrl (if any) so editing the wording doesn't silently drop the image.
function plainTextToHtml(plainText, imageUrl) {
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const escaped = escapeHtml(p).replace(/\n/g, "<br/>");
      // Turn a lone URL-only line into the same styled CTA button the agent uses.
      if (/^https?:\/\/\S+$/.test(p.trim())) {
        return `<p style="margin-top: 28px;"><a href="${p.trim()}" style="display: inline-block; background-color: #8B6F47; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Learn more</a></p>`;
      }
      return `<p>${escaped}</p>`;
    });
  const imageTag = imageUrl
    ? `<img src="${imageUrl}" alt="" style="width:100%;max-width:600px;border-radius:6px;margin-bottom:16px;" />`
    : "";
  return `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">${imageTag}${paragraphs.join("")}</div>`;
}

export const updateDraft = async (req, res) => {
  try {
    const draft = await MarketingDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ message: "Draft not found." });
    if (draft.status !== "pending" && draft.status !== "failed") {
      return res.status(409).json({ message: `Can't edit a draft that's already ${draft.status}.` });
    }

    const subject = String(req.body?.subject || "").trim();
    const plainText = String(req.body?.plainText || "").trim();
    if (!subject || !plainText) {
      return res.status(400).json({ message: "subject and plainText are required." });
    }

    // Snapshot the old message before mutating, so the "superseded" notice
    // reflects what the draft used to say, not the new content.
    const oldDraftSnapshot = draft.toObject();
    if (draft.telegramMessageId) {
      await supersedeApprovalMessage(oldDraftSnapshot);
    }

    draft.subject = subject;
    draft.plainText = plainText;
    draft.htmlBody = plainTextToHtml(plainText, draft.imageUrl);
    draft.status = "pending";
    draft.failureReason = undefined;
    await draft.save();

    try {
      await sendApprovalMessage(draft);
    } catch (telegramErr) {
      console.error("Telegram send failed for edited draft", draft._id, telegramErr);
      return res.json({
        success: true,
        draft,
        warning: "Draft updated, but re-sending it to Telegram failed — check TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID.",
      });
    }

    res.json({ success: true, draft });
  } catch (err) {
    console.error("updateDraft error:", err);
    res.status(500).json({ message: "Failed to update draft." });
  }
};

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
      // This usually isn't a bug — it's the agent legitimately unable to write a
      // grounded draft (e.g. the brief mentions inventory that doesn't exist) and
      // asking a clarifying question in plain text instead of forcing fake JSON.
      // Surface that question rather than a generic, unhelpful error.
      const agentMessage = finalText?.trim();
      return res.status(422).json({
        message: agentMessage
          ? `The agent needs more info before it can write this: "${agentMessage}"`
          : "The agent didn't return a usable draft. Try rephrasing the brief.",
      });
    }

    const draft = await MarketingDraft.create({
      brief,
      subject: draftContent.subject,
      htmlBody: draftContent.html,
      plainText: draftContent.plainText,
      imageUrl: draftContent.imageUrl,
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
