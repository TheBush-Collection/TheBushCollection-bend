import mongoose from "mongoose";

const marketingDraftSchema = new mongoose.Schema({
  brief: { type: String, required: true },
  subject: { type: String, required: true },
  htmlBody: { type: String, required: true },
  plainText: { type: String, required: true },
  imageUrl: { type: String },
  status: { type: String, enum: ["pending", "approved", "rejected", "sent", "failed"], default: "pending" },
  telegramChatId: { type: String },
  telegramMessageId: { type: String },
  mailchimpCampaignId: { type: String },
  failureReason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: true });

export default mongoose.model("MarketingDraft", marketingDraftSchema);
