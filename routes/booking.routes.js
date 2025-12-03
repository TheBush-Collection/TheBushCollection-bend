import express from "express";
import {
  createBooking, listBookings, getBooking, getBookingByRef, generateReceipt,
  setDepositPaid, setConfirmed, setFullyPaid, setCompleted, reopenBooking, cancelBooking, notifyBooking,
  listUserBookings, sendReceiptEmail
} from "../controllers/booking.controller.js";
import { protectAdmin, protectUser } from "../middleware/auth.js";

const router = express.Router();

/**
 * @openapi
 * /bookings/create:
 *   post:
 *     summary: Create a new booking (from frontend checkout)
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookingCreateRequest'
 *     responses:
 *       '201':
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *                 message:
 *                   type: string
 *       '400':
 *         description: Invalid input or missing required fields
 */
router.post("/create", createBooking);

/**
 * @openapi
 * /bookings/book:
 *   post:
 *     summary: Create a new booking (legacy endpoint)
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookingCreateRequest'
 *     responses:
 *       '201':
 *         description: Booking created successfully
 */
router.post("/book", createBooking);

/**
 * @swagger
 * /bookings/booking-confirmation/{id}:
 *   get:
 *     summary: Get booking details by ID
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       404:
 *         description: Booking not found
 */
router.get("/booking-confirmation/:id", getBooking);

/**
 * @swagger
 * /bookings/ref/{bookingId}:
 *   get:
 *     summary: Get booking by booking reference ID (User or Admin)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking reference ID (e.g., BK12345678ABC)
 *     responses:
 *       200:
 *         description: Booking details retrieved successfully
 *       403:
 *         description: Unauthorized - can only view own bookings
 *       404:
 *         description: Booking not found
 */
router.get("/ref/:bookingId", protectUser, getBookingByRef);

/**
 * @swagger
 * /bookings/receipt/{bookingId}:
 *   get:
 *     summary: Download booking receipt (User or Admin)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking reference ID
 *     responses:
 *       200:
 *         description: Receipt generated successfully
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.get("/receipt/:bookingId", protectUser, generateReceipt);

/**
 * @swagger
 * /bookings/admin/bookings:
 *   get:
 *     summary: List all bookings (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by booking status
 *     responses:
 *       200:
 *         description: List of bookings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 */
router.get("/admin/bookings", protectAdmin, listBookings);

// User: list bookings for authenticated user
router.get('/my', protectUser, listUserBookings);

/**
 * @swagger
 * /bookings/admin/bookings/{id}:
 *   get:
 *     summary: Get booking details (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.get("/admin/bookings/:id", protectAdmin, getBooking);

/**
 * @swagger
 * /bookings/admin/bookings/{id}/deposit:
 *   post:
 *     summary: Mark booking deposit as paid (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Deposit marked as paid successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.post("/admin/bookings/:id/deposit", protectAdmin, setDepositPaid);

/**
 * @swagger
 * /bookings/admin/bookings/{id}/confirm:
 *   post:
 *     summary: Confirm a booking (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.post("/admin/bookings/:id/confirm", protectAdmin, setConfirmed);

/**
 * @swagger
 * /bookings/admin/bookings/{id}/paid:
 *   post:
 *     summary: Mark booking as fully paid (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking marked as fully paid successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.post("/admin/bookings/:id/paid", protectAdmin, setFullyPaid);

// Admin: mark booking as completed (check-in)
router.post("/admin/bookings/:id/complete", protectAdmin, setCompleted);

/**
 * @swagger
 * /bookings/admin/bookings/{id}/reopen:
 *   post:
 *     summary: Reopen a booking (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking reopened successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.post("/admin/bookings/:id/reopen", protectAdmin, reopenBooking);

/**
 * @swagger
 * /bookings/admin/bookings/{id}/cancel:
 *   post:
 *     summary: Cancel a booking (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.post("/admin/bookings/:id/cancel", protectAdmin, cancelBooking);

// Admin: manually trigger/send a notification for a booking (e.g., resend confirmation)
router.post('/admin/bookings/:id/notify', protectAdmin, notifyBooking);

/**
 * @openapi
 * /bookings/:id/cancel:
 *   post:
 *     summary: Cancel a booking (User - can cancel own bookings)
 *     tags: [Bookings]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Booking cancelled successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Cannot cancel booking
 *       '404':
 *         description: Booking not found
 */
router.post("/:id/cancel", protectUser, cancelBooking);

// User: request a notification resend for a booking they own
router.post('/:id/notify', protectUser, notifyBooking);

// Send receipt email (public; validates provided email matches booking.customerEmail)
router.post('/:id/email', sendReceiptEmail);

export default router;
