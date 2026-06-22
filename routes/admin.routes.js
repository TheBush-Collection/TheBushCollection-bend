import express from "express";
import { protectAdmin } from "../middleware/auth.js";
import { dashboard, analytics } from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/", protectAdmin, (_req, res) => res.json({ msg: "Admin root" }));
router.get("/dashboard", protectAdmin, dashboard);
router.get("/analytics", protectAdmin, analytics);

// You should attach other admin routes here, e.g. admin/customers, admin/properties etc.
// For readability, those are separated by their own route files in a real project.

export default router;
