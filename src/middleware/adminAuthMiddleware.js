const jwt = require("jsonwebtoken");
const User = require("../models/User");

/*
========================================
PROTECT
========================================
Protects routes that require authentication.
Works for both users and admins.
*/
exports.protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token missing",
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.id).select(
            "-password"
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // Attach authenticated user to request
        req.user = user;

        next();

    } catch (error) {
        console.error("Protect middleware error:", error);

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token has expired",
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }

        return res.status(401).json({
            success: false,
            message: "Authentication failed",
        });
    }
};


/*
========================================
ADMIN ONLY
========================================
Must be used AFTER protect.
Only users with role "admin" can continue.
*/
exports.adminOnly = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access denied",
            });
        }

        next();

    } catch (error) {
        console.error("Admin middleware error:", error);

        return res.status(403).json({
            success: false,
            message: "Admin access denied",
        });
    }
};
