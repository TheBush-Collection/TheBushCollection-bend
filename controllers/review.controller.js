import Review from "../models/review.model.js";
import Property from "../models/property.model.js";
import Package from "../models/package.model.js";
import Booking from "../models/booking.model.js";
import User from "../models/user.model.js";

// Create a new review
export const createReview = async (req, res) => {
  try {
    const {
      user_id, user_name, user_email,
      property_id, package_id, booking_id,
      rating, title, comment
    } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ msg: "Rating must be between 1 and 5" });
    }

    // Validate that either property_id or package_id is provided
    if (!property_id && !package_id) {
      return res.status(400).json({ msg: "Either property_id or package_id is required" });
    }

    const reviewData = {
      rating: Number(rating),
      title: title || "",
      comment: comment || "",
      is_approved: false,
      is_featured: false
    };

    // Add user information
    if (user_id) {
      reviewData.user = user_id;
    }
    reviewData.user_name = user_name || "Anonymous";
    if (user_email) {
      reviewData.user_email = user_email;
    }

    // Add property information
    if (property_id) {
      const property = await Property.findById(property_id);
      if (!property) {
        return res.status(404).json({ msg: "Property not found" });
      }
      reviewData.property = property_id;
      reviewData.property_name = property.name;
    }

    // Add package information
    if (package_id) {
      const pkg = await Package.findById(package_id);
      if (!pkg) {
        return res.status(404).json({ msg: "Package not found" });
      }
      reviewData.package = package_id;
      reviewData.package_name = pkg.name;
    }

    // Add booking reference if provided
    if (booking_id) {
      const booking = await Booking.findById(booking_id);
      if (!booking) {
        return res.status(404).json({ msg: "Booking not found" });
      }
      reviewData.booking = booking_id;
    }

    const review = await Review.create(reviewData);
    
    // Populate references
    const populatedReview = await review.populate([
      { path: 'user', select: 'fullName email' },
      { path: 'property', select: 'name' },
      { path: 'package', select: 'name' },
      { path: 'booking', select: 'bookingId' }
    ]);

    res.status(201).json(populatedReview);
  } catch (err) {
    console.error("Review creation error:", err);
    res.status(500).json({ msg: "Error creating review", error: err.message });
  }
};

// Get all reviews with filters
export const getReviews = async (req, res) => {
  try {
    const {
      property_id, package_id, is_approved, is_featured,
      rating, page = 1, limit = 20, sort = '-createdAt'
    } = req.query;

    const filter = {};

    if (property_id) filter.property = property_id;
    if (package_id) filter.package = package_id;
    if (is_approved !== undefined) filter.is_approved = is_approved === 'true';
    if (is_featured !== undefined) filter.is_featured = is_featured === 'true';
    if (rating) filter.rating = Number(rating);

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find(filter)
      .populate('user', 'fullName email')
      .populate('property', 'name')
      .populate('package', 'name')
      .populate('booking', 'bookingId customerName')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .exec();

    const total = await Review.countDocuments(filter);

    res.json({
      reviews,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    console.error("Get reviews error:", err);
    res.status(500).json({ msg: "Error fetching reviews", error: err.message });
  }
};

// Get a specific review by ID
export const getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'fullName email')
      .populate('property', 'name')
      .populate('package', 'name')
      .populate('booking', 'bookingId customerName');

    if (!review) {
      return res.status(404).json({ msg: "Review not found" });
    }

    res.json(review);
  } catch (err) {
    console.error("Get review error:", err);
    res.status(500).json({ msg: "Error fetching review", error: err.message });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    const {
      rating, title, comment, is_approved, is_featured, admin_notes
    } = req.body;

    const updateData = {};

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ msg: "Rating must be between 1 and 5" });
      }
      updateData.rating = Number(rating);
    }

    if (title !== undefined) updateData.title = title;
    if (comment !== undefined) updateData.comment = comment;
    if (is_approved !== undefined) updateData.is_approved = is_approved;
    if (is_featured !== undefined) updateData.is_featured = is_featured;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('user', 'fullName email')
      .populate('property', 'name')
      .populate('package', 'name')
      .populate('booking', 'bookingId customerName');

    if (!review) {
      return res.status(404).json({ msg: "Review not found" });
    }

    res.json(review);
  } catch (err) {
    console.error("Update review error:", err);
    res.status(500).json({ msg: "Error updating review", error: err.message });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({ msg: "Review not found" });
    }

    res.json({ msg: "Review deleted successfully" });
  } catch (err) {
    console.error("Delete review error:", err);
    res.status(500).json({ msg: "Error deleting review", error: err.message });
  }
};

// Get reviews for a specific property
export const getPropertyReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find({
      property: id,
      is_approved: true
    })
      .populate('user', 'fullName')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments({
      property: id,
      is_approved: true
    });

    // Calculate average rating
    const ratingData = await Review.aggregate([
      { $match: { property: mongoose.Types.ObjectId(id), is_approved: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const averageRating = ratingData.length > 0 ? ratingData[0].averageRating : 0;

    res.json({
      reviews,
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    console.error("Get property reviews error:", err);
    res.status(500).json({ msg: "Error fetching property reviews", error: err.message });
  }
};

// Get reviews for a specific package
export const getPackageReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find({
      package: id,
      is_approved: true
    })
      .populate('user', 'fullName')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments({
      package: id,
      is_approved: true
    });

    // Calculate average rating
    const ratingData = await Review.aggregate([
      { $match: { package: mongoose.Types.ObjectId(id), is_approved: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const averageRating = ratingData.length > 0 ? ratingData[0].averageRating : 0;

    res.json({
      reviews,
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    console.error("Get package reviews error:", err);
    res.status(500).json({ msg: "Error fetching package reviews", error: err.message });
  }
};

// Get review statistics for admin
export const getReviewStats = async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments();
    const approvedReviews = await Review.countDocuments({ is_approved: true });
    const pendingReviews = await Review.countDocuments({ is_approved: false });
    const featuredReviews = await Review.countDocuments({ is_featured: true });

    // Average rating across all reviews
    const ratingData = await Review.aggregate([
      { $match: { is_approved: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const averageRating = ratingData.length > 0 ? ratingData[0].averageRating : 0;

    // Rating distribution
    const distribution = await Review.aggregate([
      { $match: { is_approved: true } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalReviews,
      approvedReviews,
      pendingReviews,
      featuredReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      distribution
    });
  } catch (err) {
    console.error("Get review stats error:", err);
    res.status(500).json({ msg: "Error fetching review statistics", error: err.message });
  }
};

// Mark review as helpful
export const markHelpful = async (req, res) => {
  try {
    const { id } = req.params;
    const { helpful } = req.body;

    const updateData = helpful
      ? { $inc: { helpful_count: 1 } }
      : { $inc: { unhelpful_count: 1 } };

    const review = await Review.findByIdAndUpdate(id, updateData, { new: true });

    if (!review) {
      return res.status(404).json({ msg: "Review not found" });
    }

    res.json(review);
  } catch (err) {
    console.error("Mark helpful error:", err);
    res.status(500).json({ msg: "Error updating helpful count", error: err.message });
  }
};
