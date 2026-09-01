// routes/telegram.routes.js
import express from "express";
import { handleWebhook, registerWebhook } from "../controllers/telegram.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = express.Router();

// Telegram calls this — protected by the secret_token check inside handleWebhook,
// not by our own auth (Telegram can't send a Bearer token).
router.post("/webhook", handleWebhook);

// One-time/occasional admin action: point Telegram at this backend's webhook URL.
// Body: { "publicUrl": "https://thebushcollection.onrender.com" }
router.post("/register-webhook", protectAdmin, async (req, res) => {
  try {
    const { publicUrl } = req.body || {};
    if (!publicUrl) return res.status(400).json({ message: "publicUrl is required" });
    const result = await registerWebhook(publicUrl);
    res.json({ success: true, result });
  } catch (err) {
    console.error("registerWebhook error:", err);
    res.status(500).json({ message: err.message || "Failed to register webhook" });
  }
});

export default router;
