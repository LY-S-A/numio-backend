const User = require("../models/User");
const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");

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
