const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    overallScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    streak: {
        type: Number,
        default: 1
    },
    recommendedFocus: {
        type: String,
        default: "Complete practice modules in English, Aptitude, and Interview to establish baseline readiness."
    },
    completedTopics: {
        type: [String],
        default: []
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.Progress || mongoose.model("Progress", progressSchema);
