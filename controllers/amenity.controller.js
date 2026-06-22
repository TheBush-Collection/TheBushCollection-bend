// controllers/amenity.controller.js
import Amenity from "../models/amenity.model.js";

/**
 * @desc Create a new amenity
 * @route POST /api/admin/amenities
 * @access Admin
 */
export const createAmenity = async (req, res) => {
  try {
    const {
      name,
      price,
      description,
      category,
      duration,
      availability,
      maxGuests,
      forExternalGuests,
      featured,
      active,
    } = req.body;

    const newAmenity = await Amenity.create({
      name,
      price,
      description,
      category,
      duration,
      availability,
      maxGuests,
      forExternalGuests,
      featured,
      active,
    });

    res.status(201).json({
      message: "Amenity created successfully",
      amenity: newAmenity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Get all amenities
 * @route GET /api/amenities
 * @access Public
 */
export const getAmenities = async (req, res) => {
  try {
    const filters = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.featured) filters.featured = req.query.featured === "true";
    if (req.query.active) filters.active = req.query.active === "true";

    const amenities = await Amenity.find(filters).sort({ createdAt: -1 });
    res.status(200).json(amenities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Get single amenity by ID
 * @route GET /api/amenities/:id
 * @access Public
 */
export const getAmenityById = async (req, res) => {
  try {
    const amenity = await Amenity.findById(req.params.id);
    if (!amenity) return res.status(404).json({ message: "Amenity not found" });
    res.status(200).json(amenity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Update amenity
 * @route PUT /api/admin/amenities/:id
 * @access Admin
 */
export const updateAmenity = async (req, res) => {
  try {
    const updatedAmenity = await Amenity.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedAmenity) return res.status(404).json({ message: "Amenity not found" });
    res.status(200).json({
      message: "Amenity updated successfully",
      amenity: updatedAmenity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Delete amenity
 * @route DELETE /api/admin/amenities/:id
 * @access Admin
 */
export const deleteAmenity = async (req, res) => {
  try {
    const amenity = await Amenity.findByIdAndDelete(req.params.id);
    if (!amenity) return res.status(404).json({ message: "Amenity not found" });
    res.status(200).json({ message: "Amenity deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
