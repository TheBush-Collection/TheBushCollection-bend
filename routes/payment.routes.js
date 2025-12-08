import { Router } from 'express';
import { submitOrder, handleCallback, checkPaymentStatus } from '../controllers/pesapal.controller.js';
import { debugAuth } from '../controllers/pesapal.controller.js';
import { protectUser } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /payments/initiate:
 *   post:
 *     summary: Initiate a PesaPal payment order
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, email, firstName, lastName, bookingReference]
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               description:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               bookingReference:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Payment initiated, returns redirect URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 redirectUrl:
 *                   type: string
 *                 orderTrackingId:
 *                   type: string
 */
// Initialize payment with PesaPal (no auth required - guest checkout)
router.post('/initiate', submitOrder);

/**
 * @openapi
 * /payments/callback:
 *   get:
 *     summary: PesaPal payment callback / notification
 *     tags:
 *       - Payments
 *     parameters:
 *       - in: query
 *         name: OrderTrackingId
 *         schema:
 *           type: string
 *       - in: query
 *         name: OrderMerchantReference
 *         schema:
 *           type: string
 *       - in: query
 *         name: OrderNotificationType
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment callback processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 */
// PesaPal callback route
router.get('/callback', handleCallback);

// Debug auth endpoint (local use only)
router.get('/debug-auth', debugAuth);

/**
 * @openapi
 * /payments/status:
 *   get:
 *     summary: Check PesaPal payment status
 *     tags:
 *       - Payments
 *     parameters:
 *       - in: query
 *         name: orderTrackingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 */
// Check payment status
router.get('/status', checkPaymentStatus);

export default router;