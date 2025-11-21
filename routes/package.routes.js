// routes/package.routes.js
import express from "express";
import {
  createPackage,
  getPackages,
  getPackageById,
  updatePackage,
  deletePackage,
} from "../controllers/package.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @openapi
 * /packages:
 *   get:
 *     summary: Get all packages with filtering, searching, and sorting
 *     tags: [Packages]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search packages by name, location, highlights, or destinations
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [all, Wildlife, Photography, Luxury, Family, Adventure]
 *         description: Filter by package category
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: duration
 *         schema:
 *           type: string
 *         description: Filter by duration (e.g., "3" for 3 days)
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [featured, price-low, price-high, rating, duration]
 *           default: featured
 *         description: Sort results by specified field
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       '200':
 *         description: List of packages retrieved successfully with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 packages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Package'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
router.get("/", getPackages);

/**
 * @openapi
 * /packages/{id}:
 *   get:
 *     summary: Get package details by ID
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     responses:
 *       '200':
 *         description: Package details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 package:
 *                   $ref: '#/components/schemas/Package'
 *       '404':
 *         description: Package not found
 */
router.get("/:id", getPackageById);

/**
 * @swagger
 * /packages:
 *   post:
 *     summary: Create a new package (Admin only)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Package'
 *     responses:
 *       201:
 *         description: Package created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Package'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid input
 */
router.post("/", protectAdmin, createPackage);

/**
 * @swagger
 * /packages/{id}:
 *   put:
 *     summary: Update a package (Admin only)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Package'
 *     responses:
 *       200:
 *         description: Package updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Package'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Package not found
 */
router.put("/:id", protectAdmin, updatePackage);

/**
 * @swagger
 * /packages/{id}:
 *   delete:
 *     summary: Delete a package (Admin only)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     responses:
 *       200:
 *         description: Package deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Package not found
 */
router.delete("/:id", protectAdmin, deletePackage);

export default router;
