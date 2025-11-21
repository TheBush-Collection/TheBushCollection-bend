import Property from "../models/property.model.js";
import Room from "../models/room.model.js";

export const createProperty = async (req, res) => {
  try {
    const {
      name, location, description, type, basePricePerNight,
      maxGuests, rating, numReviews, amenities, images, videos, featured
    } = req.body;

    if (!name) {
      return res.status(400).json({ msg: "Property name is required" });
    }

    // Normalize type to title case
    const normalizedType = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : "Lodge";

    const property = await Property.create({
      name,
      location: location || "",
      description: description || "",
      type: normalizedType,
      basePricePerNight: Number(basePricePerNight) || 0,
      maxGuests: Number(maxGuests) || 1,
      rating: Number(rating) || 0,
      numReviews: Number(numReviews) || 0,
      amenities: (amenities || "").split(",").map(s => s.trim()).filter(Boolean),
      images: (images || "").split(",").map(s => s.trim()).filter(Boolean),
      videos: (videos || "").split(",").map(s => s.trim()).filter(Boolean),
      featured: !!featured
    });

    res.status(201).json(property);
  } catch (err) {
    console.error("Property creation error:", err);
    res.status(500).json({ msg: "Error creating property", error: err.message });
  }
};

export const updateProperty = async (req, res) => {
  try {
    const prop = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!prop) return res.status(404).json({ msg: "Property not found" });
    res.json(prop);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getProperties = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const q = {};
    if (search) q.name = { $regex: search, $options: "i" };
    const props = await Property.find(q)
      .populate("rooms")
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const count = await Property.countDocuments(q);
    res.json({ data: props, total: count });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getProperty = async (req, res) => {
  try {
    const prop = await Property.findById(req.params.id).populate("rooms");
    if (!prop) return res.status(404).json({ msg: "Not found" });
    res.json(prop);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const prop = await Property.findByIdAndDelete(req.params.id);
    if (!prop) return res.status(404).json({ msg: "Not found" });
    // optionally delete rooms
    await Room.deleteMany({ property: prop._id });
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
