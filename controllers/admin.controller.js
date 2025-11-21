import Admin from "../models/admin.model.js";
import Booking from "../models/booking.model.js";
import User from "../models/user.model.js";
import Property from "../models/property.model.js";

// basic dashboard summary
export const dashboard = async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const totalCustomers = await User.countDocuments();
    const totalProperties = await Property.countDocuments();
    const recentBookings = await Booking.find().sort({ createdAt: -1 }).limit(10)
      .populate("customer", "fullName")
      .populate("property", "name");
    res.json({ totalBookings, totalCustomers, totalProperties, recentBookings });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// analytics placeholder (extend as required)
export const analytics = async (req, res) => {
  try {
    // Example: bookings per month (basic)
    const bookings = await Booking.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
