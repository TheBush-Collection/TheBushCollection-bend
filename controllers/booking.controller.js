import Booking from "../models/booking.model.js";
import User from "../models/user.model.js";
import Property from "../models/property.model.js";
import Package from "../models/package.model.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { subscribeContactInternal } from "./mailchimp.controller.js";
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

// Helper to create SMTP transporter from env
const getSmtpTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });
};

// Generate booking ID
const generateBookingId = () => {
  return 'BK' + Date.now().toString().slice(-8) + crypto.randomBytes(3).toString('hex').toUpperCase();
};

// Generate confirmation number
const generateConfirmationNumber = () => {
  return 'SB' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();
};

// Helper to send booking notification via Mailchimp service
const sendBookingNotification = async (booking, type = 'booking_created') => {
  if (!booking || !booking.customerEmail) return;

  const email = booking.customerEmail || booking.customerEmail;
  const name = (booking.customerName || '').split(' ');
  const merge_fields = {
    FNAME: name[0] || '',
    LNAME: name.slice(1).join(' ') || '',
    BOOKING_ID: booking.bookingId || booking._id || booking.id || '',
    CONFIRMATION: booking.confirmationNumber || booking.confirmation_number || '',
    STATUS: booking.status || '',
    CHECKIN: booking.checkInDate ? new Date(booking.checkInDate).toISOString().split('T')[0] : (booking.checkIn ? booking.checkIn : ''),
    CHECKOUT: booking.checkOutDate ? new Date(booking.checkOutDate).toISOString().split('T')[0] : (booking.checkOut ? booking.checkOut : ''),
    AMOUNT: booking.costs?.total ?? booking.total ?? 0,
    PROPERTY: booking.property?.name || booking.property_name || ''
  };

  const tag = `booking_${type}`; // e.g., booking_booking_created, booking_cancelled
  // 1) Subscribe/update Mailchimp and add tag (existing behavior)
  try {
    await subscribeContactInternal({
      email_address: email,
      merge_fields,
      tags: [tag]
    });
    console.log(`Mailchimp: notification tag '${tag}' added for ${email}`);
  } catch (err) {
    console.error('Mailchimp subscribeContactInternal error:', err);
  }

  // 2) Send transactional email with PDF receipt attached (if SMTP configured)
  try {
    const transporter = getSmtpTransporter();
    if (!transporter) {
      console.warn('SMTP not configured - skipping transactional email');
      return;
    }

    // Verify SMTP connection/configuration (logs errors if any)
    try {
      await transporter.verify();
      console.log('SMTP transporter verified');
    } catch (verifyErr) {
      console.error('SMTP verify failed:', verifyErr);
      // continue - sendMail will likely fail but we keep error handling below
    }

    // Prepare email HTML
    const subject = `Your booking receipt - ${merge_fields.CONFIRMATION || merge_fields.BOOKING_ID}`;
    const html = `<p>Dear ${merge_fields.FNAME || 'Guest'},</p>
      <p>Thank you for your booking. Please find your receipt attached.</p>
      <ul>
        <li><strong>Booking ID:</strong> ${merge_fields.BOOKING_ID}</li>
        <li><strong>Confirmation:</strong> ${merge_fields.CONFIRMATION}</li>
        <li><strong>Property:</strong> ${merge_fields.PROPERTY}</li>
        <li><strong>Check-in:</strong> ${merge_fields.CHECKIN}</li>
        <li><strong>Check-out:</strong> ${merge_fields.CHECKOUT}</li>
        <li><strong>Amount:</strong> ${merge_fields.AMOUNT}</li>
      </ul>
      <p>Kind regards,<br/>The Bush Collection</p>`;

    // Generate simple PDF receipt in memory using PDFKit
    const pdfBuffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header
        doc.fontSize(20).text('The Bush Collection', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Booking Receipt`, { align: 'center' });
        doc.moveDown();

        // Booking details
        doc.fontSize(12).text(`Booking ID: ${merge_fields.BOOKING_ID}`);
        doc.text(`Confirmation: ${merge_fields.CONFIRMATION}`);
        doc.text(`Customer: ${booking.customerName || ''}`);
        doc.text(`Email: ${booking.customerEmail || ''}`);
        doc.moveDown();
        doc.text(`Property: ${merge_fields.PROPERTY}`);
        doc.text(`Check-in: ${merge_fields.CHECKIN}`);
        doc.text(`Check-out: ${merge_fields.CHECKOUT}`);
        doc.moveDown();
        doc.text(`Nights: ${booking.nights || ''}`);
        doc.text(`Guests: ${booking.totalGuests || ''}`);
        doc.moveDown();
        doc.fontSize(12).text(`Total: ${merge_fields.AMOUNT}`);
        doc.moveDown();

        doc.fontSize(10).text('Thank you for booking with The Bush Collection.');

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@thebushcollection.africa',
      to: email,
      subject,
      html,
      attachments: [
        {
          filename: `Receipt_${merge_fields.CONFIRMATION || merge_fields.BOOKING_ID}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    // Ensure we have a valid sender and log mail options for debugging
    const resolvedFrom = mailOptions.from || process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@thebushcollection.africa';
    console.log('Sending transactional email - from:', resolvedFrom, 'to:', mailOptions.to);
    // Explicitly set SMTP envelope to avoid provider showing an empty MAIL FROM
    const sendOpts = { ...mailOptions, envelope: { from: resolvedFrom, to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to] } };
    console.log('Transactional mail send options (envelope will be used):', { envelope: sendOpts.envelope });

    const info = await transporter.sendMail(sendOpts);
    console.log('Transactional receipt email sent:', info && info.messageId);
    // Log provider response for delivery debugging
    if (info && info.response) console.log('SMTP response:', info.response);
    if (info && info.envelope) console.log('SMTP envelope:', info.envelope);
    if (info && info.accepted) console.log('SMTP accepted:', info.accepted);
    if (info && info.rejected) console.log('SMTP rejected:', info.rejected);
  } catch (err) {
    console.error('Error sending transactional email (booking notification):', err);
  }
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

      // Fire-and-forget: subscribe/contact update in Mailchimp and trigger automation by adding tags
      (async () => {
        try {
          await sendBookingNotification(booking, 'booking_created');
        } catch (err) {
          console.error('Mailchimp notify error (createBooking):', err);
        }
      })();

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

// List bookings for the authenticated user
export const listUserBookings = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ msg: 'Not authenticated' });
    const email = req.user.email;
    const bookings = await Booking.find({ customerEmail: email })
      .populate('property', 'name')
      .populate('package', 'name')
      .sort({ createdAt: -1 });
    res.json({ data: bookings });
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

    // Determine deposit amount: prefer explicit amount from caller, else use stored paymentSchedule or fallback to 30% of total
    const callerAmount = req.body?.amountPaid != null ? Number(req.body.amountPaid) : null;
    const callerPaymentDetails = req.body?.paymentDetails || null;
    const depositAmount = callerAmount != null
      ? callerAmount
      : (booking.paymentSchedule && booking.paymentSchedule.depositAmount)
        ? Number(booking.paymentSchedule.depositAmount)
        : (booking.costs && booking.costs.total ? Math.round((booking.costs.total * 0.3 + Number.EPSILON) * 100) / 100 : 0);

    const update = {
      status: "deposit_paid",
      amountPaid: depositAmount,
      paymentTerm: booking.paymentTerm || 'deposit'
    };
    if (callerPaymentDetails) update.paymentDetails = callerPaymentDetails;

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking status updated to deposit_paid",
      booking: updatedBooking
    });
    (async () => {
      try {
        await sendBookingNotification(updatedBooking, 'deposit_paid');
      } catch (err) {
        console.error('Mailchimp notify error (deposit_paid):', err);
      }
    })();
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
    (async () => {
      try {
        await sendBookingNotification(updatedBooking, 'confirmed');
      } catch (err) {
        console.error('Mailchimp notify error (confirmed):', err);
      }
    })();
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

    // Determine paid amount: prefer explicit amount from caller, else use stored costs.total
    const callerAmount = req.body?.amountPaid != null ? Number(req.body.amountPaid) : null;
    const callerPaymentDetails = req.body?.paymentDetails || null;
    const paidAmount = callerAmount != null
      ? callerAmount
      : (booking.costs && booking.costs.total ? Number(booking.costs.total) : 0);

    const update = {
      status: "fully_paid",
      amountPaid: paidAmount,
      paymentTerm: 'full'
    };
    if (callerPaymentDetails) update.paymentDetails = callerPaymentDetails;

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking status updated to fully_paid",
      booking: updatedBooking
    });
    (async () => {
      try {
        await sendBookingNotification(updatedBooking, 'fully_paid');
      } catch (err) {
        console.error('Mailchimp notify error (fully_paid):', err);
      }
    })();
  } catch (err) {
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
};

