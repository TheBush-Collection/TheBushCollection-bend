/**
 * Mailchimp integration controller
 * Handles all Mailchimp-related operations on the backend
 */
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Mailchimp credentials (store these in .env file in production)
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;
// Get your Audience ID from Mailchimp dashboard -> Audience -> Settings -> Audience name and defaults
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || '';

// In-memory recent subscriptions buffer for quick admin verification.
// This is intentionally lightweight and ephemeral (cleared on server restart).
const RECENT_SUBS_LIMIT = Number(process.env.MAILCHIMP_RECENT_LIMIT || 50);
const recentSubscriptions = [];

function pushRecentSubscription(entry) {
  try {
    recentSubscriptions.unshift({ timestamp: new Date().toISOString(), ...entry });
    if (recentSubscriptions.length > RECENT_SUBS_LIMIT) recentSubscriptions.length = RECENT_SUBS_LIMIT;
  } catch (e) {
    console.warn('[Mailchimp] Failed to record recent subscription', e);
  }
}

/**
 * Subscribe or update a contact in Mailchimp
 */
export const subscribeContact = async (req, res) => {
  try {
    const { email_address, merge_fields, tags, status } = req.body;

    // Validate required fields
    if (!email_address) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    if (!MAILCHIMP_AUDIENCE_ID) {
      console.error('MAILCHIMP_AUDIENCE_ID not configured');
      return res.status(500).json({
        success: false,
        message: 'Mailchimp configuration error',
      });
    }

    // Encode API key to base64 for Basic Auth
    const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');

    // Respect server-side double opt-in configuration. When enabled, request Mailchimp
    // to set the member `status` to 'pending' so Mailchimp sends a confirmation email.
    const DOUBLE_OPT_IN = (process.env.MAILCHIMP_DOUBLE_OPT_IN || 'false').toLowerCase() === 'true';
    const requestedStatus = DOUBLE_OPT_IN ? 'pending' : (status || 'subscribed');

    const requestBody = {
      email_address: email_address.toLowerCase().trim(),
      status: requestedStatus,
      merge_fields: merge_fields || {},
      tags: tags || [],
    };

    console.log('[Mailchimp] Subscribing:', requestBody.email_address);

    // Make request to Mailchimp API
    const response = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseErr) {
      const text = await response.text().catch(() => '');
      responseData = { detail: text || 'Non-JSON response from Mailchimp' };
    }

    if (!response.ok) {
      console.error('[Mailchimp] Error:', responseData);
      // Record failed attempt for admin inspection
      pushRecentSubscription({
        email: requestBody.email_address,
        requestedStatus,
        ok: false,
        statusCode: response.status,
        response: responseData,
      });
      return res.status(response.status).json({
        success: false,
        message: responseData.detail || 'Failed to subscribe contact',
        error: responseData,
      });
    }

    console.log('[Mailchimp] Success:', responseData);
    // Record successful response for admin inspection
    pushRecentSubscription({
      email: requestBody.email_address,
      requestedStatus,
      ok: true,
      statusCode: response.status,
      response: responseData,
    });

    res.status(200).json({
      success: true,
      message: 'Contact subscribed successfully',
      data: responseData,
      mailchimp_status: responseData.status || requestedStatus,
    });
  } catch (error) {
    console.error('[Mailchimp] Exception:', error);
    // Record exception for admin inspection
    pushRecentSubscription({
      email: req.body?.email_address || null,
      requestedStatus: req.body?.status || null,
      ok: false,
      statusCode: 500,
      response: { message: error.message || String(error) },
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Get contact info from Mailchimp
 */
export const getContact = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    if (!MAILCHIMP_AUDIENCE_ID) {
      return res.status(500).json({
        success: false,
        message: 'Mailchimp configuration error',
      });
    }

    // Encode API key to base64 for Basic Auth
    const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');

    // Generate hash of email for Mailchimp API
    const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');

    console.log('[Mailchimp] Fetching contact:', email);

    const response = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${emailHash}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[Mailchimp] Error:', responseData);
      return res.status(response.status).json({
        success: false,
        message: responseData.detail || 'Failed to fetch contact',
      });
    }

    console.log('[Mailchimp] Contact found:', responseData.email_address);
    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[Mailchimp] Exception:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Delete/unsubscribe a contact from Mailchimp
 */
export const unsubscribeContact = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    if (!MAILCHIMP_AUDIENCE_ID) {
      return res.status(500).json({
        success: false,
        message: 'Mailchimp configuration error',
      });
    }

    const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');

    // Generate hash of email for Mailchimp API
    const crypto = require('crypto');
    const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');

    console.log('[Mailchimp] Unsubscribing:', email);

    const response = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${emailHash}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const responseData = await response.json();
      console.error('[Mailchimp] Error:', responseData);
      return res.status(response.status).json({
        success: false,
        message: responseData.detail || 'Failed to unsubscribe contact',
      });
    }

    console.log('[Mailchimp] Unsubscribed successfully');
    res.status(200).json({
      success: true,
      message: 'Contact unsubscribed successfully',
    });
  } catch (error) {
    console.error('[Mailchimp] Exception:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Query Mandrill (Mailchimp Transactional) for message info or search by recipient
 * GET /api/mailchimp/mandrill
 * Query params: ?id=<mandrill_message_id> OR ?recipient=<email>
 */
export const mandrillQuery = async (req, res) => {
  try {
    const { id, recipient } = req.query;
    // Prefer an explicit MANDRILL_API_KEY env var, fall back to SMTP_PASS or MAILCHIMP_API_KEY
    const MANDRILL_API_KEY = process.env.MANDRILL_API_KEY || process.env.SMTP_PASS || process.env.MAILCHIMP_API_KEY;
    if (!MANDRILL_API_KEY) {
      return res.status(500).json({ success: false, msg: 'Mandrill API key not configured' });
    }

    if (id) {
      // Fetch message info by id
      const response = await fetch('https://mandrillapp.com/api/1.0/messages/info.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: MANDRILL_API_KEY, id })
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ success: false, error: data });
      return res.json({ success: true, data });
    }

    if (recipient) {
      // Search messages by recipient (returns array of messages)
      const response = await fetch('https://mandrillapp.com/api/1.0/messages/search.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: MANDRILL_API_KEY, query: recipient, limit: 50 })
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ success: false, error: data });
      return res.json({ success: true, data });
    }

    return res.status(400).json({ success: false, msg: 'Provide either id or recipient query parameter' });
  } catch (err) {
    console.error('Mandrill query error:', err);
    return res.status(500).json({ success: false, msg: err.message || 'Mandrill query failed' });
  }
};

