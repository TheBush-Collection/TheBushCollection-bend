// routes/nairobiHotel.routes.js
import express from "express";
import {
  createHotel,
  getHotels,
  getHotelById,
  updateHotel,
  deleteHotel,
} from "../controllers/nairobiHotel.controller.js";
import { protectUser } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /nairobi-hotels:
 *   post:
 *     summary: Create a new Nairobi hotel
 *     tags: [Nairobi Hotels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NairobiHotel'
 *     responses:
 *       201:
 *         description: Hotel created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NairobiHotel'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid input
 */
router.post("/", protectUser, createHotel);

/**
 * @swagger
 * /nairobi-hotels:
 *   get:
 *     summary: Get all Nairobi hotels
 *     tags: [Nairobi Hotels]
 *     parameters:
 *       - in: query
 *         name: priceRange
 *         schema:
 *           type: string
 *         description: Filter by price range (format min-max)
 *       - in: query
 *         name: amenities
 *         schema:
 *           type: string
 *         description: Filter by amenities (comma-separated)
 *     responses:
 *       200:
 *         description: List of hotels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NairobiHotel'
 */
router.get("/", getHotels);

/**
 * @swagger
 * /nairobi-hotels/{id}:
 *   get:
 *     summary: Get a Nairobi hotel by ID
 *     tags: [Nairobi Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: Hotel details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NairobiHotel'
 *       404:
 *         description: Hotel not found
 */
router.get("/:id", getHotelById);

/**
 * @swagger
 * /nairobi-hotels/{id}:
 *   put:
 *     summary: Update a Nairobi hotel
 *     tags: [Nairobi Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NairobiHotel'
 *     responses:
 *       200:
 *         description: Hotel updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NairobiHotel'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Hotel not found
 */
router.put("/:id", protectUser, updateHotel);

/**
 * @swagger
 * /nairobi-hotels/{id}:
 *   delete:
 *     summary: Delete a Nairobi hotel
 *     tags: [Nairobi Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: Hotel deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Hotel not found
 */
router.delete("/:id", protectUser, deleteHotel);

export default router;
