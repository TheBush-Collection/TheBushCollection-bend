import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Admin from "../models/admin.model.js";

dotenv.config();

export const protectUser = async (req, res, next) => {
  const header = req.headers.authorization || req.headers.Authorization;
  const token = header && String(header).startsWith('Bearer ') ? String(header).split(' ')[1] : null;
  if (!token) return res.status(401).json({ msg: "No token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(401).json({ msg: "User not found" });
    req.user = user;
    next();
  } catch (err) {
    console.error('protectUser error:', err);
    return res.status(401).json({ msg: "Invalid token" });
  }
};

export const protectAdmin = async (req, res, next) => {
  const header = req.headers.authorization || req.headers.Authorization;
  const token = header && String(header).startsWith('Bearer ') ? String(header).split(' ')[1] : null;
  if (!token) return res.status(401).json({ msg: "No token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.id).select("-password");
    if (!admin) return res.status(401).json({ msg: "Admin not found" });
    req.admin = admin;
    next();
  } catch (err) {
    console.error('protectAdmin error:', err);
    return res.status(401).json({ msg: "Invalid token" });
  }
};

// Middleware that allows both admin and user (for admin operations)
export const protectAdminOrUser = async (req, res, next) => {
  const header = req.headers.authorization || req.headers.Authorization;
  const token = header && String(header).startsWith('Bearer ') ? String(header).split(' ')[1] : null;
  if (!token) return res.status(401).json({ msg: "No token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Try to find as admin first
    const admin = await Admin.findById(payload.id).select("-password");
    if (admin) {
      req.admin = admin;
      console.log('[protectAdminOrUser] authenticated as admin:', admin._id);
      return next();
    }
    // Then try as user
    const user = await User.findById(payload.id).select("-password");
    if (user) {
      req.user = user;
      console.log('[protectAdminOrUser] authenticated as user:', user._id);
      return next();
    }
    // Neither admin nor user found
    console.log('[protectAdminOrUser] no admin or user found for id:', payload.id);
    return res.status(401).json({ msg: "User not found" });
  } catch (err) {
    console.error('[protectAdminOrUser] error:', err);
    return res.status(401).json({ msg: "Invalid token" });
  }
};
