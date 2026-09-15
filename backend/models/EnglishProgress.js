const mongoose = require("mongoose");

const englishProgressSchema = new mongoose.Schema({
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
    grammarScore: {
        type: Number,
        default: 0
    },
    vocabularyScore: {
        type: Number,
        default: 0
    },
    fluencyScore: {
        type: Number,
        default: 0
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

module.exports = mongoose.models.EnglishProgress || mongoose.model("EnglishProgress", englishProgressSchema);
