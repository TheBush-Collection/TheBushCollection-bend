import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const SeasonalRateSchema = new mongoose.Schema({}, { strict: false });
const SeasonalRate = mongoose.model("SeasonalRate", SeasonalRateSchema);

// Mwazaro property ID from seed output
const PROPERTY_ID = "69648dc045469d05d32e9452";

// Adjust these to match whatever your property requires
const MIN_NIGHTS_BY_SEASON = {
  low:  2,   // Low season: 2-night minimum
  high: 3,   // High season: 3-night minimum
  peak: 4,   // Peak season: 4-night minimum
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  for (const [seasonType, minNights] of Object.entries(MIN_NIGHTS_BY_SEASON)) {
    const result = await SeasonalRate.updateOne(
      { property: new mongoose.Types.ObjectId(PROPERTY_ID), seasonType },
      { $set: { minNights } }
    );
    console.log(`${seasonType}: set minNights=${minNights} (matched ${result.matchedCount})`);
  }

  await mongoose.disconnect();
  console.log("Done");
}

run().catch(e => { console.error(e); process.exit(1); });
