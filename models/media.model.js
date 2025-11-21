import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ["image", "video"], required: true },
  category: { type: String, enum: ["Wildlife", "Landscapes", "Culture", "Accommodations", "Activities", "Safari experience"] },
  thumbnailUrl: String,
  description: String,
  featured: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Media", mediaSchema);
