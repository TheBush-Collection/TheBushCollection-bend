// routes/public.routes.js
import express from "express";
import Property from "../models/property.model.js";
import Room from "../models/room.model.js";
import NairobiHotel from "../models/nairobiHotel.model.js";

const router = express.Router();

router.get("/featured", async (req, res) => {
  try {
    const properties = await Property.find().limit(5);
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const rooms = await Room.find().populate("property");
    res.status(200).json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/nairobi-hotels", async (req, res) => {
  try {
    const hotels = await NairobiHotel.find().limit(10);
    res.status(200).json(hotels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
