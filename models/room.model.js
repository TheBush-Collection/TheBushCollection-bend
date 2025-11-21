import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  name: { type: String, required: true },
  roomType: { type: String, enum: ["Tent", "Suite", "Family lodge", "Luxury tent"], required: true },
  pricePerNight: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  maxGuests: { type: Number, default: 1 },
  quantity: { type: Number, default: 1 },
  description: { type: String },
  amenities: [{ type: String }],
  images: [{ type: String }],
  videos: [{ type: String }],
  availableForBooking: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Room", roomSchema);
