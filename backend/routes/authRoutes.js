const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const authMiddleware = require("../middleware/authMiddleware");

function createAuthRoutes(db) {
    const router = express.Router();
    const JWT_SECRET = process.env.JWT_SECRET || "careersense_ai_jwt_secret_key_2026_super_secure_vault";

    function generateToken(user, rememberMe = false) {
        return jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: rememberMe ? "30d" : "24h" }
        );
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // ================= SIGN UP =================
    router.post("/signup", (req, res) => {
        try {
            const { name, email, password, confirmPassword } = req.body;

            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Full name is required."
                });
            }

            if (!email || !isValidEmail(email.trim())) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address."
                });
            }

            if (!password || password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Password must be at least 6 characters long."
                });
            }

            if (confirmPassword !== undefined && password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Passwords do not match."
                });
            }

            const normalizedEmail = email.trim().toLowerCase();

            const existingUser = db
                .prepare("SELECT id FROM users WHERE LOWER(email) = ?")
                .get(normalizedEmail);

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email already exists. Please log in."
                });
            }

            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(password, salt);

            const stmt = db.prepare(`
                INSERT INTO users (name, email, password)
                VALUES (?, ?, ?)
            `);
            const result = stmt.run(name.trim(), normalizedEmail, hashedPassword);

            const newUser = {
                id: Number(result.lastInsertRowid),
                name: name.trim(),
                email: normalizedEmail
            };

            const token = generateToken(newUser, false);

            res.status(201).json({
                success: true,
                message: "Account created successfully! Welcome to CareerSense AI.",
                token,
                user: newUser
            });
        } catch (error) {
            console.error("Signup error:", error);
            res.status(500).json({
                success: false,
                message: "Registration failed due to a server error. Please try again.",
                error: error.message
            });
        }
    });

    // ================= LOGIN =================
    router.post("/login", (req, res) => {
        try {
            const { email, password, rememberMe } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required."
                });
            }

            const normalizedEmail = email.trim().toLowerCase();

            const user = db
                .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
                .get(normalizedEmail);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password. Please try again."
                });
            }

            const isMatch = bcrypt.compareSync(password, user.password);

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password. Please try again."
                });
            }

            const safeUser = {
                id: user.id,
                name: user.name,
                email: user.email,
                created_at: user.created_at
            };

            const token = generateToken(safeUser, !!rememberMe);

            res.json({
                success: true,
                message: `Welcome back, ${user.name}!`,
                token,
                user: safeUser
            });
        } catch (error) {
            console.error("Login error:", error);
            res.status(500).json({
                success: false,
                message: "Login failed due to a server error. Please try again.",
                error: error.message
            });
        }
    });

    // ================= GET CURRENT USER =================
    router.get("/me", authMiddleware, (req, res) => {
        try {
            const user = db
                .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
                .get(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User account not found."
                });
            }

            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error("Fetch me error:", error);
            res.status(500).json({
                success: false,
                message: "Could not retrieve user profile.",
                error: error.message
            });
        }
    });

    // ================= FORGOT PASSWORD =================
    router.post("/forgot-password", (req, res) => {
        try {
            const { email } = req.body;

            if (!email || !isValidEmail(email.trim())) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid email address."
                });
            }

            const normalizedEmail = email.trim().toLowerCase();
            const user = db
                .prepare("SELECT id, email, name FROM users WHERE LOWER(email) = ?")
                .get(normalizedEmail);

            if (!user) {
                // Return success for security/privacy so emails aren't easily harvested
                return res.json({
                    success: true,
                    message: "If an account exists for this email, password reset instructions have been generated."
                });
            }

            const resetToken = crypto.randomBytes(24).toString("hex");
            const resetExpires = Date.now() + 3600000; // 1 hour validity

            db.prepare(`
                UPDATE users
                SET reset_token = ?, reset_token_expires = ?
                WHERE id = ?
            `).run(resetToken, resetExpires, user.id);

            res.json({
                success: true,
                message: "Password reset instructions generated successfully.",
                resetToken,
                note: "In a production environment, this link is emailed. You can reset your password immediately using this token."
            });
        } catch (error) {
            console.error("Forgot password error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to process forgot password request.",
                error: error.message
            });
        }
    });

    // ================= RESET PASSWORD =================
    router.post("/reset-password", (req, res) => {
        try {
            const { token, newPassword, confirmPassword } = req.body;

            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: "Reset token is required."
                });
            }

            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be at least 6 characters long."
                });
            }

            if (confirmPassword !== undefined && newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Passwords do not match."
                });
            }

            const user = db
                .prepare("SELECT id, reset_token_expires FROM users WHERE reset_token = ?")
                .get(token);

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired reset token. Please request a new one."
                });
            }

            if (user.reset_token_expires && user.reset_token_expires < Date.now()) {
                return res.status(400).json({
                    success: false,
                    message: "Reset token has expired. Please request a new one."
                });
            }

            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(newPassword, salt);

            db.prepare(`
                UPDATE users
                SET password = ?, reset_token = NULL, reset_token_expires = NULL
                WHERE id = ?
            `).run(hashedPassword, user.id);

            res.json({
                success: true,
                message: "Password updated successfully! You can now log in with your new password."
            });
        } catch (error) {
            console.error("Reset password error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to reset password.",
                error: error.message
            });
        }
    });

    // ================= GOOGLE AUTH (UI / DEMO SUPPORT) =================
    router.post("/google", (req, res) => {
        try {
            const { email, name } = req.body;
            const targetEmail = (email || "google.user@careersense.ai").trim().toLowerCase();
            const targetName = name || "Google User";

            let user = db
                .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
                .get(targetEmail);

            if (!user) {
                const randomPassword = crypto.randomBytes(16).toString("hex");
                const hashedPassword = bcrypt.hashSync(randomPassword, 10);
                const stmt = db.prepare(`
                    INSERT INTO users (name, email, password)
                    VALUES (?, ?, ?)
                `);
                const result = stmt.run(targetName, targetEmail, hashedPassword);
                user = {
                    id: Number(result.lastInsertRowid),
                    name: targetName,
                    email: targetEmail
                };
            }

            const safeUser = {
                id: user.id,
                name: user.name,
                email: user.email,
                created_at: user.created_at
            };

            const token = generateToken(safeUser, true);

            res.json({
                success: true,
                message: `Logged in with Google as ${user.name}!`,
                token,
                user: safeUser
            });
        } catch (error) {
            console.error("Google auth error:", error);
            res.status(500).json({
                success: false,
                message: "Google login failed.",
                error: error.message
            });
        }
    });

    // ================= LOGOUT =================
    router.post("/logout", (req, res) => {
        res.json({
            success: true,
            message: "User logged out successfully."
        });
    });

    return router;
}

module.exports = createAuthRoutes;
