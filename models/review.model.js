import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  // User who wrote the review
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  user_name: { type: String, required: true },
  user_email: { type: String, lowercase: true },

  // Property or Package being reviewed
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
  property_name: { type: String },
  package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
  package_name: { type: String },

  // Booking reference
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },

  // Review content
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, maxlength: 200 },
  comment: { type: String, maxlength: 5000 },

  // Review management
  is_approved: { type: Boolean, default: false },
  is_featured: { type: Boolean, default: false },

  // Moderation notes
  admin_notes: { type: String },

  // Metadata
  helpful_count: { type: Number, default: 0 },
  unhelpful_count: { type: Number, default: 0 },

}, { timestamps: true });

export default mongoose.model("Review", reviewSchema);
