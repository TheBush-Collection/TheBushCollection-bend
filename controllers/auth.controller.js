import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Admin from "../models/admin.model.js";

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
