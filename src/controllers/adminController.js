// const User = require("../models/User");
// const Transaction = require("../models/Transaction");
// const NumberOrder = require("../models/NumberOrder");

// /*
// ========================================
// GET ADMIN DASHBOARD STATS
// ========================================
// */
// exports.getDashboardStats = async (req, res) => {
//     try {
//         const [
//             totalUsers,
//             totalOrders,
//             totalTransactions,
//             revenueResult,
//         ] = await Promise.all([
//             // Total registered users
//             User.countDocuments(),

//             // Total number orders
//             NumberOrder.countDocuments(),

//             // Total transactions
//             Transaction.countDocuments(),

//             // Total successful revenue
//             Transaction.aggregate([
//                 {
//                     $match: {
//                         status: "SUCCESS",
//                     },
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         total: {
//                             $sum: "$amount",
//                         },
//                     },
//                 },
//             ]),
//         ]);

//         const totalRevenue =
//             revenueResult.length > 0
//                 ? revenueResult[0].total
//                 : 0;

//         res.json({
//             success: true,
//             stats: {
//                 totalUsers,
//                 totalOrders,
//                 totalTransactions,
//                 totalRevenue,
//             },
//         });

//     } catch (error) {
//         console.error(
//             "Admin dashboard stats error:",
//             error
//         );

//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch dashboard statistics",
//         });
//     }
// };

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

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Get admin credentials from environment
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error(
                "ADMIN_EMAIL or ADMIN_PASSWORD is not configured"
            );

            return res.status(500).json({
                success: false,
                message: "Admin credentials are not configured",
            });
        }

        // Check admin credentials
        if (
            email.toLowerCase().trim() !==
                adminEmail.toLowerCase().trim() ||
            password !== adminPassword
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid admin email or password",
            });
        }

        // Create JWT
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

        // Return admin information
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

            // Total registered users
            User.countDocuments(),

            // Total number orders
            NumberOrder.countDocuments(),

            // Total transactions
            Transaction.countDocuments(),

            // Total successful purchase revenue
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
