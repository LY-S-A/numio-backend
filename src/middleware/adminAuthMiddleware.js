const jwt = require("jsonwebtoken");
const User = require("../models/User");

/*
========================================
ADMIN AUTHENTICATION
========================================
*/
exports.adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Check authorization header
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        // Get token
        const token = authHeader.split(" ")[1];

        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Find user
        const user = await User.findById(decoded.id).select(
            "-password"
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // Check admin role
        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access denied",
            });
        }

        // Attach user to request
        req.user = user;

        next();

    } catch (error) {
        console.error("Admin authentication error:", error);

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Admin session has expired",
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Authentication failed",
        });
    }
};
