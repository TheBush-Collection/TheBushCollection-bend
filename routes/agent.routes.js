// routes/agent.routes.js
import express from "express";
import { chatWithAgent } from "../controllers/agent.controller.js";
import { chatLimiter, chatDailyCap } from "../middleware/rateLimit.js";

const router = express.Router();

/**
 * @openapi
 * /agent/chat:
 *   post:
 *     summary: Chat with the guest-facing AI concierge
 *     tags: [Agent]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Assistant reply
 */
router.post("/chat", chatLimiter, chatDailyCap, chatWithAgent);

export default router;
