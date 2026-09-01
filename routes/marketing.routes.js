// routes/marketing.routes.js
import express from "express";
import { generateCampaignDraft, listDrafts } from "../controllers/marketingAgent.controller.js";
import { protectAdmin } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/generate-campaign", protectAdmin, chatLimiter, generateCampaignDraft);
router.get("/drafts", protectAdmin, listDrafts);

export default router;
