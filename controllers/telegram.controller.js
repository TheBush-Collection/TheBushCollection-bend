// controllers/telegram.controller.js
import MarketingDraft from "../models/marketingDraft.model.js";
import { createAndSendCampaign } from "./mailchimp.controller.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

async function telegramApi(method, params) {
  if (!API_BASE) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  const resp = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  if (!data.ok) {
    const err = new Error(data.description || `Telegram API error calling ${method}`);
    err.response = data;
    throw err;
  }
  return data.result;
}

function draftPreviewText(draft) {
  const bodyPreview = draft.plainText.length > 500 ? `${draft.plainText.slice(0, 500)}…` : draft.plainText;
  return `📣 *New campaign draft*\n\n*Subject:* ${draft.subject}\n\n${bodyPreview}\n\n_Brief: ${draft.brief}_`;
}

export async function sendApprovalMessage(draft) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_ADMIN_CHAT_ID not configured");

  const result = await telegramApi("sendMessage", {
    chat_id: chatId,
    text: draftPreviewText(draft),
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approve & Send", callback_data: `approve:${draft._id}` },
        { text: "❌ Reject", callback_data: `reject:${draft._id}` },
      ]],
    },
  });

  draft.telegramChatId = String(result.chat.id);
  draft.telegramMessageId = String(result.message_id);
  await draft.save();
}

async function updateApprovalMessage(draft, extraText) {
  if (!draft.telegramChatId || !draft.telegramMessageId) return;
  try {
    await telegramApi("editMessageText", {
      chat_id: draft.telegramChatId,
      message_id: Number(draft.telegramMessageId),
      text: `${draftPreviewText(draft)}\n\n${extraText}`,
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("Telegram editMessageText failed:", err);
  }
}

export const handleWebhook = async (req, res) => {
  // Respond fast and always 200 — Telegram retries aggressively on non-200s,
  // and callback processing errors below are logged, not surfaced to Telegram.
  res.status(200).end();

  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn("Telegram webhook: bad or missing secret token");
    return;
  }

  const callback = req.body?.callback_query;
  if (!callback || typeof callback.data !== "string") return;

  const [action, draftId] = callback.data.split(":");
  if (!draftId || (action !== "approve" && action !== "reject")) return;

  try {
    const draft = await MarketingDraft.findById(draftId);
    if (!draft) {
      await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "Draft not found." });
      return;
    }
    if (draft.status !== "pending") {
      await telegramApi("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: `Already ${draft.status}.`,
      });
      return;
    }

    if (action === "reject") {
      draft.status = "rejected";
      await draft.save();
      await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "Rejected." });
      await updateApprovalMessage(draft, "❌ *Rejected — nothing was sent.*");
      return;
    }

    // action === "approve"
    // Fail closed: never send to the full audience by accident. Approving requires
    // EITHER a configured test segment OR an explicit opt-in to full-audience sends.
    if (!process.env.MAILCHIMP_TEST_SEGMENT_ID && process.env.MAILCHIMP_ALLOW_FULL_AUDIENCE_SEND !== "true") {
      draft.status = "failed";
      draft.failureReason = "No MAILCHIMP_TEST_SEGMENT_ID configured and MAILCHIMP_ALLOW_FULL_AUDIENCE_SEND is not 'true' — refusing to send to the full audience.";
      await draft.save();
      await telegramApi("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Blocked: no test segment configured. See server .env.",
      });
      await updateApprovalMessage(draft, `🛑 *Not sent — no Mailchimp test segment configured.* Set MAILCHIMP_TEST_SEGMENT_ID (or MAILCHIMP_ALLOW_FULL_AUDIENCE_SEND=true once you're ready for real sends) and generate a new draft.`);
      return;
    }

    try {
      const { campaignId } = await createAndSendCampaign({
        subject: draft.subject,
        html: draft.htmlBody,
        segmentId: process.env.MAILCHIMP_TEST_SEGMENT_ID,
      });
      draft.status = "sent";
      draft.mailchimpCampaignId = campaignId;
      await draft.save();
      await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "Sent!" });
      const target = process.env.MAILCHIMP_TEST_SEGMENT_ID ? "test segment" : "full audience";
      await updateApprovalMessage(draft, `✅ *Approved and sent to Mailchimp (${target}).*`);
    } catch (sendErr) {
      console.error("Mailchimp send failed:", sendErr);
      draft.status = "failed";
      draft.failureReason = sendErr.message;
      await draft.save();
      await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "Send failed — check logs." });
      await updateApprovalMessage(draft, `⚠️ *Approved, but sending failed:* ${sendErr.message}`);
    }
  } catch (err) {
    console.error("Telegram webhook handling error:", err);
  }
};

/** One-time setup: point Telegram's webhook at this backend. Run manually, not on every boot. */
export async function registerWebhook(publicUrl) {
  return telegramApi("setWebhook", {
    url: `${publicUrl.replace(/\/$/, "")}/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
  });
}
