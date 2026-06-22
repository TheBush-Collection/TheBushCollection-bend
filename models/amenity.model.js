// models/amenity.model.js
import mongoose from "mongoose";

const amenitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    category: {
      type: String,
      enum: ["Activity", "Dining", "Spa", "Transport", "Facility"],
      required: true,
    },
    duration: { type: String },
    availability: {
      type: String,
      enum: ["Always available", "Seasonal", "On request"],
      default: "Always available",
    },
    maxGuests: { type: Number, default: 0 },
    forExternalGuests: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Amenity = mongoose.model("Amenity", amenitySchema);
export default Amenity;
