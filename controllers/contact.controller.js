import axios from 'axios';
import dotenv from 'dotenv';
import Contact from '../models/contact.model.js';

dotenv.config();

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX; // e.g. us19
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID;

if (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX || !MAILCHIMP_LIST_ID) {
  console.warn('Mailchimp environment variables are not fully configured. Mailchimp subscription will be skipped.');
}

const mailchimpBase = MAILCHIMP_SERVER_PREFIX ? `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0` : null;

async function subscribeToMailchimp(contact) {
  if (!mailchimpBase) return { success: false, reason: 'no_server_prefix' };
  try {
    const url = `${mailchimpBase}/lists/${MAILCHIMP_LIST_ID}/members`;
    const data = {
      email_address: contact.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: contact.fullName ? contact.fullName.split(' ')[0] : '',
        LNAME: contact.fullName ? contact.fullName.split(' ').slice(1).join(' ') : '',
        PHONE: contact.phone || ''
      }
    };

    const response = await axios.post(url, data, {
      auth: { username: 'anystring', password: MAILCHIMP_API_KEY },
      headers: { 'Content-Type': 'application/json' }
    });

    return { success: true, data: response.data };
  } catch (err) {
    // If member exists, Mailchimp returns 400 with title "Member Exists"; handle idempotency by attempting to update
    if (err.response && err.response.data && err.response.data.title === 'Member Exists') {
      try {
        const emailHash = require('crypto').createHash('md5').update(contact.email.toLowerCase()).digest('hex');
        const url = `${mailchimpBase}/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}`;
        const updateData = {
          email_address: contact.email,
          status_if_new: 'subscribed',
          merge_fields: {
            FNAME: contact.fullName ? contact.fullName.split(' ')[0] : '',
            LNAME: contact.fullName ? contact.fullName.split(' ').slice(1).join(' ') : '',
            PHONE: contact.phone || ''
          }
        };
        const resp = await axios.patch(url, updateData, {
          auth: { username: 'anystring', password: MAILCHIMP_API_KEY },
          headers: { 'Content-Type': 'application/json' }
        });
        return { success: true, data: resp.data };
      } catch (upErr) {
        return { success: false, error: upErr.message };
      }
    }

    return { success: false, error: err.response?.data || err.message };
  }
}

export const sendContact = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      subject,
      preferredTravelDates,
      groupSize,
      safariInterests,
      message,
      subscribe // optional boolean from front-end
    } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const contactDoc = await Contact.create({
      fullName,
      email,
      phone,
      subject,
      preferredTravelDates,
      groupSize,
      safariInterests,
      message,
      subscribedToMailchimp: false
    });

    let mailchimpResult = null;
    if (subscribe && MAILCHIMP_API_KEY && MAILCHIMP_SERVER_PREFIX && MAILCHIMP_LIST_ID) {
      mailchimpResult = await subscribeToMailchimp(contactDoc);
      if (mailchimpResult.success) {
        contactDoc.subscribedToMailchimp = true;
        await contactDoc.save();
      }
    }

    return res.status(201).json({ success: true, contact: contactDoc, mailchimp: mailchimpResult });
  } catch (err) {
    console.error('Contact send error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export default { sendContact, subscribeToMailchimp };