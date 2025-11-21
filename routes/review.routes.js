import express from "express";
import {
  createReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
  getPropertyReviews,
  getPackageReviews,
  getReviewStats,
  markHelpful
} from "../controllers/review.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewInput'
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post("/", createReview);

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Get all reviews with filters
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: property_id
 *         schema:
 *           type: string
 *         description: Filter by property ID
 *       - in: query
 *         name: package_id
 *         schema:
 *           type: string
 *         description: Filter by package ID
 *       - in: query
 *         name: is_approved
 *         schema:
 *           type: boolean
 *         description: Filter by approval status
 *       - in: query
 *         name: is_featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *         description: Filter by rating
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *                 pages:
 *                   type: number
 *       500:
 *         description: Server error
 */
router.get("/", getReviews);

/**
 * @swagger
 * /reviews/stats:
 *   get:
 *     summary: Get review statistics (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReviews:
 *                   type: number
 *                 approvedReviews:
 *                   type: number
 *                 pendingReviews:
 *                   type: number
 *                 featuredReviews:
 *                   type: number
 *                 averageRating:
 *                   type: number
 *                 distribution:
 *                   type: array
 *       500:
 *         description: Server error
 */
router.get("/stats", protectAdmin, getReviewStats);

/**
 * @swagger
 * /reviews/property/{id}:
 *   get:
 *     summary: Get reviews for a specific property
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *     responses:
 *       200:
 *         description: Property reviews retrieved successfully
 *       404:
 *         description: Property not found
 *       500:
 *         description: Server error
 */
router.get("/property/:id", getPropertyReviews);

/**
 * @swagger
 * /reviews/package/{id}:
 *   get:
 *     summary: Get reviews for a specific package
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *     responses:
 *       200:
 *         description: Package reviews retrieved successfully
 *       404:
 *         description: Package not found
 *       500:
 *         description: Server error
 */
router.get("/package/:id", getPackageReviews);

/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     summary: Get a specific review by ID
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 */
router.get("/:id", getReview);

/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     summary: Update a review (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *               is_approved:
 *                 type: boolean
 *               is_featured:
 *                 type: boolean
 *               admin_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 */
router.put("/:id", protectAdmin, updateReview);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete a review (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", protectAdmin, deleteReview);

/**
 * @swagger
 * /reviews/{id}/helpful:
 *   post:
 *     summary: Mark review as helpful or unhelpful
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               helpful:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Review helpful count updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 */
router.post("/:id/helpful", markHelpful);

export default router;
