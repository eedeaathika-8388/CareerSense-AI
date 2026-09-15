const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

function createEnglishRoutes(progressService) {
    const router = express.Router();

    // ================= GET /api/english/progress =================
    router.get("/progress", authMiddleware, async (req, res) => {
        try {
            const data = await progressService.getDashboardData(req.user.id, req.user);
            res.json({
                success: true,
                english: data.english
            });
        } catch (error) {
            console.error("GET english progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve English progress.",
                error: error.message
            });
        }
    });

    // ================= PUT /api/english/progress =================
    router.put("/progress", authMiddleware, async (req, res) => {
        try {
            const { activityName = "English Practice", scoreGain = 5 } = req.body;
            const updated = await progressService.updateEnglishProgress(req.user.id, {
                activityName,
                scoreGain: Number(scoreGain) || 5
            });

            res.json({
                success: true,
                message: "English progress updated successfully.",
                english: updated
            });
        } catch (error) {
            console.error("PUT english progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update English progress.",
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createEnglishRoutes;
