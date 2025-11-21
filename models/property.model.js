import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String },
  description: { type: String },
  type: { type: String, enum: ["Lodge", "Camp", "Villa", "lodge", "camp", "villa"], default: "Lodge" },
  basePricePerNight: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  maxGuests: { type: Number, default: 1 },
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  amenities: [{ type: String }],
  images: [{ type: String }],
  videos: [{ type: String }],
  featured: { type: Boolean, default: false },
  rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }]
}, { timestamps: true });

export default mongoose.model("Property", propertySchema);
