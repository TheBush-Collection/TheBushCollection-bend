import express from "express";
import Media from "../models/media.model.js";
import { protectAdmin } from "../middleware/auth.js";
const router = express.Router();

/**
 * @swagger
 * /media/media-center:
 *   get:
 *     summary: Get all media items
 *     tags: [Media]
 *     responses:
 *       200:
 *         description: List of media items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Media'
 * */
router.get("/media-center", async (req, res) => {
  const items = await Media.find().sort({ createdAt: -1 });
  res.json(items);
});

/**
 * @swagger
 * /media/admin/media:
 *   post:
 *     summary: Create a new media item (Admin only)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Media'
 *     responses:
 *       201:
 *         description: Media item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid input
 */
router.post("/admin/media", protectAdmin, async (req, res) => {
  const { title, type, category, thumbnailUrl, description, featured } = req.body;
  const m = await Media.create({ title, type, category, thumbnailUrl, description, featured });
  res.status(201).json(m);
});

export default router;
