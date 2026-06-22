// routes/amenity.routes.js
import express from "express";
import {
  createAmenity,
  getAmenities,
  getAmenityById,
  updateAmenity,
  deleteAmenity,
} from "../controllers/amenity.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /amenities:
 *   get:
 *     summary: Get all amenities
 *     tags: [Amenities]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter amenities by category
 *     responses:
 *       200:
 *         description: List of amenities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Amenity'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     current:
 *                       type: integer
 */
router.get("/", getAmenities);

/**
 * @swagger
 * /amenities/{id}:
 *   get:
 *     summary: Get an amenity by ID
 *     tags: [Amenities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Amenity ID
 *     responses:
 *       200:
 *         description: Amenity details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Amenity'
 *       404:
 *         description: Amenity not found
 */
router.get("/:id", getAmenityById);

/**
 * @swagger
 * /amenities/admin/amenities:
 *   post:
 *     summary: Create a new amenity (Admin only)
 *     tags: [Amenities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Amenity'
 *     responses:
 *       201:
 *         description: Amenity created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Amenity'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid input
 */
router.post("/admin/amenities", protectAdmin, createAmenity);

/**
 * @swagger
 * /amenities/admin/amenities/{id}:
 *   put:
 *     summary: Update an amenity (Admin only)
 *     tags: [Amenities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Amenity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Amenity'
 *     responses:
 *       200:
 *         description: Amenity updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Amenity'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Amenity not found
 */
router.put("/admin/amenities/:id", protectAdmin, updateAmenity);

/**
 * @swagger
 * /amenities/admin/amenities/{id}:
 *   delete:
 *     summary: Delete an amenity (Admin only)
 *     tags: [Amenities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Amenity ID
 *     responses:
 *       200:
 *         description: Amenity deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Amenity not found
 */
router.delete("/admin/amenities/:id", protectAdmin, deleteAmenity);

export default router;
