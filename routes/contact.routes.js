import { Router } from 'express';
import { sendContact } from '../controllers/contact.controller.js';

const router = Router();

/**
 * @openapi
 * /contact/send:
 *   post:
 *     summary: Submit contact form / send a message
 *     tags:
 *       - Contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - message
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               subject:
 *                 type: string
 *                 enum: ["General enquiry","Booking Question","Custom Safari request","Group booking","Customer support"]
 *               preferredTravelDates:
 *                 type: string
 *               groupSize:
 *                 type: string
 *                 enum: ["1 person","2 people","3-4 people","5-8 people","9+ people"]
 *               safariInterests:
 *                 type: string
 *               message:
 *                 type: string
 *               subscribe:
 *                 type: boolean
 *     responses:
 *       '201':
 *         description: Contact saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 contact:
 *                   $ref: '#/components/schemas/Contact'
 *                 mailchimp:
 *                   type: object
 *       '400':
 *         description: Missing required fields
 */
// POST /contact/send - accepts contact form submissions
router.post('/send', sendContact);

export default router;