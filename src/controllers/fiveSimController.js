const axios = require("axios");
const mongoose = require("mongoose");
const { v4: uuid } = require("uuid");

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");

const fiveSim = axios.create({
    baseURL: "https://5sim.net/v1",
    headers: {
        Authorization: `Bearer ${process.env.FIVESIM_API_KEY}`,
        Accept: "application/json",
    },
});

const generateReference = () =>
    `NUMIO-${Date.now()}-${uuid().slice(0, 8).toUpperCase()}`;

const convertPriceToNaira = (price) => {
    const rate = Number(process.env.USD_TO_NGN_RATE || 1500);
    return Number(price) * rate;
};

/*
=====================================================
BUY NUMBER
=====================================================
*/

exports.buyNumber = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const userId = req.user.id;
        const { service, country } = req.body;

        if (!service || !country) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "Service and country are required.",
            });
        }

        const user = await User.findById(userId).session(session);

        if (!user) {
            await session.abortTransaction();
            session.endSession();

            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        /*
        ===========================
        BUY FROM 5SIM
        ===========================
        */

        const response = await fiveSim.get(
            `/user/buy/activation/${country}/any/${service}`
        );

        const order = response.data;

        if (!order || !order.id) {
            throw new Error("Unable to purchase number.");
        }

        const amount = convertPriceToNaira(order.price);

        if (user.wallet < amount) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance.",
            });
        }

        /*
        ===========================
        DEDUCT WALLET
        ===========================
        */

        user.wallet -= amount;

        await user.save({ session });

        /*
        ===========================
        SAVE TRANSACTION
        ===========================
        */

        const transaction = await Transaction.create(
            [
                {
                    user: user._id,

                    reference: generateReference(),

                    amount,

                    currency: "NGN",

                    provider: "SYSTEM",

                    type: "PURCHASE",

                    status: "SUCCESS",

                    gatewayTransactionId: String(order.id),

                    paymentMethod: "Wallet",

                    description: `Purchased ${service} number (${country})`,
                },
            ],
            { session }
        );

        /*
        ===========================
        SAVE ORDER
        ===========================
        */

        const savedOrder = await NumberOrder.create(
            [
                {
                    user: user._id,

                    orderId: order.id,

                    phone: order.phone,

                    country,

                    service,

                    operator: order.operator,

                    price: amount,

                    expires: order.expires
                        ? new Date(order.expires)
                        : null,

                    status: "PENDING",

                    sms: [],
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,

            message: "Number purchased successfully.",

            wallet: user.wallet,

            order: savedOrder[0],

            transaction: transaction[0],
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error(error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.message ||
                error.message ||
                "Unable to purchase number.",
        });
    }
};

/*
=====================================================
REFRESH SMS
=====================================================
*/

exports.refreshSMS = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.params;

        const order = await NumberOrder.findOne({
            _id: orderId,
            user: userId,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }

        const response = await fiveSim.get(
            `/user/check/${order.orderId}`
        );

        const data = response.data;

        const smsList = Array.isArray(data.sms)
            ? data.sms.map((sms) => ({
                  code: sms.code || "",
                  text: sms.text || "",
                  sender: sms.sender || "",
                  createdAt: sms.created_at
                      ? new Date(sms.created_at)
                      : new Date(),
              }))
            : [];

        order.sms = smsList;

        if (smsList.length > 0) {
            order.status = "RECEIVED";
        }

        if (data.expires) {
            order.expires = new Date(data.expires);
        }

        await order.save();

        return res.status(200).json({
            success: true,
            sms: order.sms,
            order,
        });

    } catch (error) {

        console.error(error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.message ||
                "Unable to refresh SMS.",
        });
    }
};


/*
=====================================================
CANCEL ORDER
=====================================================
*/

exports.cancelOrder = async (req, res) => {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        const userId = req.user.id;
        const { orderId } = req.params;

        const order = await NumberOrder.findOne({
            _id: orderId,
            user: userId,
        }).session(session);

        if (!order) {

            await session.abortTransaction();
            session.endSession();

            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });

        }

        await fiveSim.get(
            `/user/cancel/${order.orderId}`
        );

        order.status = "CANCELLED";

        await order.save({ session });

        /*
        ===========================
        OPTIONAL REFUND
        ===========================

        Uncomment this block if your
        business logic refunds cancelled
        numbers.
        */

        /*
        const user = await User.findById(userId).session(session);

        user.wallet += order.price;

        await user.save({ session });

        await Transaction.create(
            [{
                user: user._id,
                reference: generateReference(),
                amount: order.price,
                currency: "NGN",
                provider: "SYSTEM",
                type: "REFUND",
                status: "SUCCESS",
                paymentMethod: "Wallet",
                description: `Refund for cancelled number`,
            }],
            { session }
        );
        */

        await session.commitTransaction();

        session.endSession();

        return res.json({
            success: true,
            message: "Order cancelled successfully.",
        });

    } catch (error) {

        await session.abortTransaction();

        session.endSession();

        console.error(error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.message ||
                "Unable to cancel order.",
        });

    }

};


