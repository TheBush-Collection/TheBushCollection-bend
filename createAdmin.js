import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import Admin from './models/admin.model.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const ADMIN_NAME = process.env.ADMIN_NAME || 'Local Admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Please set ADMIN_EMAIL and ADMIN_PASSWORD in your .env or pass them as environment variables.');
  process.exit(1);
}

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

async function run() {
  try {
    await connectDB();
    const normalizedEmail = String(ADMIN_EMAIL).toLowerCase().trim();
    console.log('[createAdmin] normalized admin email:', normalizedEmail);
    let admin = await Admin.findOne({ email: { $regex: `^${normalizedEmail}$`, $options: 'i' } });
    if (admin) {
      console.log('[createAdmin] Admin user already exists:', normalizedEmail);
    } else {
      admin = new Admin({ name: ADMIN_NAME, email: normalizedEmail, password: ADMIN_PASSWORD });
      await admin.save();
      console.log('[createAdmin] Admin created:', normalizedEmail, 'id:', admin._id);
    }
    const token = signToken(admin._id);
    console.log('\nUse this token to authorize as admin (Bearer token):\n');
    console.log(token);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

run();