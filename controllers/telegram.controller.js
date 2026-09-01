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

// Telegram messages allow ~4096 chars, comfortably more than a 150-300 word
// email — only clip in the unlikely case a draft runs unusually long, so
// reviewers always see the real content rather than a chopped-off preview.
function draftPreviewText(draft) {
  const bodyPreview = draft.plainText.length > 3200 ? `${draft.plainText.slice(0, 3200)}…` : draft.plainText;
  return `📣 *Campaign draft*\n\n*Subject:* ${draft.subject}\n\n${bodyPreview}\n\n_Brief: ${draft.brief}_`;
}

// Photo captions are capped at 1024 chars by Telegram — much tighter than a
// text message, so this is a shorter version used only when sending the image.
// The full text is still always available on the admin page.
function draftPreviewCaption(draft) {
  const bodyPreview = draft.plainText.length > 700 ? `${draft.plainText.slice(0, 700)}…` : draft.plainText;
  return `📣 *Campaign draft*\n\n*Subject:* ${draft.subject}\n\n${bodyPreview}`;
}

const approvalButtons = (draftId) => ({
  inline_keyboard: [[
    { text: "✅ Approve & Send", callback_data: `approve:${draftId}` },
    { text: "❌ Reject", callback_data: `reject:${draftId}` },
  ]],
});

export async function sendApprovalMessage(draft) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_ADMIN_CHAT_ID not configured");

  const result = draft.imageUrl
    ? await telegramApi("sendPhoto", {
        chat_id: chatId,
        photo: draft.imageUrl,
        caption: draftPreviewCaption(draft),
        parse_mode: "Markdown",
        reply_markup: approvalButtons(draft._id),
      })
    : await telegramApi("sendMessage", {
        chat_id: chatId,
        text: draftPreviewText(draft),
        parse_mode: "Markdown",
        reply_markup: approvalButtons(draft._id),
      });

  draft.telegramChatId = String(result.chat.id);
  draft.telegramMessageId = String(result.message_id);
  await draft.save();
}

// Edits a resolved draft's message to show the outcome and removes its buttons
// (Telegram keeps the old inline keyboard on an edit unless you explicitly clear it —
// without this, a resolved message would stay tappable). Photo messages can only be
// edited via editMessageCaption, not editMessageText, so this branches on whether
// the message this draft points at was sent as a photo (i.e. had an image at send-time).
async function updateApprovalMessage(draft, extraText) {
  if (!draft.telegramChatId || !draft.telegramMessageId) return;
  try {
    const base = { chat_id: draft.telegramChatId, message_id: Number(draft.telegramMessageId), reply_markup: { inline_keyboard: [] } };
    if (draft.imageUrl) {
      await telegramApi("editMessageCaption", { ...base, caption: `${draftPreviewCaption(draft)}\n\n${extraText}`, parse_mode: "Markdown" });
    } else {
      await telegramApi("editMessageText", { ...base, text: `${draftPreviewText(draft)}\n\n${extraText}`, parse_mode: "Markdown" });
    }
  } catch (err) {
    console.error("Telegram message update failed:", err);
  }
}

/** Marks a draft's existing Telegram message as superseded (used when it's edited) and clears its buttons. */
export async function supersedeApprovalMessage(draft) {
  await updateApprovalMessage(draft, "✏️ *Edited — see the new version below.*");
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

    let campaignId;
    try {
      ({ campaignId } = await createAndSendCampaign({
        subject: draft.subject,
        html: draft.htmlBody,
        segmentId: process.env.MAILCHIMP_TEST_SEGMENT_ID,
      }));
    } catch (sendErr) {
      console.error("Mailchimp send failed:", sendErr);
      draft.status = "failed";
      draft.failureReason = sendErr.message;
      await draft.save();
      await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "Send failed — check logs." }).catch(() => {});
      await updateApprovalMessage(draft, `⚠️ *Approved, but sending failed:* ${sendErr.message}`);
      return;
    }

    // The send itself succeeded — persist that BEFORE touching Telegram again.
    // A stale/expired callback_query (e.g. from a delayed webhook retry) must never
    // make a real, already-sent campaign look like it failed.
    draft.status = "sent";
    draft.mailchimpCampaignId = campaignId;
    await draft.save();
    await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "Sent!" }).catch((err) =>
      console.error("answerCallbackQuery failed (send already succeeded, harmless):", err)
    );
    const target = process.env.MAILCHIMP_TEST_SEGMENT_ID ? "test segment" : "full audience";
    await updateApprovalMessage(draft, `✅ *Approved and sent to Mailchimp (${target}).*`);
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
