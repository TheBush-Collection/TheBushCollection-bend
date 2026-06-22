/**
 * Mailchimp API routes
 * Handles email subscriptions and contact management
 */

import express from 'express';
import {
  subscribeContact,
  getContact,
  unsubscribeContact,
  getRecentSubscriptions,
  mandrillQuery,
} from '../controllers/mailchimp.controller.js';

const router = express.Router();

/**
 * POST /api/mailchimp/subscribe
 * Subscribe or update a contact in Mailchimp audience
 */
router.post('/subscribe', subscribeContact);

/**
 * GET /api/mailchimp/contact
 * Get contact information from Mailchimp
 * Query: email=user@example.com
 */
router.get('/contact', getContact);

/**
 * POST /api/mailchimp/unsubscribe
 * Unsubscribe/delete a contact from Mailchimp
 */
router.post('/unsubscribe', unsubscribeContact);

/**
 * GET /api/mailchimp/mandrill
 * Query: ?id=<mandrill_message_id> OR ?recipient=<email>
 */
router.get('/mandrill', mandrillQuery);

/**
 * GET /api/mailchimp/recent
 * Return recent subscribe attempts for quick admin verification
 */
router.get('/recent', getRecentSubscriptions);

export default router;
