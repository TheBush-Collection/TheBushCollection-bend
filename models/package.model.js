// models/package.model.js
import mongoose from "mongoose";

const itinerarySchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String },
  activities: { type: [String], default: [] },
  image: { type: String },
});

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    duration: { type: String, required: true },
    location: { type: String, required: true },
    accommodationProperty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    // Alias for frontend compatibility
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    shortDescription: { type: String },
    fullDescription: { type: String },
    category: {
      type: String,
      enum: ["Wildlife", "Photography", "Luxury", "Family", "Adventure"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Moderate", "Challenging"],
      default: "Easy",
    },
    maxGuests: { type: Number },
    groupSize: { type: Number },
    mainImage: { type: String },
    // Frontend uses 'image' field for display
    image: { type: String },
    destinations: { type: [String], default: [] },
    galleryImages: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    includes: { type: [String], default: [] },
    excludes: { type: [String], default: [] },
    bestTimeToVisit: { type: String },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numberOfReviews: { type: Number, default: 0 },
    // Frontend uses 'reviews' field for review count
    reviews: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    bookingCount: { type: Number, default: 0, description: "Total number of bookings for this package" },
    itinerary: [itinerarySchema],
  },
  { timestamps: true }
);

const Package = mongoose.model("Package", packageSchema);
export default Package;
