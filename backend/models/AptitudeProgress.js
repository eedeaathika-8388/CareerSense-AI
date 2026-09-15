const mongoose = require("mongoose");

const aptitudeProgressSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    completedCount: {
        type: Number,
        default: 0
    },
    correctCount: {
        type: Number,
        default: 0
    },
    topicsMastered: {
        type: [String],
        default: []
    },
    lastActivity: {
        type: String,
        default: "None"
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.AptitudeProgress || mongoose.model("AptitudeProgress", aptitudeProgressSchema);
