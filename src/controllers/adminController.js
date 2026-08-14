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
GET ADMIN USER COUNT
========================================
*/

exports.getUserCount = async (req, res) => {
    try {
        const userCount =
            await User.countDocuments();

        return res.status(200).json({
            success: true,
            userCount,
        });

    } catch (error) {
        console.error(
            "Get user count error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch user count",
        });
    }
};

/*
========================================
SEND MAIL TO ALL USERS
========================================
*/

exports.sendMailToUsers = async (req, res) => {
    try {
        const {
            subject,
            message,
        } = req.body;

        /*
        ================================
        VALIDATE
        ================================
        */

        if (!subject?.trim()) {
            return res.status(400).json({
                success: false,
                message:
                    "Email subject is required",
            });
        }

        if (!message?.trim()) {
            return res.status(400).json({
                success: false,
                message:
                    "Email message is required",
            });
        }

        /*
        ================================
        GET ALL USERS
        ================================
        */

        const users = await User.find(
            {
                email: {
                    $exists: true,
                    $ne: "",
                },
            },
            {
                email: 1,
            }
        ).lean();

        /*
        ================================
        CHECK USERS
        ================================
        */

        if (!users.length) {
            return res.status(404).json({
                success: false,
                message:
                    "No registered users found",
            });
        }

        /*
        ================================
        GET VALID EMAILS
        ================================
        */

        const emails = [
            ...new Set(
                users
                    .map((user) =>
                        user.email
                            ?.trim()
                            .toLowerCase()
                    )
                    .filter(Boolean)
            ),
        ];

        if (!emails.length) {
            return res.status(404).json({
                success: false,
                message:
                    "No valid user email addresses found",
            });
        }

        /*
        ================================
        ESCAPE HTML
        ================================
        */

        const escapeHtml = (text) => {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const safeSubject =
            escapeHtml(subject.trim());

        const safeMessage =
            escapeHtml(message.trim());

        /*
        ================================
        EMAIL HTML
        ================================
        */

        const html = `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 650px;
                margin: 0 auto;
                padding: 30px;
                color: #111827;
                line-height: 1.7;
            ">

                <h2 style="
                    margin: 0 0 20px;
                    font-size: 24px;
                ">
                    ${safeSubject}
                </h2>

                <div style="
                    font-size: 15px;
                    white-space: pre-line;
                ">
                    ${safeMessage}
                </div>

                <div style="
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 13px;
                ">
                    <p>
                        This email was sent by
                        the Numio Administration.
                    </p>
                </div>

            </div>
        `;

        /*
        ================================
        SEND EMAILS
        ================================
        */

        let sent = 0;
        let failed = 0;

        for (const email of emails) {
            try {
                await sendEmail({
                    to: email,
                    subject: subject.trim(),
                    html,
                });

                sent++;

            } catch (error) {
                failed++;

                console.error(
                    `Failed to send email to ${email}:`,
                    error?.message || error
                );
            }
        }

        /*
        ================================
        RESPONSE
        ================================
        */

        return res.status(200).json({
            success: true,

            message:
                failed === 0
                    ? "Email sent successfully to all users."
                    : "Email sending completed with some failures.",

            totalRecipients:
                emails.length,

            sent,

            failed,
        });

    } catch (error) {
        console.error(
            "Send mail error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to send emails",
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
        } = req.query;

        /*
        ========================================
        BUILD QUERY
        ========================================
        */

        const query = {};

        /*
        SEARCH
        */

        if (search.trim()) {
            const searchRegex = new RegExp(
                search.trim(),
                "i"
            );

            query.$or = [
                { username: searchRegex },
                { email: searchRegex },
            ];
        }

        /*
        STATUS
        */

        if (status === "active") {
            query.banned = { $ne: true };
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
        GET USERS
        ========================================
        */

        const users = await User.find(
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
            .lean();

        /*
        ========================================
        RESPONSE
        ========================================
        */

        return res.status(200).json({
            success: true,
            users,
            count: users.length,
        });

    } catch (error) {
        console.error(
            "Get admin users error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
};
