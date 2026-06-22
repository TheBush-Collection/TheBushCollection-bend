import axios from 'axios';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import Contact from '../models/contact.model.js';

dotenv.config();

// ─── SMTP transporter (shared with booking controller) ──────────────────────
const getSmtpTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpHost) return null;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });
};

// ─── Send contact notification + auto-reply ─────────────────────────────────
async function sendContactEmails(contact) {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    console.warn('Contact emails skipped — SMTP not configured');
    return;
  }

  const from = process.env.SMTP_FROM || 'info@thebushcollection.africa';
  const notifyTo = process.env.CONTACT_NOTIFY_EMAIL || 'info@thebushcollection.africa';

  const subjectLabels = {
    general: 'General Inquiry',
    booking: 'Booking Question',
    custom: 'Custom Safari Request',
    group: 'Group Booking',
    support: 'Customer Support',
  };
  const subjectLabel = subjectLabels[contact.subject] || contact.subject || 'General Inquiry';

  // ── 1. Notification to the business ──────────────────────────────────────
  const notifyHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#292524">
      <div style="background:#1c1917;padding:32px 40px;text-align:center">
        <p style="color:#c9a961;font-size:11px;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px">New Enquiry</p>
        <h1 style="color:#fff;font-size:28px;font-weight:300;margin:0">The Bush Collection</h1>
      </div>
      <div style="padding:40px;background:#fff;border:1px solid #e8e0d4">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;color:#666;width:160px">Name</td><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;font-weight:600">${contact.fullName}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;color:#666">Email</td><td style="padding:10px 0;border-bottom:1px solid #f0ebe4"><a href="mailto:${contact.email}" style="color:#c9a961">${contact.email}</a></td></tr>
          ${contact.phone ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;color:#666">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f0ebe4">${contact.phone}</td></tr>` : ''}
          <tr><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;color:#666">Subject</td><td style="padding:10px 0;border-bottom:1px solid #f0ebe4">${subjectLabel}</td></tr>
          ${contact.preferredTravelDates ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;color:#666">Travel Dates</td><td style="padding:10px 0;border-bottom:1px solid #f0ebe4">${contact.preferredTravelDates}</td></tr>` : ''}
          ${contact.groupSize ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;color:#666">Group Size</td><td style="padding:10px 0;border-bottom:1px solid #f0ebe4">${contact.groupSize}</td></tr>` : ''}
          ${contact.safariInterests ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0ebe4;color:#666">Interests</td><td style="padding:10px 0;border-bottom:1px solid #f0ebe4">${contact.safariInterests}</td></tr>` : ''}
        </table>
        <div style="margin-top:24px">
          <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a961;margin:0 0 8px">Message</p>
          <div style="background:#f5f0ea;padding:20px;border-left:3px solid #c9a961;font-size:14px;line-height:1.7;white-space:pre-wrap">${contact.message}</div>
        </div>
        <div style="margin-top:24px;text-align:center">
          <a href="mailto:${contact.email}?subject=Re: ${subjectLabel}" style="display:inline-block;background:#c9a961;color:#1c1917;padding:12px 28px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600">Reply to ${contact.fullName}</a>
        </div>
      </div>
      <div style="padding:20px 40px;background:#f5f0ea;text-align:center">
        <p style="font-size:11px;color:#999;margin:0">The Bush Collection · 42 Claret Close, Silanga Road, Karen, Nairobi</p>
      </div>
    </div>`;

  // ── 2. Auto-reply to the guest ────────────────────────────────────────────
  const autoReplyHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#292524">
      <div style="background:#1c1917;padding:32px 40px;text-align:center">
        <p style="color:#c9a961;font-size:11px;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px">Thank You</p>
        <h1 style="color:#fff;font-size:28px;font-weight:300;margin:0">The Bush Collection</h1>
      </div>
      <div style="padding:40px;background:#fff;border:1px solid #e8e0d4">
        <p style="font-size:16px;font-weight:300;color:#292524;margin:0 0 16px">Dear ${contact.fullName.split(' ')[0]},</p>
        <p style="font-size:14px;line-height:1.7;color:#555">Thank you for getting in touch with us. We have received your enquiry and a member of our team will respond within <strong>24 hours</strong>.</p>
        <p style="font-size:14px;line-height:1.7;color:#555">In the meantime, you're welcome to explore our safari packages and properties on our website.</p>
        <div style="background:#f5f0ea;padding:20px;border-left:3px solid #c9a961;margin:28px 0">
          <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a961;margin:0 0 8px">Your Message</p>
          <p style="font-size:13px;line-height:1.7;color:#555;margin:0;white-space:pre-wrap">${contact.message}</p>
        </div>
        <div style="text-align:center;margin-top:28px">
          <a href="https://thebushcollection.africa/packages" style="display:inline-block;background:#c9a961;color:#1c1917;padding:12px 28px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600">Explore Packages</a>
        </div>
      </div>
      <div style="padding:20px 40px;background:#f5f0ea;text-align:center">
        <p style="font-size:11px;color:#999;margin:0 0 4px">The Bush Collection · 42 Claret Close, Silanga Road, Karen, Nairobi</p>
        <p style="font-size:11px;color:#999;margin:0">+254 116 072 343 · info@thebushcollection.africa</p>
      </div>
    </div>`;

  const sends = [];

  // Notification email to business
  sends.push(
    transporter.sendMail({
      from: `"The Bush Collection" <${from}>`,
      to: notifyTo,
      replyTo: contact.email,
      subject: `[New Enquiry] ${subjectLabel} — ${contact.fullName}`,
      html: notifyHtml,
    }).catch(err => console.error('Contact notify email error:', err))
  );

  // Auto-reply to guest
  sends.push(
    transporter.sendMail({
      from: `"The Bush Collection" <${from}>`,
      to: contact.email,
      subject: `We've received your enquiry — The Bush Collection`,
      html: autoReplyHtml,
    }).catch(err => console.error('Contact auto-reply email error:', err))
  );

  await Promise.all(sends);
}

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
    const DOUBLE_OPT_IN = (process.env.MAILCHIMP_DOUBLE_OPT_IN || 'false').toLowerCase() === 'true';
    const reqStatus = DOUBLE_OPT_IN ? 'pending' : 'subscribed';
    const data = {
      email_address: contact.email,
      status: reqStatus,
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
        return { success: true, data: resp.data, mailchimp_status: resp.data.status || reqStatus };
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

    // Send notification to business + auto-reply to guest (non-blocking)
    sendContactEmails(contactDoc).catch(err => console.error('sendContactEmails error:', err));

    return res.status(201).json({ success: true, contact: contactDoc, mailchimp: mailchimpResult });
  } catch (err) {
    console.error('Contact send error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export default { sendContact, subscribeToMailchimp };