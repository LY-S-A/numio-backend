// // const Transaction = require("../models/Transaction");
// // const NumberOrder = require("../models/NumberOrder");

// // exports.getLiveActivities = async (req, res) => {
// //     try {
// //         // Recent wallet transactions
// //         const transactions = await Transaction.find({
// //             status: "SUCCESS",
// //             type: { $in: ["DEPOSIT", "PURCHASE"] },
// //         })
// //             .populate("user", "email")
// //             .sort({ createdAt: -1 })
// //             .limit(20);

// //         // Recent SMS orders
// //         const orders = await NumberOrder.find({
// //             status: {
// //                 $in: ["RECEIVED", "COMPLETED", "FINISHED"],
// //             },
// //         })
// //             .populate("user", "email")
// //             .sort({ updatedAt: -1 })
// //             .limit(20);

// //         const walletActivities = transactions.map((tx) => ({
// //             type: "wallet",
// //             email: tx.user?.email || "Unknown",
// //             action:
// //                 tx.type === "DEPOSIT"
// //                     ? `funded wallet with ₦${Number(tx.amount).toLocaleString()}`
// //                     : `purchased a ${tx.description || "number"}`,
// //             status: tx.status,
// //             success: tx.status === "SUCCESS",
// //             createdAt: tx.createdAt,
// //         }));

// //         const smsActivities = orders.map((order) => ({
// //             type: "sms",
// //             email: order.user?.email || "Unknown",
// //             action: `received ${order.service} OTP`,
// //             status: "SUCCESS",
// //             success: true,
// //             createdAt: order.updatedAt || order.createdAt,
// //         }));

// //         const activities = [...walletActivities, ...smsActivities]
// //             .sort(
// //                 (a, b) =>
// //                     new Date(b.createdAt) -
// //                     new Date(a.createdAt)
// //             )
// //             .slice(0, 20);

// //         res.json(activities);
// //     } catch (err) {
// //         console.error("Live activity error:", err);

// //         res.status(500).json({
// //             message: "Failed to load live activities.",
// //         });
// //     }
// // };

// const Transaction = require("../models/Transaction");
// const NumberOrder = require("../models/NumberOrder");
// const User = require("../models/User");

// exports.getLiveActivities = async (req, res) => {
//     try {
//         // Latest successful deposits
//         const deposits = await Transaction.find({
//             type: "DEPOSIT",
//             status: "SUCCESS",
//         })
//             .populate("user", "email")
//             .sort({ createdAt: -1 })
//             .limit(10)
//             .lean();

//         // Latest purchased numbers
//         const purchases = await NumberOrder.find()
//             .populate("user", "email")
//             .sort({ createdAt: -1 })
//             .limit(10)
//             .lean();

//         const depositActivities = deposits.map((item) => ({
//             type: "wallet",
//             email: item.user?.email || "Unknown",
//             action: `funded wallet with ₦${item.amount.toLocaleString()}`,
//             status: "SUCCESS",
//             success: true,
//             createdAt: item.createdAt,
//         }));

//         const purchaseActivities = purchases.map((item) => ({
//             type: "purchase",
//             email: item.user?.email || "Unknown",
//             action: `purchased ${item.service} number (${item.country})`,
//             status: item.status,
//             success: true,
//             createdAt: item.createdAt,
//         }));

//         const activities = [...depositActivities, ...purchaseActivities]
//             .sort(
//                 (a, b) =>
//                     new Date(b.createdAt) - new Date(a.createdAt)
//             )
//             .slice(0, 20);

//         res.json(activities);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             message: "Failed to load live activities",
//         });
//     }
// };

const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");

exports.getLiveActivities = async (req, res) => {
    try {
        // Latest successful deposits
        const deposits = await Transaction.find({
            type: "DEPOSIT",
            status: "SUCCESS",
        })
            .populate("user", "email")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Latest finished purchases
        const purchases = await NumberOrder.find({
            status: "FINISHED",
        })
            .populate("user", "email")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const depositActivities = deposits.map((item) => ({
            type: "wallet",
            email: item.user?.email || "Unknown",
            action: `funded wallet with ₦${Number(item.amount).toLocaleString()}`,
            status: "SUCCESS",
            success: true,
            createdAt: item.createdAt,
        }));

        const purchaseActivities = purchases.map((item) => ({
            type: "purchase",
            email: item.user?.email || "Unknown",
            action: `purchased ${item.service} number (${item.country})`,
            status: "SUCCESS",
            success: true,
            createdAt: item.createdAt,
        }));

        // Merge and sort newest first
        const activities = [...depositActivities, ...purchaseActivities]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 20);

        res.status(200).json(activities);
    } catch (err) {
        console.error("Live activity error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load live activities.",
        });
    }
};