/**
 * Admin helper: return recent subscription attempts for quick verification
 * GET /api/mailchimp/recent
 */
export const getRecentSubscriptions = (req, res) => {
  try {
    return res.status(200).json({ success: true, data: recentSubscriptions });
  } catch (err) {
    console.error('[Mailchimp] Failed to return recent subscriptions', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent subscriptions' });
  }
};

// Internal helper for server-side use (returns response data or throws)
export const subscribeContactInternal = async ({ email_address, merge_fields = {}, tags = [], status = 'subscribed' }) => {
  if (!email_address) throw new Error('Email address required');
  if (!MAILCHIMP_AUDIENCE_ID) throw new Error('MAILCHIMP_AUDIENCE_ID not configured');

  const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');

  const requestBody = {
    email_address: email_address.toLowerCase().trim(),
    status: status || 'subscribed',
    merge_fields: merge_fields || {},
    // tags will be handled separately for updates if necessary
  };

  // Try creating the member first
  const createResp = await fetch(
    `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestBody, tags: tags || [] }),
    }
  );

  const createData = await createResp.json();
  if (createResp.ok) {
    return createData;
  }

  // If member already exists, update via PUT on the member resource
  // Mailchimp returns 400 with title 'Member Exists' when attempting to POST an existing member
  if (createData && (createData.title === 'Member Exists' || (createData.detail && createData.detail.includes('already a list member')))) {
    const emailHash = crypto.createHash('md5').update(email_address.toLowerCase().trim()).digest('hex');

    // Update member (PUT will create or update). We'll include merge_fields and status.
    const putResp = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${emailHash}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const putData = await putResp.json();
    if (!putResp.ok) {
      const err = new Error(putData.detail || 'Mailchimp update failed');
      err.response = putData;
      throw err;
    }

    // If there are tags to add/update, call the tags endpoint
    if (Array.isArray(tags) && tags.length > 0) {
      const tagsPayload = { tags: tags.map((t) => ({ name: t, status: 'active' })) };
      const tagsResp = await fetch(
        `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${emailHash}/tags`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tagsPayload),
        }
      );

      // Not critical if tagging fails, but surface error for debugging
      if (!tagsResp.ok) {
        const tagsData = await tagsResp.json().catch(() => ({}));
        console.warn('[Mailchimp] Failed to update tags for existing member', tagsData);
      }
    }

    return putData;
  }

  // Otherwise throw the original create error
  const err = new Error(createData.detail || 'Mailchimp subscribe failed');
  err.response = createData;
  throw err;
};
