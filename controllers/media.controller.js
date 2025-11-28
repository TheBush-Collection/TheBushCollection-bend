import Media from "../models/media.model.js";

/**
 * @desc Create a new media item
 * @route POST /media/admin/media
 * @access Admin
 */
export const createMedia = async (req, res) => {
  try {
    const { title, type, category, thumbnailUrl, description, featured } = req.body;
    const media = await Media.create({ title, type, category, thumbnailUrl, description, featured });
    res.status(201).json({ message: "Media created successfully", media });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Get all media items
 * @route GET /media/media-center
 * @access Public
 */
export const getMediaItems = async (req, res) => {
  try {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.featured) filters.featured = req.query.featured === "true";

    const items = await Media.find(filters).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Get single media item by ID
 * @route GET /media/:id
 * @access Public
 */
export const getMediaById = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ message: "Media not found" });
    res.status(200).json(media);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Update media item
 * @route PUT /media/admin/media/:id
 * @access Admin
 */
export const updateMedia = async (req, res) => {
  try {
    const updated = await Media.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Media not found" });
    res.status(200).json({ message: "Media updated successfully", media: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Delete media item
 * @route DELETE /media/admin/media/:id
 * @access Admin
 */
export const deleteMedia = async (req, res) => {
  try {
    const deleted = await Media.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Media not found" });
    res.status(200).json({ message: "Media deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Upload a media file (image/video) to server
 * @route POST /media/admin/upload
 * @access Admin
 */
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/media/${req.file.filename}`;
    res.status(201).json({ message: "File uploaded successfully", fileUrl, file: req.file });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
