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
const bcrypt = require("bcryptjs");

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

        // Find user
        const user = await User.findOne({
            email: email.toLowerCase().trim(),
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Check admin role
        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access denied",
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                id: user._id,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        // Return admin information
        res.status(200).json({
            success: true,
            message: "Admin login successful",

            token,

            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });

    } catch (error) {
        console.error(
            "Admin login error:",
            error
        );

        res.status(500).json({
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

            // Total successful revenue
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

        res.json({
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

        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard statistics",
        });
    }
};