// Admin: mark booking as completed (e.g., guest checked in)
export const setCompleted = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    // Do not complete a cancelled booking
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, msg: "Cannot complete a cancelled booking" });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', checkedInAt: new Date() },
      { new: true }
    );

    res.json({ success: true, message: 'Booking marked as completed', booking: updatedBooking });

    (async () => {
      try {
        await sendBookingNotification(updatedBooking, 'checked_in');
      } catch (err) {
        console.error('Mailchimp notify error (checked_in):', err);
      }
    })();
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
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
    (async () => {
      try {
        await sendBookingNotification(updatedBooking, 'reopened');
      } catch (err) {
        console.error('Mailchimp notify error (reopened):', err);
      }
    })();
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

    // Accept optional reason from request body
    const cancellationReason = req.body?.reason || req.body?.cancellationReason || null;

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { 
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: req.user?.role || 'unknown',
        cancellationReason: cancellationReason
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      previousStatus,
      booking: updatedBooking
    });
    (async () => {
      try {
        await sendBookingNotification(updatedBooking, 'cancelled');
      } catch (err) {
        console.error('Mailchimp notify error (cancelled):', err);
      }
    })();
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

// Manual notify endpoint to resend or trigger a specific notification for a booking
export const notifyBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'booking_created' } = req.body;
    const booking = await Booking.findById(id)
      .populate('property', 'name')
      .populate('package', 'name');

    if (!booking) return res.status(404).json({ success: false, msg: 'Booking not found' });

    await sendBookingNotification(booking, type);

    res.json({ success: true, message: `Notification '${type}' sent` });
  } catch (err) {
    console.error('notifyBooking error:', err);
    res.status(500).json({ success: false, msg: err.message });
  }
};

