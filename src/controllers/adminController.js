const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");

const sendEmail = require("../utils/sendEmail");

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
        const now = new Date();

        // Start of current week - Monday
        const currentWeekStart = new Date(now);
        currentWeekStart.setHours(0, 0, 0, 0);

        const day = currentWeekStart.getDay();
        const diff = day === 0 ? 6 : day - 1;

        currentWeekStart.setDate(
            currentWeekStart.getDate() - diff
        );

        // Start of previous week
        const previousWeekStart = new Date(
            currentWeekStart
        );

        previousWeekStart.setDate(
            previousWeekStart.getDate() - 7
        );

        /*
        ========================================
        END OF CURRENT WEEK
        ========================================
        */

        const [
            totalUsers,
            totalOrders,
            totalTransactions,
            revenueResult,

            currentUsers,
            previousUsers,

            currentOrders,
            previousOrders,

            currentTransactions,
            previousTransactions,

            currentRevenueResult,
            previousRevenueResult,
        ] = await Promise.all([

            /*
            ================================
            TOTALS
            ================================
            */

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

            /*
            ================================
            USERS - CURRENT WEEK
            ================================
            */

            User.countDocuments({
                createdAt: {
                    $gte: currentWeekStart,
                },
            }),

            /*
            ================================
            USERS - PREVIOUS WEEK
            ================================
            */

            User.countDocuments({
                createdAt: {
                    $gte: previousWeekStart,
                    $lt: currentWeekStart,
                },
            }),

            /*
            ================================
            ORDERS - CURRENT WEEK
            ================================
            */

            NumberOrder.countDocuments({
                createdAt: {
                    $gte: currentWeekStart,
                },
            }),

            /*
            ================================
            ORDERS - PREVIOUS WEEK
            ================================
            */

            NumberOrder.countDocuments({
                createdAt: {
                    $gte: previousWeekStart,
                    $lt: currentWeekStart,
                },
            }),

            /*
            ================================
            TRANSACTIONS - CURRENT WEEK
            ================================
            */

            Transaction.countDocuments({
                createdAt: {
                    $gte: currentWeekStart,
                },
            }),

            /*
            ================================
            TRANSACTIONS - PREVIOUS WEEK
            ================================
            */

            Transaction.countDocuments({
                createdAt: {
                    $gte: previousWeekStart,
                    $lt: currentWeekStart,
                },
            }),

            /*
            ================================
            REVENUE - CURRENT WEEK
            ================================
            */

            Transaction.aggregate([
                {
                    $match: {
                        status: "SUCCESS",
                        type: "PURCHASE",
                        createdAt: {
                            $gte: currentWeekStart,
                        },
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

            /*
            ================================
            REVENUE - PREVIOUS WEEK
            ================================
            */

            Transaction.aggregate([
                {
                    $match: {
                        status: "SUCCESS",
                        type: "PURCHASE",
                        createdAt: {
                            $gte: previousWeekStart,
                            $lt: currentWeekStart,
                        },
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

        /*
        ========================================
        EXTRACT REVENUE
        ========================================
        */

        const totalRevenue =
            revenueResult.length > 0
                ? revenueResult[0].total
                : 0;

        const currentRevenue =
            currentRevenueResult.length > 0
                ? currentRevenueResult[0].total
                : 0;

        const previousRevenue =
            previousRevenueResult.length > 0
                ? previousRevenueResult[0].total
                : 0;

        /*
        ========================================
        CALCULATE PERCENTAGE
        ========================================
        */

        const calculatePercentage = (
            current,
            previous
        ) => {
            if (previous === 0) {
                if (current === 0) {
                    return 0;
                }

                return 100;
            }

            return Number(
                (
                    ((current - previous) /
                        previous) *
                    100
                ).toFixed(1)
            );
        };

        /*
        ========================================
        TRENDS
        ========================================
        */

        const usersTrend = calculatePercentage(
            currentUsers,
            previousUsers
        );

        const ordersTrend = calculatePercentage(
            currentOrders,
            previousOrders
        );

        const transactionsTrend =
            calculatePercentage(
                currentTransactions,
                previousTransactions
            );

        const revenueTrend =
            calculatePercentage(
                currentRevenue,
                previousRevenue
            );

        /*
        ========================================
        RESPONSE
        ========================================
        */

        return res.status(200).json({
            success: true,

            stats: {
                totalUsers,
                totalOrders,
                totalTransactions,
                totalRevenue,

                trends: {
                    users: usersTrend,
                    orders: ordersTrend,
                    transactions: transactionsTrend,
                    revenue: revenueTrend,
                },
            },
        });

    } catch (error) {
        console.error(
            "Admin dashboard stats error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch dashboard statistics",
        });
    }
};

/*
========================================
GET ADMIN USER STATS
========================================
*/

exports.getUserStats = async (req, res) => {
    try {

        const [
            totalUsers,
            fundedUsers,
            activeUsers,
            bannedUsers,
        ] = await Promise.all([

            User.countDocuments({
                role: "user",
            }),

            User.countDocuments({
                role: "user",
                wallet: {
                    $gt: 0,
                },
            }),

            User.countDocuments({
                role: "user",
                banned: {
                    $ne: true,
                },
            }),

            User.countDocuments({
                role: "user",
                banned: true,
            }),

        ]);

        return res.status(200).json({
            success: true,

            stats: {
                totalUsers,
                fundedUsers,
                activeUsers,
                bannedUsers,
            },
        });

    } catch (error) {

        console.error(
            "Get user stats error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch user statistics",
        });
    }
};

/*
========================================
GET ADMIN USERS
========================================
*/

exports.getUsers = async (req, res) => {
    try {
        const {
            search = "",
            status = "all",
            sort = "newest",
            page = 1,
            limit = 10,
        } = req.query;

        const pageNumber = Math.max(
            Number(page) || 1,
            1
        );

        const limitNumber = Math.max(
            Number(limit) || 10,
            1
        );

        const skip =
            (pageNumber - 1) *
            limitNumber;

        /*
        ========================================
        USER QUERY
        ========================================
        */

        const query = {
            role: "user",
        };

        /*
        SEARCH
        */

        if (search.trim()) {
            const searchRegex = new RegExp(
                search.trim(),
                "i"
            );

            query.$or = [
                {
                    username: searchRegex,
                },
                {
                    email: searchRegex,
                },
            ];
        }

        /*
        STATUS
        */

        if (status === "active") {
            query.banned = {
                $ne: true,
            };
        }

        if (status === "banned") {
            query.banned = true;
        }

        /*
        ========================================
        SORT
        ========================================
        */

        let sortOption = {
            createdAt: -1,
        };

        if (sort === "oldest") {
            sortOption = {
                createdAt: 1,
            };
        }

        if (sort === "highest") {
            sortOption = {
                wallet: -1,
            };
        }

        if (sort === "lowest") {
            sortOption = {
                wallet: 1,
            };
        }

        /*
        ========================================
        GET USERS + COUNT
        ========================================
        */

        const [
            users,
            totalUsers,
        ] = await Promise.all([

            User.find(
                query,
                {
                    username: 1,
                    email: 1,
                    wallet: 1,
                    verified: 1,
                    banned: 1,
                    createdAt: 1,
                }
            )
                .sort(sortOption)
                .skip(skip)
                .limit(limitNumber)
                .lean(),

            User.countDocuments(query),

        ]);

        /*
        ========================================
        GET TOTAL DEPOSITS
        ========================================
        */

        const userIds =
            users.map((user) => user._id);

        const deposits =
            await Transaction.aggregate([

                {
                    $match: {
                        user: {
                            $in: userIds,
                        },

                        type: "DEPOSIT",

                        status: "SUCCESS",
                    },
                },

                {
                    $group: {
                        _id: "$user",

                        totalDeposit: {
                            $sum: "$amount",
                        },
                    },
                },

            ]);

        /*
        ========================================
        MAP DEPOSITS
        ========================================
        */

        const depositMap = {};

        deposits.forEach((item) => {

            depositMap[
                item._id.toString()
            ] = item.totalDeposit;

        });

        /*
        ========================================
        FORMAT USERS
        ========================================
        */

        const formattedUsers =
            users.map((user) => ({

                id: user._id,

                username:
                    user.username,

                email:
                    user.email,

                balance:
                    Number(user.wallet || 0),

                totalDeposit:
                    Number(
                        depositMap[
                            user._id.toString()
                        ] || 0
                    ),

                banned:
                    user.banned === true,

                verified:
                    user.verified === true,

                joined:
                    user.createdAt,

            }));

        /*
        ========================================
        PAGINATION
        ========================================
        */

        const totalPages =
            Math.ceil(
                totalUsers /
                limitNumber
            );

        /*
        ========================================
        RESPONSE
        ========================================
        */

        return res.status(200).json({

            success: true,

            users: formattedUsers,

            pagination: {
                currentPage:
                    pageNumber,

                totalPages,

                totalUsers,

                limit:
                    limitNumber,
            },

        });

    } catch (error) {

        console.error(
            "Get admin users error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch users",

        });
    }
};


/*
========================================
TOGGLE USER BAN
========================================
*/

exports.toggleUserBan = async (req, res) => {
    try {

        const { userId } = req.params;

        const user =
            await User.findOne({
                _id: userId,
                role: "user",
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        user.banned =
            !user.banned;

        await user.save();

        return res.status(200).json({

            success: true,

            message:
                user.banned
                    ? "User banned successfully"
                    : "User unbanned successfully",

            user: {
                id: user._id,
                banned: user.banned,
            },

        });

    } catch (error) {

        console.error(
            "Toggle user ban error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to update user status",

        });
    }
};

/*
========================================
DELETE USER
========================================
*/

exports.deleteUser = async (req, res) => {
    try {

        const { userId } = req.params;

        const user =
            await User.findOneAndDelete({
                _id: userId,
                role: "user",
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({

            success: true,

            message:
                "User deleted successfully",

        });

    } catch (error) {

        console.error(
            "Delete user error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to delete user",

        });
    }
};

/*
========================================
GET USER COUNT
========================================
*/

exports.getUserCount = async (req, res) => {
    try {
        const userCount = await User.countDocuments({
            role: "user",
        });

        return res.status(200).json({
            success: true,
            count: userCount,
        });

    } catch (error) {
        console.error(
            "Get user count error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch user count",
        });
    }
};

/*
========================================
SEND EMAIL TO ALL USERS
========================================
*/

exports.sendMailToUsers = async (req, res) => {
    try {
        const {
            subject,
            message,
        } = req.body;

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Subject and message are required",
            });
        }

        const users = await User.find(
            {
                role: "user",
            },
            {
                email: 1,
            }
        ).lean();

        if (!users.length) {
            return res.status(404).json({
                success: false,
                message: "No users found",
            });
        }

        let sent = 0;
        let failed = 0;

        for (const user of users) {
            try {
                await sendEmail({
                    to: user.email,
                    subject,
                    html: `
                        <div style="
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 30px;
                        ">
                            ${message}
                        </div>
                    `,
                });

                sent++;

            } catch (error) {
                failed++;

                console.error(
                    `Failed to send email to ${user.email}:`,
                    error.message
                );
            }
        }

        return res.status(200).json({
            success: true,

            message:
                "Email campaign completed",

            totalUsers: users.length,

            sent,
            failed,
        });

    } catch (error) {
        console.error(
            "Send mail to users error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to send emails",
        });
    }
};

/*
========================================
GET ADMIN ORDER STATS
========================================
*/

exports.getOrderStats = async (req, res) => {
    try {

        const [
            totalOrders,
            completedOrders,
            activeOrders,
            cancelledOrders,
        ] = await Promise.all([

            /*
            ================================
            TOTAL
            ================================
            */

            NumberOrder.countDocuments(),

            /*
            ================================
            COMPLETED
            ================================
            */

            NumberOrder.countDocuments({
                status: "finished",
            }),

            /*
            ================================
            ACTIVE
            ================================
            */

            NumberOrder.countDocuments({
                status: "active",
            }),

            /*
            ================================
            CANCELLED
            ================================
            */

            NumberOrder.countDocuments({
                status: "cancelled",
            }),

        ]);


        /*
        ========================================
        COMPLETION RATE
        ========================================
        */

        const completionRate =
            totalOrders > 0
                ? Number(
                    (
                        (completedOrders /
                            totalOrders) *
                        100
                    ).toFixed(1)
                )
                : 0;


        /*
        ========================================
        ACTIVE RATE
        ========================================
        */

        const activeRate =
            totalOrders > 0
                ? Number(
                    (
                        (activeOrders /
                            totalOrders) *
                        100
                    ).toFixed(1)
                )
                : 0;


        /*
        ========================================
        CANCELLED RATE
        ========================================
        */

        const cancelledRate =
            totalOrders > 0
                ? Number(
                    (
                        (cancelledOrders /
                            totalOrders) *
                        100
                    ).toFixed(1)
                )
                : 0;


        return res.status(200).json({

            success: true,

            stats: {

                totalOrders,

                completedOrders,

                activeOrders,

                cancelledOrders,

                completionRate,

                activeRate,

                cancelledRate,

            },

        });

    } catch (error) {

        console.error(
            "Get admin order stats error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch order statistics",

        });

    }
};


/*
========================================
GET ADMIN ORDERS
========================================
*/

exports.getOrders = async (req, res) => {

    try {

        const {
            search = "",
            status = "all",
            service = "all",
            sort = "newest",
            page = 1,
            limit = 10,
        } = req.query;


        /*
        ========================================
        PAGINATION
        ========================================
        */

        const pageNumber =
            Math.max(
                Number(page) || 1,
                1
            );


        const limitNumber =
            Math.max(
                Number(limit) || 10,
                1
            );


        const skip =
            (pageNumber - 1) *
            limitNumber;


        /*
        ========================================
        BASE QUERY
        ========================================
        */

        const query = {};


        /*
        ========================================
        SEARCH
        ========================================
        */

        if (search.trim()) {

            const searchRegex =
                new RegExp(
                    search.trim(),
                    "i"
                );


            query.$or = [

                {
                    orderId:
                        searchRegex,
                },

                {
                    phone:
                        searchRegex,
                },

                {
                    service:
                        searchRegex,
                },

            ];

        }


        /*
        ========================================
        STATUS FILTER
        ========================================
        */

        if (
            status !== "all"
        ) {

            query.status =
                status;

        }


        /*
        ========================================
        SERVICE FILTER
        ========================================
        */

        if (
            service !== "all"
        ) {

            query.service =
                service;

        }


        /*
        ========================================
        SORT
        ========================================
        */

        let sortOption = {
            createdAt: -1,
        };


        if (
            sort === "oldest"
        ) {

            sortOption = {
                createdAt: 1,
            };

        }


        if (
            sort === "highest"
        ) {

            sortOption = {
                price: -1,
            };

        }


        if (
            sort === "lowest"
        ) {

            sortOption = {
                price: 1,
            };

        }


        /*
        ========================================
        GET ORDERS
        ========================================
        */

        const [
            orders,
            totalOrders,
        ] = await Promise.all([

            NumberOrder.find(
                query
            )
                .sort(sortOption)
                .skip(skip)
                .limit(limitNumber)
                .lean(),

            NumberOrder.countDocuments(
                query
            ),

        ]);


        /*
        ========================================
        FORMAT ORDERS
        ========================================
        */

        const formattedOrders =
            orders.map(
                (order) => ({

                    id:
                        order._id,

                    orderId:
                        order.orderId,

                    phone:
                        order.phone,

                    country:
                        order.country,

                    service:
                        order.service,

                    operator:
                        order.operator,

                    price:
                        Number(
                            order.price || 0
                        ),

                    status:
                        order.status,

                    expires:
                        order.expires,

                    sms:
                        order.sms || [],

                    createdAt:
                        order.createdAt,

                })
            );


        /*
        ========================================
        PAGINATION
        ========================================
        */

        const totalPages =
            Math.ceil(
                totalOrders /
                limitNumber
            );


        /*
        ========================================
        RESPONSE
        ========================================
        */

        return res.status(200).json({

            success: true,

            orders:
                formattedOrders,

            pagination: {

                currentPage:
                    pageNumber,

                totalPages,

                totalOrders,

                limit:
                    limitNumber,

            },

        });

    } catch (error) {

        console.error(
            "Get admin orders error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch orders",

        });

    }

};
