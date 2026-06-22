import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Admin from "../models/admin.model.js";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

dotenv.config();

// In-memory email send log for diagnostics (ephemeral)
const EMAIL_SEND_LOG_LIMIT = Number(process.env.EMAIL_SEND_LOG_LIMIT || 100);
const recentEmailSends = [];
const pushEmailSendLog = (entry) => {
  try {
    recentEmailSends.unshift({ timestamp: new Date().toISOString(), ...entry });
    if (recentEmailSends.length > EMAIL_SEND_LOG_LIMIT) recentEmailSends.length = EMAIL_SEND_LOG_LIMIT;
  } catch (e) {
    console.warn('[auth] pushEmailSendLog failed', e);
  }
};

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
};

// Customer signup
export const signup = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ msg: "Missing fields" });
    const normalizedEmail = String(email).toLowerCase().trim();
    console.log('[signup] normalized email:', normalizedEmail);
    let user = await User.findOne({ email: { $regex: `^${normalizedEmail}$`, $options: 'i' } });
    if (user) {
      console.log('[signup] user already exists:', normalizedEmail);
      return res.status(400).json({ msg: "User exists" });
    }
    user = await User.create({ fullName, email: normalizedEmail, phone, password });
    console.log('[signup] user created:', user._id, 'email:', user.email);
    const token = signToken(user._id);

    // Send welcome email (non-blocking — don't delay the signup response)
    sendWelcomeEmail(user.fullName, user.email).catch(err =>
      console.error('[signup] welcome email failed:', err?.message || err)
    );

    res.status(201).json({ token, user: { id: user._id, fullName: user.fullName, email: user.email } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Helper: send welcome email via Mandrill (or SMTP fallback)
async function sendWelcomeEmail(fullName, email) {
  const MANDRILL_API_KEY = process.env.MANDRILL_API_KEY || '';
  const fromEmail = process.env.SMTP_FROM || 'info@thebushcollection.africa';
  const frontendUrl = (process.env.FRONTEND_URL || 'https://thebushcollection.africa').replace(/\/+$/, '');

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Welcome to The Bush Collection</title></head>
  <body style="font-family: Georgia, serif; color: #292524; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 60px; height: 1px; background: #c9a961; margin: 0 auto 16px;"></div>
      <h1 style="font-weight: 300; font-size: 28px; margin: 0; color: #292524;">Welcome, ${fullName}</h1>
    </div>
    <p style="font-weight: 300; line-height: 1.8; color: #292524cc;">
      Thank you for creating an account with <strong>The Bush Collection</strong>. You now have access to book handpicked lodges, camps, and retreats across the most spectacular safari landscapes of East Africa.
    </p>
    <p style="font-weight: 300; line-height: 1.8; color: #292524cc;">
      Start exploring our curated collection and plan your next unforgettable journey.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${frontendUrl}/collections" style="display: inline-block; background: #c9a961; color: #292524; text-decoration: none; padding: 14px 32px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 500;">
        Explore Collection
      </a>
    </div>
    <div style="border-top: 1px solid #e8e0d4; margin-top: 40px; padding-top: 20px; text-align: center;">
      <p style="font-size: 11px; color: #29252466; letter-spacing: 0.1em;">THE BUSH COLLECTION &middot; Est. 1983</p>
      <p style="font-size: 11px; color: #29252440;">Curated Safari Experiences Across East Africa</p>
    </div>
  </body>
</html>`;

  // Try Mandrill first
  if (MANDRILL_API_KEY) {
    try {
      const resp = await fetch('https://mandrillapp.com/api/1.0/messages/send.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: MANDRILL_API_KEY,
          message: {
            html,
            subject: 'Welcome to The Bush Collection',
            from_email: fromEmail,
            from_name: 'The Bush Collection',
            to: [{ email, type: 'to' }],
          },
        }),
      });
      const data = await resp.json().catch(() => null);
      console.log('[signup] welcome email mandrill response:', data);
      if (data && Array.isArray(data) && data[0]?.status === 'sent') return;
      console.warn('[signup] mandrill did not confirm sent:', data);
    } catch (err) {
      console.error('[signup] mandrill welcome email error:', err?.message || err);
    }
  }

  // SMTP fallback
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const info = await transporter.sendMail({
        from: fromEmail,
        to: email,
        subject: 'Welcome to The Bush Collection',
        html,
      });
      console.log('[signup] welcome email SMTP info:', info);
    } catch (err) {
      console.error('[signup] SMTP welcome email error:', err?.message || err);
    }
  }
}

// Customer login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase().trim();
    console.log('[login] attempting with email:', normalizedEmail);
    const user = await User.findOne({ email: { $regex: `^${normalizedEmail}$`, $options: 'i' } });
    if (!user) {
      console.log('[login] user not found for email:', normalizedEmail);
      return res.status(401).json({ msg: "Invalid credentials" });
    }
    console.log('[login] user found:', user._id, 'stored email:', user.email);
    const isMatch = await user.matchPassword(password);
    console.log('[login] password match result:', isMatch);
    if (!isMatch) {
      console.log('[login] password mismatch for user:', user._id);
      return res.status(401).json({ msg: "Invalid credentials" });
    }
    const token = signToken(user._id);
    console.log('[login] token generated for user:', user._id);
    res.json({ token, user: { id: user._id, fullName: user.fullName, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Admin login
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase().trim();
    console.log('[adminLogin] attempting with email:', normalizedEmail);
    const admin = await Admin.findOne({ email: { $regex: `^${normalizedEmail}$`, $options: 'i' } });
    if (!admin) {
      console.log('[adminLogin] admin not found for email:', normalizedEmail);
      return res.status(401).json({ msg: "Invalid admin credentials" });
    }
    console.log('[adminLogin] admin found:', admin._id, 'stored email:', admin.email);
    const isMatch = await admin.matchPassword(password);
    console.log('[adminLogin] password match result:', isMatch);
    if (!isMatch) {
      console.log('[adminLogin] password mismatch for admin:', admin._id);
      return res.status(401).json({ msg: "Invalid admin credentials" });
    }
    const token = signToken(admin._id);
    console.log('[adminLogin] token generated for admin:', admin._id);
    res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Verify current session (returns user/admin from token)
export const me = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "No token" });
    
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if admin
    let admin = await Admin.findById(payload.id).select("-password");
    if (admin) {
      return res.json({ 
        role: "admin", 
        admin: { id: admin._id, name: admin.name, email: admin.email } 
      });
    }
    
    // Check if user
    let user = await User.findById(payload.id).select("-password");
    if (user) {
      return res.json({ 
        role: "user", 
        user: { id: user._id, fullName: user.fullName, email: user.email, avatar: user.avatar, provider: user.provider } 
      });
    }
    
    return res.status(401).json({ msg: "User not found" });
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
};

// POST /auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Missing email' });

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: { $regex: `^${normalizedEmail}$`, $options: 'i' } });

    // Always respond with success to avoid leaking registered emails
    if (!user) return res.json({ msg: 'If an account exists, a reset link has been sent.' });

    // Generate token and expiry (1 hour)
    const token = crypto.randomBytes(20).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(expires);
    await user.save();

    // Render email template
    const templatePath = path.join(process.cwd(), 'templates', 'reset_password_email.html');
    let html = '';
    // Strip trailing slashes from FRONTEND_URL to avoid double-slash in URLs
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    try {
      html = fs.readFileSync(templatePath, 'utf8');
    } catch (err) {
      console.error('[forgotPassword] failed to read template', err);
      html = `<p>Reset your password: <a href="${frontendUrl}/reset-password?token=${token}">Reset password</a></p>`;
    }

    html = html.replace(/{{FRONTEND_URL}}/g, frontendUrl)
           .replace(/{{TOKEN}}/g, token);

    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const text = `Reset your password: ${resetUrl}`;

    // Send via SMTP (nodemailer)
    const sendViaSMTP = async () => {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser || 'no-reply@example.com';

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn('[forgotPassword] SMTP not fully configured, skipping SMTP send');
        return { ok: false, reason: 'smtp_not_configured' };
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // use TLS for 465
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Verify SMTP connection before sending and log detailed outcome
      try {
        await transporter.verify();
        console.log('[forgotPassword] SMTP transporter verified');
      } catch (verifyErr) {
        console.error('[forgotPassword] SMTP verify failed:', verifyErr && verifyErr.message ? verifyErr.message : verifyErr);
        // continue and attempt send; sometimes verify fails but send succeeds
      }

      try {
        // Log a short preview for diagnostics (not PII except the URL)
        console.log('[forgotPassword] resetUrl:', resetUrl);

        const info = await transporter.sendMail({
          from: smtpFrom,
          to: user.email,
          subject: 'Password reset request',
          text,
          html,
        });
        console.log('[forgotPassword] sendMail info:', info);
        return { ok: true, info };
      } catch (sendErr) {
        console.error('[forgotPassword] sendMail error:', sendErr && sendErr.message ? sendErr.message : sendErr);
        if (sendErr.response) console.error('[forgotPassword] sendMail response:', sendErr.response);
        return { ok: false, reason: 'send_failed', error: sendErr };
      }
    };

    const sendViaMandrill = async () => {
      const MANDRILL_API_KEY = process.env.MANDRILL_API_KEY || process.env.SMTP_PASS || '';
      if (!MANDRILL_API_KEY) return { ok: false, reason: 'mandrill_not_configured' };

      const fromEmail = process.env.SMTP_FROM || 'info@thebushcollection.africa';
      try {
        const mandrillResp = await fetch('https://mandrillapp.com/api/1.0/messages/send.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: MANDRILL_API_KEY,
            message: {
              html,
              subject: 'Password reset request',
              from_email: fromEmail,
              from_name: 'The Bush Collection',
              to: [{ email: user.email, type: 'to' }],
            },
          }),
        });
        const data = await mandrillResp.json().catch(() => null);
        console.log('[forgotPassword] mandrill response:', data);
        return { ok: true, data };
      } catch (err) {
        console.error('[forgotPassword] mandrill send error:', err && err.message ? err.message : err);
        return { ok: false, reason: 'mandrill_failed', error: err };
      }
    };

    // Attempt SMTP first, then Mandrill as a fallback
    const smtpResult = await sendViaSMTP();
    pushEmailSendLog({ email: user.email, method: 'smtp', result: smtpResult });
    if (!smtpResult.ok) {
      console.log('[forgotPassword] SMTP send failed or skipped, attempting Mandrill fallback', smtpResult);
      const mandrillResult = await sendViaMandrill();
      pushEmailSendLog({ email: user.email, method: 'mandrill', result: mandrillResult });
      if (!mandrillResult.ok) {
        console.warn('[forgotPassword] Both SMTP and Mandrill failed/skipped', { smtpResult, mandrillResult });
      }
    }

    return res.json({ msg: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

// POST /auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ msg: 'Missing token or password' });

    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ msg: 'Invalid or expired token' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Optionally sign and return a new auth token
    const authToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ msg: 'Password reset successful', token: authToken });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

// Admin helper: return recent email send attempts
export const getRecentEmailSends = (req, res) => {
  try {
    return res.status(200).json({ success: true, data: recentEmailSends });
  } catch (err) {
    console.error('[auth] getRecentEmailSends failed', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent email sends' });
  }
};

