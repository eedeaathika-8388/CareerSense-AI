const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Please log in."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const secret = process.env.JWT_SECRET || "careersense_ai_jwt_secret_key_2026_super_secure_vault";
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Session expired or invalid token. Please log in again."
        });
    }
}

module.exports = authMiddleware;
