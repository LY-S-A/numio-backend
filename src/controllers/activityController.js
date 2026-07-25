const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");

exports.getLiveActivities = async (req, res) => {
    try {
        // Recent wallet transactions
        const transactions = await Transaction.find({
            status: "SUCCESS",
            type: { $in: ["DEPOSIT", "PURCHASE"] },
        })
            .populate("user", "email")
            .sort({ createdAt: -1 })
            .limit(20);

        // Recent SMS orders
        const orders = await NumberOrder.find({
            status: {
                $in: ["RECEIVED", "COMPLETED", "FINISHED"],
            },
        })
            .populate("user", "email")
            .sort({ updatedAt: -1 })
            .limit(20);

        const walletActivities = transactions.map((tx) => ({
            type: "wallet",
            email: tx.user?.email || "Unknown",
            action:
                tx.type === "DEPOSIT"
                    ? `funded wallet with ₦${Number(tx.amount).toLocaleString()}`
                    : `purchased a ${tx.description || "number"}`,
            status: tx.status,
            success: tx.status === "SUCCESS",
            createdAt: tx.createdAt,
        }));

        const smsActivities = orders.map((order) => ({
            type: "sms",
            email: order.user?.email || "Unknown",
            action: `received ${order.service} OTP`,
            status: "SUCCESS",
            success: true,
            createdAt: order.updatedAt || order.createdAt,
        }));

        const activities = [...walletActivities, ...smsActivities]
            .sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            )
            .slice(0, 20);

        res.json(activities);
    } catch (err) {
        console.error("Live activity error:", err);

        res.status(500).json({
            message: "Failed to load live activities.",
        });
    }
};
