import mongoose from "mongoose";
import Property from "../models/property.model.js";
import Room from "../models/room.model.js";

export const createProperty = async (req, res) => {
  try {
    const {
      name, location, description, type, category, basePricePerNight,
      maxGuests, minNights, rating, numReviews, amenities, images, videos, featured, externalUrl
    } = req.body;

    if (!name) {
      return res.status(400).json({ msg: "Property name is required" });
    }

    // Helper function to normalize arrays/strings
    const toArray = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
      return String(v).split(",").map(s => s.trim()).filter(Boolean);
    };

    // Normalize type to title case
    const normalizedType = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : "Lodge";
    const normalizedCategory = typeof category === "string"
      ? category.toLowerCase()
      : "bush";
    const categoryValue = ["bush", "beach"].includes(normalizedCategory) ? normalizedCategory : "bush";

    const property = await Property.create({
      name,
      location: location || "",
      description: description || "",
      type: normalizedType,
  basePricePerNight: Number(basePricePerNight) || 0,
  category: categoryValue,
      maxGuests: Number(maxGuests) || 1,
      minNights: Number(minNights) || 1,
      rating: Number(rating) || 0,
      numReviews: Number(numReviews) || 0,
      amenities: toArray(amenities),
      images: toArray(images),
      videos: toArray(videos),
      featured: !!featured,
      externalUrl: externalUrl || null
    });

    res.status(201).json(property);
  } catch (err) {
    console.error("Property creation error:", err);
    res.status(500).json({ msg: "Error creating property", error: err.message });
  }
};

export const updateProperty = async (req, res) => {
  try {
    // Normalize incoming fields so images, videos and amenities are always arrays
    const {
      name, location, description, type, category, basePricePerNight,
      maxGuests, minNights, rating, numReviews, amenities, images, videos, featured, externalUrl
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) {
      const normalizedCategory = typeof category === "string" ? category.toLowerCase() : "bush";
      updateData.category = ["bush", "beach"].includes(normalizedCategory) ? normalizedCategory : "bush";
    }
    if (basePricePerNight !== undefined) updateData.basePricePerNight = Number(basePricePerNight) || 0;
    if (maxGuests !== undefined) updateData.maxGuests = Number(maxGuests) || 1;
    if (minNights !== undefined) updateData.minNights = Math.max(1, Number(minNights) || 1);
    if (rating !== undefined) updateData.rating = Number(rating) || 0;
    if (numReviews !== undefined) updateData.numReviews = Number(numReviews) || 0;

    // Accept either an array or a comma-separated string for these fields
    if (amenities !== undefined) {
      updateData.amenities = Array.isArray(amenities)
        ? amenities.map(s => String(s).trim()).filter(Boolean)
        : String(amenities || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    if (images !== undefined) {
      updateData.images = Array.isArray(images)
        ? images.map(s => String(s).trim()).filter(Boolean)
        : String(images || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    if (videos !== undefined) {
      updateData.videos = Array.isArray(videos)
        ? videos.map(s => String(s).trim()).filter(Boolean)
        : String(videos || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    if (featured !== undefined) updateData.featured = !!featured;
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl || null;

    // Debug log incoming media and normalized update payload
    try {
      console.debug('[property.controller] updateProperty req.body.images:', images);
      console.debug('[property.controller] updateProperty updateData:', updateData);
    } catch (e) {
      // ignore
    }

    const prop = await Property.findByIdAndUpdate(req.params.id, updateData, { new: true });
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
    const { id } = req.params;
    let prop = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      prop = await Property.findById(id).populate("rooms");
    }

    if (!prop) {
      // Slug lookup: "mbuyu-watatu" → match name "Mbuyu Watatu" case-insensitively
      const namePattern = id.replace(/-/g, '[\\s\\-]+');
      prop = await Property.findOne({
        name: { $regex: new RegExp(`^${namePattern}$`, 'i') }
      }).populate("rooms");
    }

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
