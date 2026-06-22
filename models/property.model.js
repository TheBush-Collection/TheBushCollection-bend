import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String },
  description: { type: String },
  type: { type: String, enum: ["Lodge", "Camp", "Villa", "lodge", "camp", "villa"], default: "Lodge" },
  category: { type: String, enum: ["bush", "beach"], default: "bush" },
  basePricePerNight: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  maxGuests: { type: Number, default: 1 },
  minNights: { type: Number, default: 1, min: 1 },
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  amenities: [{ type: String }],
  images: [{ type: String }],
  videos: [{ type: String }],
  featured: { type: Boolean, default: false },
  externalUrl: { type: String, default: null },
  rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }]
}, { timestamps: true });

export default mongoose.model("Property", propertySchema);
