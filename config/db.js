import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // options handled by mongoose v7 defaults
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connect error:", err);
    process.exit(1);
  }
};
