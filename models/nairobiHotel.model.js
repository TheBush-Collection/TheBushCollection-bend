import mongoose from "mongoose";

const nairobiHotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  description: String,
  type: { type: String, enum: ["Lodge", "Villa", "Tented Camp", "Luxury camp"] },
  priceUSD: Number,
  rating: Number,
  numReviews: Number,
  amenities: [{ type: String }],
  images: [{ type: String }],
  bookable: { type: Boolean, default: true }, // partner vs bookable
  rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }]
}, { timestamps: true });

export default mongoose.model("NairobiHotel", nairobiHotelSchema);
