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
  try {
    const items = await Media.find().sort({ createdAt: -1 });
    // Transform data to match frontend expectations
    const transformedItems = items.map(item => ({
      id: item._id,
      _id: item._id,
      title: item.title,
      type: item.type,
      category: item.category,
      url: item.thumbnailUrl, // Frontend expects 'url'
      thumbnail: item.thumbnailUrl,
      thumbnailUrl: item.thumbnailUrl,
      description: item.description || '',
      featured: item.featured || false,
      date: item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      created_at: item.createdAt
    }));
    res.json(transformedItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
  try {
    const { title, type, category, url, thumbnail, thumbnailUrl, description, featured } = req.body;
    // Support both 'thumbnail' and 'thumbnailUrl' field names
    const finalThumbnail = thumbnailUrl || thumbnail;
    const m = await Media.create({ 
      title, 
      type, 
      category, 
      thumbnailUrl: finalThumbnail, 
      description, 
      featured 
    });
    res.status(201).json(m);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /media/admin/media/{id}:
 *   put:
 *     summary: Update a media item (Admin only)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Media'
 *     responses:
 *       200:
 *         description: Media item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Media item not found
 */
router.put("/admin/media/:id", protectAdmin, async (req, res) => {
  try {
    const { title, type, category, url, thumbnail, thumbnailUrl, description, featured } = req.body;
    // Support both 'thumbnail' and 'thumbnailUrl' field names
    const finalThumbnail = thumbnailUrl || thumbnail;
    const media = await Media.findByIdAndUpdate(
      req.params.id,
      { title, type, category, thumbnailUrl: finalThumbnail, description, featured },
      { new: true, runValidators: true }
    );
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }
    res.json(media);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /media/admin/media/{id}:
 *   delete:
 *     summary: Delete a media item (Admin only)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media item ID
 *     responses:
 *       200:
 *         description: Media item deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Media item not found
 */
router.delete("/admin/media/:id", protectAdmin, async (req, res) => {
  try {
    const media = await Media.findByIdAndDelete(req.params.id);
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }
    res.json({ message: 'Media deleted successfully', media });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
