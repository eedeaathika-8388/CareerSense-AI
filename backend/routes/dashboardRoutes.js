const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

function createDashboardRoutes(progressService, db) {
    const router = express.Router();

    // ================= GET /api/dashboard =================
    // Authenticated endpoint returning real aggregated user progress
    router.get("/", authMiddleware, async (req, res) => {
        try {
            const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(req.user.id);
            const data = await progressService.getDashboardData(req.user.id, user || req.user);
            res.json({
                success: true,
                ...data
            });
        } catch (error) {
            console.error("Dashboard route error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve dashboard data.",
                error: error.message
            });
        }
    });

    // ================= GET /api/dashboard/progress =================
    router.get("/progress", authMiddleware, async (req, res) => {
        try {
            const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(req.user.id);
            const data = await progressService.getDashboardData(req.user.id, user || req.user);
            res.json({
                success: true,
                progress: data.progress
            });
        } catch (error) {
            console.error("Dashboard progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve progress.",
                error: error.message
            });
        }
    });

    // ================= PUT /api/dashboard/progress =================
    router.put("/progress", authMiddleware, async (req, res) => {
        try {
            const { topic } = req.body;
            if (topic) {
                await progressService._recordTopicCompleted(req.user.id, topic);
            }
            const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(req.user.id);
            const data = await progressService.getDashboardData(req.user.id, user || req.user);
            res.json({
                success: true,
                message: "Dashboard progress updated.",
                progress: data.progress
            });
        } catch (error) {
            console.error("Update dashboard progress error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update dashboard progress.",
                error: error.message
            });
        }
    });

    // ================= BACKWARD COMPATIBILITY: GET /api/dashboard/:userId =================
    router.get("/:userId", async (req, res) => {
        try {
            const uid = req.params.userId;
            const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(uid);
            const data = await progressService.getDashboardData(uid, user || { id: uid, name: "User" });
            res.json({
                success: true,
                ...data
            });
        } catch (error) {
            console.error("Dashboard userId route error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve dashboard data.",
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createDashboardRoutes;
