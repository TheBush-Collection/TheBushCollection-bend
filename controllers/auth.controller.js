import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Admin from "../models/admin.model.js";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

dotenv.config();

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
    res.status(201).json({ token, user: { id: user._id, fullName: user.fullName, email: user.email } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

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
        user: { id: user._id, fullName: user.fullName, email: user.email } 
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
    try {
      html = fs.readFileSync(templatePath, 'utf8');
    } catch (err) {
      console.error('[forgotPassword] failed to read template', err);
      html = `<p>Reset your password: <a href="${process.env.FRONTEND_URL}/reset-password?token=${token}">Reset password</a></p>`;
    }

    html = html.replace(/{{FRONTEND_URL}}/g, process.env.FRONTEND_URL || '')
               .replace(/{{TOKEN}}/g, token);

    // Send via SMTP (nodemailer)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';

    // Verify SMTP connection before sending and log detailed outcome
    try {
      await transporter.verify();
      console.log('[forgotPassword] SMTP transporter verified');
    } catch (verifyErr) {
      console.error('[forgotPassword] SMTP verify failed:', verifyErr && verifyErr.message ? verifyErr.message : verifyErr);
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: user.email,
        subject: 'Password reset request',
        html,
      });
      console.log('[forgotPassword] sendMail info:', info);
    } catch (sendErr) {
      console.error('[forgotPassword] sendMail error:', sendErr && sendErr.message ? sendErr.message : sendErr);
      if (sendErr.response) console.error('[forgotPassword] sendMail response:', sendErr.response);
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
