import express from "express";
import { protectAdmin } from "../middleware/auth.js";
import {
  listSeasonalRates,
  getRateByDate,
  getActiveSeasons,
  createSeasonalRate,
  updateSeasonalRate,
  deleteSeasonalRate,
} from "../controllers/seasonalRate.controller.js";

const router = express.Router();

// Public reads — BookNow needs these without auth
router.get("/", listSeasonalRates);
router.get("/by-date", getRateByDate);
router.get("/active", getActiveSeasons);

// Admin writes
router.post("/", protectAdmin, createSeasonalRate);
router.put("/:id", protectAdmin, updateSeasonalRate);
router.delete("/:id", protectAdmin, deleteSeasonalRate);

export default router;