/*
=====================================================
FINISH ORDER
=====================================================
*/

exports.finishOrder = async (req, res) => {

    try {

        const userId = req.user.id;
        const { orderId } = req.params;

        const order = await NumberOrder.findOne({
            _id: orderId,
            user: userId,
        });

        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });

        }

        await fiveSim.get(
            `/user/finish/${order.orderId}`
        );

        order.status = "FINISHED";

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order completed successfully.",
            order,
        });

    } catch (error) {

        console.error(error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.message ||
                "Unable to finish order.",
        });

    }

};

/*
=====================================================
GET ACTIVE ORDERS
=====================================================
*/

exports.getActiveOrders = async (req, res) => {
    try {

        const orders = await NumberOrder.find({
            user: req.user.id,
            status: {
                $in: ["PENDING", "RECEIVED"]
            }
        })
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            total: orders.length,
            orders
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};


/*
=====================================================
ORDER HISTORY
=====================================================
*/

exports.getOrderHistory = async (req, res) => {

    try {

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const skip = (page - 1) * limit;

        const total = await NumberOrder.countDocuments({
            user: req.user.id
        });

        const orders = await NumberOrder.find({
            user: req.user.id
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            success: true,
            page,
            totalPages: Math.ceil(total / limit),
            total,
            orders
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/*
=====================================================
GET SINGLE ORDER
=====================================================
*/

exports.getOrder = async (req, res) => {

    try {

        const order = await NumberOrder.findOne({
            _id: req.params.orderId,
            user: req.user.id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/*
=====================================================
DELETE ORDER
=====================================================
*/

exports.deleteOrder = async (req, res) => {

    try {

        const order = await NumberOrder.findOne({
            _id: req.params.orderId,
            user: req.user.id
        });

        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        if (
            order.status !== "FINISHED" &&
            order.status !== "CANCELLED" &&
            order.status !== "EXPIRED"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Cannot delete an active order."
            });

        }

        await order.deleteOne();

        res.json({
            success: true,
            message: "Order deleted."
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/*
=====================================================
5SIM PROFILE
=====================================================
*/

exports.getProfile = async (req, res) => {

    try {

        const response = await fiveSim.get(
            "/user/profile"
        );

        res.json({
            success: true,
            profile: response.data
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message:
                err.response?.data?.message ||
                err.message
        });

    }

};


/*
=====================================================
AUTO EXPIRE ORDERS
=====================================================
*/

exports.expireOrders = async () => {

    try {

        const now = new Date();

        await NumberOrder.updateMany(
            {
                status: {
                    $in: [
                        "PENDING",
                        "RECEIVED"
                    ]
                },
                expires: {
                    $lt: now
                }
            },
            {
                $set: {
                    status: "EXPIRED"
                }
            }
        );

    } catch (err) {

        console.log(
            "Expire Orders:",
            err.message
        );

    }

};


/*
=====================================================
SYNC ACTIVE ORDERS
=====================================================
*/

exports.syncOrders = async () => {

    try {

        const orders = await NumberOrder.find({
            status: {
                $in: [
                    "PENDING",
                    "RECEIVED"
                ]
            }
        });

        for (const order of orders) {

            try {

                const response =
                    await fiveSim.get(
                        `/user/check/${order.orderId}`
                    );

                const data = response.data;

                order.sms = data.sms || [];

                if (
                    data.sms &&
                    data.sms.length
                ) {
                    order.status =
                        "RECEIVED";
                }

                if (
                    data.status ===
                    "FINISHED"
                ) {
                    order.status =
                        "FINISHED";
                }

                if (
                    data.status ===
                    "CANCELLED"
                ) {
                    order.status =
                        "CANCELLED";
                }

                if (data.expires) {
                    order.expires =
                        new Date(
                            data.expires
                        );
                }

                await order.save();

            } catch (e) {

                console.log(
                    `Unable to sync ${order.orderId}`
                );

            }

        }

    } catch (err) {

        console.log(err.message);

    }

};
