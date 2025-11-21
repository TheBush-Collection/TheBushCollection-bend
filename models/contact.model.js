import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  phone: { type: String },
  subject: { type: String, enum: ["General enquiry", "Booking Question", "Custom Safari request", "Group booking", "Customer support"], default: "General enquiry" },
  preferredTravelDates: { type: String },
  groupSize: { type: String, enum: ["1 person", "2 people", "3-4 people", "5-8 people", "9+ people"], default: "1 person" },
  safariInterests: { type: String },
  message: { type: String, required: true },
  subscribedToMailchimp: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Contact', contactSchema);