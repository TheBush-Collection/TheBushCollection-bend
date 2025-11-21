// controllers/room.controller.js
import Room from "../models/room.model.js";
import Property from "../models/property.model.js";

// Normalize incoming room type values to match schema enum values
const normalizeRoomType = (val) => {
  if (!val) return 'Suite';
  const v = String(val).trim().toLowerCase();
  if (v === 'tent' || v === 'tents') return 'Tent';
  if (v === 'suite' || v === 'suites') return 'Suite';
  if (v.includes('family') && v.includes('lodge')) return 'Family lodge';
  if (v.includes('luxury') && v.includes('tent')) return 'Luxury tent';
  // common synonyms
  if (v === 'family' || v === 'familylodge') return 'Family lodge';
  // Fallback: title-case each word
  return v.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export const createRoom = async (req, res) => {
  try {
    // Handle both frontend field names (type, price, max_guests, property)
    // and backend field names (roomType, pricePerNight, maxGuests, propertyId)
    const { 
      property, propertyId, 
      name, 
      type, roomType,
      price, pricePerNight,
      max_guests, maxGuests, capacity,
      quantity = 1,
      amenities, 
      images,
      description,
      availableForBooking = true 
    } = req.body;

    const propId = property || propertyId;
    if (!propId) return res.status(400).json({ message: "Property ID is required" });

    const foundProperty = await Property.findById(propId);
    if (!foundProperty) return res.status(404).json({ message: "Property not found" });

    const room = await Room.create({
      property: propId,
      name,
      roomType: normalizeRoomType(type || roomType),
      pricePerNight: price || pricePerNight || 0,
      maxGuests: max_guests || maxGuests || capacity || 1,
      quantity,
      amenities: Array.isArray(amenities) ? amenities : (amenities ? String(amenities).split(',').map(s => s.trim()) : []),
      images: Array.isArray(images) ? images : (images ? String(images).split(',').map(s => s.trim()) : []),
      description,
      availableForBooking,
    });

    foundProperty.rooms.push(room._id);
    await foundProperty.save();

    res.status(201).json(room);
  } catch (error) {
    console.error('[createRoom] Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find().populate("property");
    res.status(200).json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate("property");
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.status(200).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateRoom = async (req, res) => {
  try {
    // Normalize incoming field names
    const { 
      type, roomType,
      price, pricePerNight,
      max_guests, maxGuests, capacity,
      ...restData 
    } = req.body;

    const updateData = {
      ...restData,
      ...(type || roomType) && { roomType: normalizeRoomType(type || roomType) },
      ...(price || pricePerNight) && { pricePerNight: price || pricePerNight },
      ...(max_guests || maxGuests || capacity) && { maxGuests: max_guests || maxGuests || capacity },
    };

    const room = await Room.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.status(200).json(room);
  } catch (error) {
    console.error('[updateRoom] Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.status(200).json({ message: "Room deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