// Send booking receipt email (by booking _id or bookingId)
export const sendReceiptEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body || {};

    const booking = await Booking.findOne({ $or: [{ _id: id }, { bookingId: id }] })
      .populate('property', 'name location address')
      .populate('package', 'name duration description');

    if (!booking) return res.status(404).json({ success: false, msg: 'Booking not found' });

    // If caller provided an email, ensure it matches booking.customerEmail for simple auth
    if (email && booking.customerEmail && email.toLowerCase().trim() !== booking.customerEmail.toLowerCase().trim()) {
      return res.status(403).json({ success: false, msg: 'Email does not match booking recipient' });
    }

    const recipient = booking.customerEmail;
    if (!recipient) return res.status(400).json({ success: false, msg: 'Booking has no customer email' });

    // Build receipt content (simple HTML)
    const receiptHtml = `
      <h2>Booking Receipt - ${booking.confirmationNumber || booking.bookingId}</h2>
      <p><strong>Property:</strong> ${booking.property?.name || 'N/A'}</p>
      <p><strong>Check-in:</strong> ${booking.checkInDate ? new Date(booking.checkInDate).toDateString() : (booking.checkIn || '')}</p>
      <p><strong>Check-out:</strong> ${booking.checkOutDate ? new Date(booking.checkOutDate).toDateString() : (booking.checkOut || '')}</p>
      <p><strong>Nights:</strong> ${booking.nights || 0}</p>
      <p><strong>Guests:</strong> ${booking.totalGuests || ''}</p>
      <p><strong>Total:</strong> ${booking.costs?.total || booking.amountPaid || 0}</p>
      <p>Thank you for booking with The Bush Collection.</p>
    `;

    // Prepare transporter using SMTP env vars
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@thebushcollection.africa';

    if (!smtpHost || !smtpPort) {
      console.error('SMTP not configured');
      return res.status(500).json({ success: false, msg: 'SMTP not configured on server' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    // Verify SMTP connection and log it
    try {
      await transporter.verify();
      console.log('SMTP transporter verified for manual receipt');
    } catch (verifyErr) {
      console.error('SMTP verify failed (manual receipt):', verifyErr);
      return res.status(500).json({ success: false, msg: 'SMTP verify failed' });
    }

    const mailOptions = {
      from: fromEmail,
      to: recipient,
      subject: `Your booking receipt - ${booking.confirmationNumber || booking.bookingId}`,
      html: receiptHtml,
      text: `Booking receipt for ${booking.confirmationNumber || booking.bookingId}`
    };

    // Log and enforce envelope from address
    const resolvedFromManual = mailOptions.from || fromEmail || process.env.SMTP_USER || 'no-reply@thebushcollection.africa';
    console.log('Sending manual receipt - from:', resolvedFromManual, 'to:', mailOptions.to);
    const sendOptsManual = { ...mailOptions, envelope: { from: resolvedFromManual, to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to] } };
    console.log('Manual mail send options (envelope will be used):', { envelope: sendOptsManual.envelope });

    const info = await transporter.sendMail(sendOptsManual);
    console.log('Receipt email sent:', info && info.messageId);
    if (info && info.response) console.log('SMTP response:', info.response);
    if (info && info.envelope) console.log('SMTP envelope:', info.envelope);
    if (info && info.accepted) console.log('SMTP accepted:', info.accepted);
    if (info && info.rejected) console.log('SMTP rejected:', info.rejected);

    return res.json({ success: true, message: 'Receipt emailed', info });
  } catch (err) {
    console.error('sendReceiptEmail error:', err);
    return res.status(500).json({ success: false, msg: err.message || 'Failed to send receipt' });
  }
};
