const Media = require('../models/media.model.js');

// Create and Save a new Media
exports.create = async (req, res) => {
    try {
        const media = new Media(req.body);
        const savedMedia = await media.save();
        res.status(201).json(savedMedia);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Retrieve all Media
exports.findAll = async (req, res) => {
    try {
        const media = await Media.find();
        res.status(200).json(media);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Find a single Media by id
exports.findOne = async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);
        if (!media) {
            return res.status(404).json({ message: 'Media not found' });
        }
        res.status(200).json(media);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a Media by id
exports.update = async (req, res) => {
    try {
        const media = await Media.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!media) {
            return res.status(404).json({ message: 'Media not found' });
        }
        res.status(200).json(media);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a Media by id
exports.delete = async (req, res) => {
    try {
        const media = await Media.findByIdAndDelete(req.params.id);
        if (!media) {
            return res.status(404).json({ message: 'Media not found' });
        }
        res.status(200).json({ message: 'Media deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};