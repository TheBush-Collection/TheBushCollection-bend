import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  // Booking identification
  bookingId: { type: String, required: true },
  
  // Customer information
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true, lowercase: true },
  customerPhone: { type: String },
  customerCountryCode: { type: String },
  
  // Booking type and property/package
  bookingType: { type: String, enum: ["property", "package"], required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
  package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
  
  // Dates
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  nights: { type: Number, required: true },
  
  // Guest information
  totalGuests: { type: Number, required: true },
  adults: { type: Number, default: 0 },
  children: { type: Number, default: 0 },
  specialRequests: { type: String },
  
  // Room bookings (for property bookings)
  rooms: [{
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    roomName: String,
    quantity: Number,
    guests: Number,
    pricePerNightPerPerson: Number,
    subtotal: Number
  }],
  
  // Airport transfer details
  airportTransfer: {
    needed: { type: Boolean, default: false },
    arrivalDate: Date,
    arrivalTime: String,
    arrivalFlightNumber: String,
    departureDate: Date,
    departureTime: String,
    departureFlightNumber: String
  },
  
  // Amenities
  amenities: [{
    // Amenity ID may come from frontend mock data (strings) or DB ObjectId.
    // Use String here to accept both string identifiers and ObjectId hex strings.
    amenityId: { type: String },
    amenityName: String,
    quantity: Number,
    pricePerUnit: Number,
    totalPrice: Number
  }],
  
  // Cost breakdown
  costs: {
    basePrice: { type: Number, default: 0 }, // accommodation or package base price
    amenitiesTotal: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 }, // 10%
    taxes: { type: Number, default: 0 }, // 15% for property, 12% for package
    total: { type: Number, default: 0 }
  },
  
  // Payment terms and schedule
  paymentTerm: { type: String, enum: ["deposit", "full"], default: "deposit" },
  paymentSchedule: {
    depositAmount: { type: Number, default: 0 }, // 30%
    balanceAmount: { type: Number, default: 0 }, // 70%
    depositDueDate: Date,
    balanceDueDate: Date
  },
  
  // Payment information
  amountPaid: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ["pending", "deposit_paid", "confirmed", "fully_paid", "cancelled"], 
    default: "pending" 
  },
  paymentDetails: { type: Object }, // store raw payment provider response (PesaPal, etc.)
  
  // Booking confirmation
  confirmationNumber: String,
  
  // Cancellation tracking (for audit trail)
  cancelledAt: Date,
  cancelledBy: { type: String, enum: ["customer", "admin", "unknown"] },
  cancellationReason: String,
  
  // Additional metadata
  notes: String,
  internalNotes: String
}, { timestamps: true });

// Index for faster queries
bookingSchema.index({ customerEmail: 1 });
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ checkInDate: 1 });

export default mongoose.model("Booking", bookingSchema);
