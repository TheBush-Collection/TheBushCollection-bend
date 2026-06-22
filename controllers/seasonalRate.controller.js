import SeasonalRate from "../models/seasonalRate.model.js";

export const listSeasonalRates = async (req, res) => {
  try {
    const filter = {};
    if (req.query.propertyId) filter.property = req.query.propertyId;
    const rates = await SeasonalRate.find(filter)
      .populate("property", "name")
      .sort({ "dateRanges.0.startDate": 1 });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Public endpoint: find which season covers a specific date
export const getRateByDate = async (req, res) => {
  try {
    const { date, propertyId } = req.query;
    if (!date) return res.status(400).json({ message: "date query param required" });

    const target = new Date(date);
    const filter = {
      isActive: true,
      dateRanges: {
        $elemMatch: {
          startDate: { $lte: target },
          endDate: { $gte: target },
        },
      },
    };
    if (propertyId) filter.property = propertyId;

    const rate = await SeasonalRate.findOne(filter).populate("property", "name");
    res.json(rate || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Public endpoint: get all active seasons for a property (used for calendar display in BookNow)
export const getActiveSeasons = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.propertyId) filter.property = req.query.propertyId;
    const rates = await SeasonalRate.find(filter, "name seasonType dateRanges availableMealPlans rates")
      .sort({ "dateRanges.0.startDate": 1 });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createSeasonalRate = async (req, res) => {
  try {
    const rate = new SeasonalRate(req.body);
    await rate.save();
    await rate.populate("property", "name");
    res.status(201).json(rate);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const updateSeasonalRate = async (req, res) => {
  try {
    const rate = await SeasonalRate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("property", "name");
    if (!rate) return res.status(404).json({ message: "Season not found" });
    res.json(rate);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const deleteSeasonalRate = async (req, res) => {
  try {
    const rate = await SeasonalRate.findByIdAndDelete(req.params.id);
    if (!rate) return res.status(404).json({ message: "Season not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
