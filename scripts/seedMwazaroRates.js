// Run: node --experimental-vm-modules scripts/seedMwazaroRates.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// ── Minimal schemas (mirror the real models) ───────────────────────────────
const PropertySchema = new mongoose.Schema({ name: String }, { strict: false });
const Property = mongoose.model("Property", PropertySchema);

const dateRangeSchema = new mongoose.Schema({ startDate: Date, endDate: Date }, { _id: false });
const rateEntrySchema = new mongoose.Schema({
  roomType: String, roomId: mongoose.Schema.Types.ObjectId,
  sglBB: Number, dblBB: Number, sglHB: Number, dblHB: Number,
}, { _id: false });

const SeasonalRateSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
  name: String, seasonType: String,
  dateRanges: [dateRangeSchema],
  availableMealPlans: [String],
  rates: [rateEntrySchema],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
const SeasonalRate = mongoose.model("SeasonalRate", SeasonalRateSchema);

// ── Rate data from the 2026 Mwazaro Rate Card PDF ─────────────────────────
const LOW_SEASON = {
  name: "Low Season 2026",
  seasonType: "low",
  dateRanges: [{ startDate: new Date("2026-10-01"), endDate: new Date("2026-12-20") }],
  availableMealPlans: ["BB", "HB"],
  rates: [
    { roomType: "Single Rooms",    sglBB: 123,  dblBB: null, sglHB: 150,  dblHB: null },
    { roomType: "Double Rooms",    sglBB: 136,  dblBB: 179,  sglHB: 165,  dblHB: 236  },
    { roomType: "Makuti Classic",  sglBB: 186,  dblBB: 229,  sglHB: 215,  dblHB: 286  },
    { roomType: "Deluxe Rooms",    sglBB: 200,  dblBB: 265,  sglHB: 229,  dblHB: 322  },
    { roomType: "Beach Bar Rooms", sglBB: 243,  dblBB: 294,  sglHB: 272,  dblHB: 351  },
    { roomType: "Family Suites",   sglBB: null, dblBB: 394,  sglHB: null, dblHB: 455  },
  ],
};

const HIGH_SEASON = {
  name: "High Season 2026",
  seasonType: "high",
  dateRanges: [{ startDate: new Date("2026-01-15"), endDate: new Date("2026-04-30") }],
  availableMealPlans: ["HB"],
  rates: [
    { roomType: "Single Rooms",    sglBB: null, dblBB: null, sglHB: 172,  dblHB: null },
    { roomType: "Double Rooms",    sglBB: null, dblBB: null, sglHB: 215,  dblHB: 308  },
    { roomType: "Makuti Classic",  sglBB: null, dblBB: null, sglHB: 265,  dblHB: 358  },
    { roomType: "Deluxe Rooms",    sglBB: null, dblBB: null, sglHB: 280,  dblHB: 400  },
    { roomType: "Beach Bar Rooms", sglBB: null, dblBB: null, sglHB: 322,  dblHB: 429  },
    { roomType: "Family Suites",   sglBB: null, dblBB: null, sglHB: null, dblHB: 533  },
  ],
};

// Peak season spans two separate date windows — stored as one document
const PEAK_SEASON = {
  name: "Peak Season 2026-2027",
  seasonType: "peak",
  dateRanges: [
    { startDate: new Date("2026-05-01"), endDate: new Date("2026-09-30") },
    { startDate: new Date("2026-12-21"), endDate: new Date("2027-01-14") },
  ],
  availableMealPlans: ["HB"],
  rates: [
    { roomType: "Single Rooms",    sglBB: null, dblBB: null, sglHB: 212,  dblHB: null },
    { roomType: "Double Rooms",    sglBB: null, dblBB: null, sglHB: 255,  dblHB: 388  },
    { roomType: "Makuti Classic",  sglBB: null, dblBB: null, sglHB: 305,  dblHB: 438  },
    { roomType: "Deluxe Rooms",    sglBB: null, dblBB: null, sglHB: 320,  dblHB: 480  },
    { roomType: "Beach Bar Rooms", sglBB: null, dblBB: null, sglHB: 362,  dblHB: 509  },
    { roomType: "Family Suites",   sglBB: null, dblBB: null, sglHB: null, dblHB: 693  },
  ],
};

// ── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Find Mwazaro property (case-insensitive)
  const property = await Property.findOne({ name: /mwazaro/i });
  if (!property) {
    console.error("❌ Mwazaro property not found. Make sure it exists in the database.");
    process.exit(1);
  }
  console.log(`✅ Found property: ${property.name} (${property._id})`);

  // Remove any existing Mwazaro seasonal rates to avoid duplicates
  const deleted = await SeasonalRate.deleteMany({ property: property._id });
  if (deleted.deletedCount) console.log(`🗑  Removed ${deleted.deletedCount} existing seasonal rate(s)`);

  // Insert all three seasons
  const seasons = [LOW_SEASON, HIGH_SEASON, PEAK_SEASON];
  for (const s of seasons) {
    const doc = await SeasonalRate.create({ ...s, property: property._id });
    console.log(`✅ Created: ${doc.name} (${doc._id})`);
  }

  console.log("\n🎉 All Mwazaro seasonal rates seeded successfully.");
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
