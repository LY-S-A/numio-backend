const jwt = require("jsonwebtoken");

/*
========================================
PROTECT ADMIN ROUTES
========================================
*/
exports.protect = (req, res, next) => {
    try {
        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const token =
            authHeader.substring(7).trim();

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

        req.user = decoded;

        next();

    } catch (error) {
        console.error(
            "Admin authentication error:",
            error.message
        );

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};


/*
========================================
ADMIN ONLY
========================================
*/
exports.adminOnly = (req, res, next) => {
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

    const adminEmail =
        process.env.ADMIN_EMAIL
            ?.toLowerCase()
            .trim();

    const loggedInEmail =
        req.user.email
            ?.toLowerCase()
            .trim();

    if (
        !adminEmail ||
        loggedInEmail !== adminEmail
    ) {
        return res.status(403).json({
            success: false,
            message: "Admin access denied",
        });
    }

    next();
};
