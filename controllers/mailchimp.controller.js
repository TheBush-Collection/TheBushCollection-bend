/**
 * Mailchimp integration controller
 * Handles all Mailchimp-related operations on the backend
 */

// Mailchimp credentials (store these in .env file in production)
const MAILCHIMP_API_KEY = '4e78d7b5098e00d5b4ee1438e13a9959-us14';
const MAILCHIMP_SERVER_PREFIX = 'us14';
// Get your Audience ID from Mailchimp dashboard -> Audience -> Settings -> Audience name and defaults
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || '';

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

    const requestBody = {
      email_address: email_address.toLowerCase().trim(),
      status: status || 'subscribed',
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

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[Mailchimp] Error:', responseData);
      return res.status(response.status).json({
        success: false,
        message: responseData.detail || 'Failed to subscribe contact',
        error: responseData,
      });
    }

    console.log('[Mailchimp] Success:', responseData);
    res.status(200).json({
      success: true,
      message: 'Contact subscribed successfully',
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
    const crypto = require('crypto');
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
