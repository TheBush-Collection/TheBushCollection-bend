import mongoose from "mongoose";

const dateRangeSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
}, { _id: false });

const rateEntrySchema = new mongoose.Schema({
  roomType: { type: String, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  sglBB: { type: Number, default: null },
  dblBB: { type: Number, default: null },
  sglHB: { type: Number, default: null },
  dblHB: { type: Number, default: null },
}, { _id: false });

const seasonalRateSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  name: { type: String, required: true },
  seasonType: { type: String, enum: ["low", "high", "peak"], required: true },
  // Supports multiple date windows (e.g., Peak season spans May-Sep AND Dec-Jan)
  dateRanges: { type: [dateRangeSchema], required: true, validate: v => v.length > 0 },
  // Which meal plans guests can choose during this season
  availableMealPlans: {
    type: [{ type: String, enum: ["BB", "HB", "FB"] }],
    default: ["BB", "HB"],
  },
  rates: [rateEntrySchema],
  minNights: { type: Number, default: 1, min: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

seasonalRateSchema.index({ property: 1 });

export default mongoose.model("SeasonalRate", seasonalRateSchema);
