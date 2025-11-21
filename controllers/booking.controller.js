import Booking from "../models/booking.model.js";
import User from "../models/user.model.js";
import Property from "../models/property.model.js";
import Package from "../models/package.model.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// Generate booking ID
const generateBookingId = () => {
  return 'BK' + Date.now().toString().slice(-8) + crypto.randomBytes(3).toString('hex').toUpperCase();
};

// Generate confirmation number
const generateConfirmationNumber = () => {
  return 'SB' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();
};

// Create booking (comprehensive - for frontend checkout flow)
export const createBooking = async (req, res) => {
  try {
    const {
      bookingType, // 'property' or 'package'
      propertyId,
      packageId,
      rooms, // array of { roomId, quantity, guests, pricePerNightPerPerson }
      checkInDate,
      checkOutDate,
      nights,
      totalGuests,
      adults,
      children,
      specialRequests,
      // Customer info
      customerName,
      customerEmail,
      customerPhone,
      customerCountryCode,
      // Airport transfer
      airportTransfer,
      // Amenities
      amenities, // array of { amenityId, amenityName, quantity, pricePerUnit, totalPrice }
      // Costs
      costs,
      // Payment
      paymentTerm,
      paymentSchedule,
      amountPaid
    } = req.body;

    // Validation
    if (!bookingType || !customerName || !customerEmail || !checkInDate || !checkOutDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: bookingType, customerName, customerEmail, checkInDate, checkOutDate' 
      });
    }

    if (bookingType === 'property' && (!propertyId || !rooms || rooms.length === 0)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Property booking requires propertyId and rooms array' 
      });
    }

    if (bookingType === 'package' && !packageId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Package booking requires packageId' 
      });
    }

    // Create booking document
    const bookingId = generateBookingId();
    const confirmationNumber = generateConfirmationNumber();

    const bookingData = {
      bookingId,
      confirmationNumber,
      bookingType,
      property: bookingType === 'property' ? propertyId : undefined,
      package: bookingType === 'package' ? packageId : undefined,
      customerName,
      customerEmail,
      customerPhone,
      customerCountryCode,
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
      nights: Number(nights) || 0,
      totalGuests: Number(totalGuests),
      adults: Number(adults) || 0,
      children: Number(children) || 0,
      specialRequests,
      rooms: rooms || [],
      airportTransfer: airportTransfer || { needed: false },
      amenities: amenities || [],
      costs: costs || { basePrice: 0, amenitiesTotal: 0, subtotal: 0, serviceFee: 0, taxes: 0, total: 0 },
      paymentTerm: paymentTerm || 'deposit',
      paymentSchedule: paymentSchedule || { depositAmount: 0, balanceAmount: 0, depositDueDate: new Date(), balanceDueDate: new Date() },
      amountPaid: Number(amountPaid) || 0,
      status: 'pending'
    };

    const booking = await Booking.create(bookingData);

    return res.status(201).json({
      success: true,
      booking,
      message: 'Booking created successfully'
    });
  } catch (err) {
    console.error('Booking creation error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message || 'Failed to create booking' 
    });
  }
};

// Admin: list bookings with filters and actions
export const listBookings = async (req, res) => {
  try {
    const { page = 1, limit = 30, status, search } = req.query;
    const q = {};
    if (status) q.status = status;
    if (search) q.bookingId = { $regex: search, $options: "i" };
    const bookings = await Booking.find(q)
      .populate("property", "name")
      .populate("package", "name")
      .skip((page-1)*limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    const total = await Booking.countDocuments(q);
    res.json({ data: bookings, total });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getBooking = async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id)
      .populate("property", "name location")
      .populate("package", "name duration");
    if (!b) return res.status(404).json({ msg: "Not found" });
    res.json(b);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Get booking by bookingId (for customers)
export const getBookingByRef = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const b = await Booking.findOne({ bookingId })
      .populate("property", "name location address")
      .populate("package", "name duration description");
    
    if (!b) {
      return res.status(404).json({ 
        success: false,
        msg: "Booking not found" 
      });
    }

    // Allow access if user is owner or admin
    if (req.user && req.user.role !== 'admin' && b.customerEmail !== req.user.email) {
      return res.status(403).json({ 
        success: false,
        msg: "Not authorized to view this booking" 
      });
    }

    res.json({
      success: true,
      booking: b
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};

// Admin actions - Update booking status
export const setDepositPaid = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        msg: "Booking not found" 
      });
    }

    // Validate status transition
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false,
        msg: "Cannot update a cancelled booking" 
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status: "deposit_paid" }, 
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking status updated to deposit_paid",
      booking: updatedBooking
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};

export const setConfirmed = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        msg: "Booking not found" 
      });
    }

    // Validate status transition
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false,
        msg: "Cannot update a cancelled booking" 
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status: "confirmed" }, 
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking status updated to confirmed",
      booking: updatedBooking
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};

export const setFullyPaid = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        msg: "Booking not found" 
      });
    }

    // Validate status transition
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false,
        msg: "Cannot update a cancelled booking" 
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status: "fully_paid" }, 
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking status updated to fully_paid",
      booking: updatedBooking
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};

export const reopenBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        msg: "Booking not found" 
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status: "pending" }, 
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking reopened (status set to pending)",
      booking: updatedBooking
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        msg: "Booking not found" 
      });
    }

    // Check if user is authorized (admin or booking owner)
    if (req.user && req.user.role !== 'admin' && booking.customerEmail !== req.user.email) {
      return res.status(403).json({ 
        success: false,
        msg: "Not authorized to cancel this booking" 
      });
    }

    // Only allow cancellation of non-cancelled bookings
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false,
        msg: "Booking is already cancelled" 
      });
    }

    // Store old status for audit trail
    const previousStatus = booking.status;

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { 
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: req.user?.role || 'unknown'
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      previousStatus,
      booking: updatedBooking
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};

// Generate receipt for booking
export const generateReceipt = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId })
      .populate("property", "name location address")
      .populate("package", "name duration description");
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        msg: "Booking not found" 
      });
    }

    // Allow access if user is owner or admin
    if (req.user && req.user.role !== 'admin' && booking.customerEmail !== req.user.email) {
      return res.status(403).json({ 
        success: false,
        msg: "Not authorized to download this receipt" 
      });
    }

    // Format receipt data
    const receipt = {
      bookingId: booking.bookingId,
      confirmationNumber: booking.confirmationNumber,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      bookingType: booking.bookingType,
      propertyName: booking.property?.name || 'N/A',
      packageName: booking.package?.name || 'N/A',
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      nights: booking.nights,
      totalGuests: booking.totalGuests,
      adults: booking.adults,
      children: booking.children,
      specialRequests: booking.specialRequests || 'None',
      airportTransfer: booking.airportTransfer?.needed ? 'Yes' : 'No',
      amenities: booking.amenities || [],
      costs: booking.costs,
      paymentTerm: booking.paymentTerm,
      paymentSchedule: booking.paymentSchedule,
      amountPaid: booking.amountPaid,
      status: booking.status,
      createdAt: booking.createdAt,
      generatedAt: new Date()
    };

    res.json({
      success: true,
      receipt
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};
