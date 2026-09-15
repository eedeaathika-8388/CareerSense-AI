const mongoose = require("mongoose");

const interviewProgressSchema = new mongoose.Schema({
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
    averageCommunication: {
        type: Number,
        default: 0
    },
    averageTechnical: {
        type: Number,
        default: 0
    },
    lastRole: {
        type: String,
        default: "General"
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.InterviewProgress || mongoose.model("InterviewProgress", interviewProgressSchema);
