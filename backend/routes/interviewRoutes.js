const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

function createInterviewRoutes(progressService) {
    const router = express.Router();

    // ================= GET /api/interview/progress =================
    router.get("/progress", authMiddleware, async (req, res) => {
        try {
            const data = await progressService.getDashboardData(req.user.id, req.user);
            res.json({
                success: true,
                interview: data.interview
            });
        } catch (error) {
            console.error("GET interview progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve Interview progress.",
                error: error.message
            });
        }
    });

    // ================= PUT /api/interview/progress =================
    router.put("/progress", authMiddleware, async (req, res) => {
        try {
            const { role = "Software Developer", scoreGain = 6 } = req.body;
            const updated = await progressService.updateInterviewProgress(req.user.id, {
                role,
                scoreGain: Number(scoreGain) || 6
            });

            res.json({
                success: true,
                message: "Interview progress updated successfully.",
                interview: updated
            });
        } catch (error) {
            console.error("PUT interview progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update Interview progress.",
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createInterviewRoutes;
