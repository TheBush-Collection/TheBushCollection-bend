// controllers/package.controller.js
import Package from "../models/package.model.js";

// Normalize category to match schema enum
const normalizeCategory = (val) => {
  if (!val) return 'Wildlife';
  const v = String(val).trim().toLowerCase();
  const categoryMap = {
    'wildlife': 'Wildlife',
    'photography': 'Photography',
    'luxury': 'Luxury',
    'family': 'Family',
    'adventure': 'Adventure',
  };
  return categoryMap[v] || val;
};

// Normalize difficulty to match schema enum
const normalizeDifficulty = (val) => {
  if (!val) return 'Easy';
  const v = String(val).trim().toLowerCase();
  const difficultyMap = {
    'easy': 'Easy',
    'moderate': 'Moderate',
    'challenging': 'Challenging',
  };
  return difficultyMap[v] || val;
};

/**
 * @desc Create new package
 * @route POST /api/packages
 * @access Admin
 */
export const createPackage = async (req, res) => {
  try {
    const {
      name,
      duration,
      location,
      accommodationProperty,
      shortDescription,
      fullDescription,
      category,
      difficulty,
      maxGuests,
      groupSize,
      mainImage,
      destinations,
      galleryImages,
      highlights,
      includes,
      excludes,
      bestTimeToVisit,
      price,
      originalPrice,
      rating,
      numberOfReviews,
      featured,
      itinerary, // Array of days: [{ dayNumber, title, description, activities, image }]
    } = req.body;

    // Validate required fields
    if (!name) return res.status(400).json({ message: "Package name is required" });
    if (!duration) return res.status(400).json({ message: "Package duration is required" });
    if (!location) return res.status(400).json({ message: "Package location is required" });
    if (!category) return res.status(400).json({ message: "Package category is required" });
    if (price === undefined || price === null) return res.status(400).json({ message: "Package price is required" });

    // Normalize and convert fields
    const normalizedCategory = normalizeCategory(category);
    const normalizedDifficulty = normalizeDifficulty(difficulty);
    const parsedMaxGuests = maxGuests ? Number(maxGuests) : undefined;
    const parsedGroupSize = groupSize && !isNaN(Number(groupSize)) ? Number(groupSize) : undefined;
    const parsedPrice = Number(price);

    const newPackage = await Package.create({
      name,
      duration,
      location,
      accommodationProperty: accommodationProperty || undefined,
      shortDescription: shortDescription || "",
      fullDescription: fullDescription || "",
      category: normalizedCategory,
      difficulty: normalizedDifficulty,
      maxGuests: parsedMaxGuests,
      groupSize: parsedGroupSize,
      mainImage: mainImage || undefined,
      destinations: Array.isArray(destinations) ? destinations : (destinations ? String(destinations).split(',').map(s => s.trim()) : []),
      galleryImages: Array.isArray(galleryImages) ? galleryImages : (galleryImages ? String(galleryImages).split(',').map(s => s.trim()) : []),
      highlights: Array.isArray(highlights) ? highlights : (highlights ? String(highlights).split(',').map(s => s.trim()) : []),
      includes: Array.isArray(includes) ? includes : (includes ? String(includes).split(',').map(s => s.trim()) : []),
      excludes: Array.isArray(excludes) ? excludes : (excludes ? String(excludes).split(',').map(s => s.trim()) : []),
      bestTimeToVisit: bestTimeToVisit || undefined,
      price: parsedPrice,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      rating: rating ? Number(rating) : 0,
      numberOfReviews: numberOfReviews ? Number(numberOfReviews) : 0,
      featured: !!featured,
      itinerary: Array.isArray(itinerary) ? itinerary : [],
    });

    res.status(201).json({
      message: "Package created successfully",
      package: newPackage,
    });
  } catch (error) {
    console.error('[createPackage] Error:', error);
    res.status(500).json({ message: error.message, details: error.errors || null });
  }
};

/**
 * @desc Get all packages with filtering, searching, and sorting
 * @route GET /api/packages
 * @access Public
 * @queryParams:
 *   - category: Filter by category (Wildlife, Photography, Luxury, Family, Adventure)
 *   - minPrice: Filter by minimum price
 *   - maxPrice: Filter by maximum price
 *   - duration: Filter by duration (e.g., "3" for 3 days)
 *   - featured: Filter by featured status (true/false)
 *   - search: Search in name, location, highlights, and destinations
 *   - sortBy: Sort by (featured, price-low, price-high, rating, duration)
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 12)
 */
export const getPackages = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      duration,
      featured,
      search,
      sortBy = 'featured',
      page = 1,
      limit = 12,
    } = req.query;

    // Build filter object
    const filters = {};

    // Category filter
    if (category && category !== 'all') {
      filters.category = category;
    }

    // Price range filters
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = parseFloat(minPrice);
      if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
    }

    // Duration filter (matches if duration starts with the provided value)
    if (duration && duration !== 'all') {
      filters.duration = new RegExp(`^${duration}`);
    }

    // Featured filter
    if (featured !== undefined && featured !== 'all') {
      filters.featured = featured === 'true';
    }

    // Search filter (searches in multiple fields)
    if (search) {
      filters.$or = [
        { name: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
        { highlights: new RegExp(search, 'i') },
        { destinations: new RegExp(search, 'i') },
        { shortDescription: new RegExp(search, 'i') },
      ];
    }

    // Build sort object
    let sortObj = {};
    switch (sortBy) {
      case 'featured':
        sortObj = { featured: -1, rating: -1, createdAt: -1 };
        break;
      case 'price-low':
        sortObj = { price: 1 };
        break;
      case 'price-high':
        sortObj = { price: -1 };
        break;
      case 'rating':
        sortObj = { rating: -1, numberOfReviews: -1 };
        break;
      case 'duration':
        sortObj = { duration: 1 };
        break;
      default:
        sortObj = { featured: -1, rating: -1, createdAt: -1 };
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const packages = await Package.find(filters)
      .populate('accommodationProperty', 'name location type images')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Package.countDocuments(filters);

    // Set frontend-compatible field names (image, reviews)
    const formattedPackages = packages.map(pkg => ({
      ...pkg.toObject(),
      image: pkg.mainImage || pkg.image,
      reviews: pkg.numberOfReviews || pkg.reviews,
      propertyId: pkg.accommodationProperty?._id || pkg.propertyId,
      id: pkg._id,
    }));

    res.status(200).json({
      success: true,
      packages: formattedPackages,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc Get single package by ID
 * @route GET /api/packages/:id
 * @access Public
 */
export const getPackageById = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('accommodationProperty', 'name location type images');
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    
    // Format response with frontend-compatible field names
    const formattedPackage = {
      ...pkg.toObject(),
      image: pkg.mainImage || pkg.image,
      reviews: pkg.numberOfReviews || pkg.reviews,
      propertyId: pkg.accommodationProperty?._id || pkg.propertyId,
      id: pkg._id,
    };
    
    res.status(200).json({ success: true, package: formattedPackage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update package
 * @route PUT /api/packages/:id
 * @access Admin
 */
export const updatePackage = async (req, res) => {
  try {
    const updated = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Package not found" });
    res.status(200).json({
      message: "Package updated successfully",
      package: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Delete package
 * @route DELETE /api/packages/:id
 * @access Admin
 */
export const deletePackage = async (req, res) => {
  try {
    const pkg = await Package.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.status(200).json({ message: "Package deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
