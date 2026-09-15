const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

function createAptitudeRoutes(progressService) {
    const router = express.Router();

    // ================= GET /api/aptitude/progress =================
    router.get("/progress", authMiddleware, async (req, res) => {
        try {
            const data = await progressService.getDashboardData(req.user.id, req.user);
            res.json({
                success: true,
                aptitude: data.aptitude
            });
        } catch (error) {
            console.error("GET aptitude progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve Aptitude progress.",
                error: error.message
            });
        }
    });

    // ================= PUT /api/aptitude/progress =================
    router.put("/progress", authMiddleware, async (req, res) => {
        try {
            const { topic = "Aptitude Practice", isCorrect = true, scoreGain = 5 } = req.body;
            const updated = await progressService.updateAptitudeProgress(req.user.id, {
                topic,
                isCorrect: !!isCorrect,
                scoreGain: Number(scoreGain) || 5
            });

            res.json({
                success: true,
                message: "Aptitude progress updated successfully.",
                aptitude: updated
            });
        } catch (error) {
            console.error("PUT aptitude progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update Aptitude progress.",
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createAptitudeRoutes;
