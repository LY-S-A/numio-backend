const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");


/*
========================================
ADMIN LOGIN
========================================
*/
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error(
                "ADMIN_EMAIL or ADMIN_PASSWORD is missing"
            );

            return res.status(500).json({
                success: false,
                message: "Admin credentials are not configured",
            });
        }

        const normalizedEmail = email
            .toLowerCase()
            .trim();

        if (
            normalizedEmail !==
                adminEmail.toLowerCase().trim() ||
            password !== adminPassword
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid admin email or password",
            });
        }

        const token = jwt.sign(
            {
                email: adminEmail,
                role: "admin",
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Admin login successful",

            token,

            user: {
                email: adminEmail,
                role: "admin",
            },
        });

    } catch (error) {
        console.error(
            "Admin login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error during admin login",
        });
    }
};


/*
========================================
GET ADMIN DASHBOARD STATS
========================================
*/
exports.getDashboardStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalOrders,
            totalTransactions,
            revenueResult,
        ] = await Promise.all([
            User.countDocuments(),

            NumberOrder.countDocuments(),

            Transaction.countDocuments(),

            Transaction.aggregate([
                {
                    $match: {
                        status: "SUCCESS",
                        type: "PURCHASE",
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: "$amount",
                        },
                    },
                },
            ]),
        ]);

        const totalRevenue =
            revenueResult.length > 0
                ? revenueResult[0].total
                : 0;

        return res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                totalOrders,
                totalTransactions,
                totalRevenue,
            },
        });

    } catch (error) {
        console.error(
            "Admin dashboard stats error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard statistics",
        });
    }
};
