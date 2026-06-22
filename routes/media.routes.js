import express from "express";
import {
  createMedia,
  getMediaItems,
  getMediaById,
  updateMedia,
  deleteMedia,
  uploadFile,
} from "../controllers/media.controller.js";
import { protectAdmin } from "../middleware/auth.js";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = express.Router();

// multer setup for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(process.cwd(), "public", "uploads", "media");
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|mov|avi|mkv/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

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
router.get("/media-center", getMediaItems);

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
router.post("/admin/media", protectAdmin, createMedia);

/**
 * @swagger
 * /media/admin/upload:
 *   post:
 *     summary: Upload a media file (image/video) (Admin only)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       400:
 *         description: No file uploaded or invalid file
 */
router.post("/admin/upload", protectAdmin, upload.single("file"), uploadFile);

// Admin update media
router.put("/admin/media/:id", protectAdmin, updateMedia);

// Admin delete media
router.delete("/admin/media/:id", protectAdmin, deleteMedia);

// Get single media by id
router.get("/:id", getMediaById);

export default router;
