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
    const markup = Number(process.env.MARKUP_PERCENT || 100);

    const amount = Number(price) * rate;

    return Math.ceil(amount + (amount * markup) / 100);
};

const getDisplayPrice = (products) => {
    const prices = Object.values(products)
        .map((item) =>
            Number(
                item.Price ??
                item.price ??
                item.Retail ??
                item.retail ??
                0
            )
        )
        .filter((price) => price > 0);

    if (!prices.length) return 0;

    const min = Math.min(...prices);
    const max = Math.max(...prices);

    const minNgn = convertPriceToNaira(min);
    const maxNgn = convertPriceToNaira(max);

    // If price gap is greater than ₦1,000,
    // display the highest price instead.
    return maxNgn - minNgn > 1000 ? max : min;
};

exports.getServices = async (req, res) => {
    try {
        const { country } = req.query;

        if (!country) {
            return res.status(400).json({
                success: false,
                message: "Country is required.",
            });
        }

        // Fetch all prices for the selected country
        const response = await fiveSim.get(
            `/guest/prices?country=${country}`
        );

        const countryPrices =
            response.data[country] || response.data;

        if (!countryPrices) {
            return res.status(404).json({
                success: false,
                message: "No services found for this country.",
            });
        }

        const services = [];

        // Configurable thresholds
        const PRICE_VARIANCE_THRESHOLD = Number(
            process.env.PRICE_VARIANCE_THRESHOLD || 1 // 100%
        );

        const MIN_ABSOLUTE_DIFFERENCE = Number(
            process.env.MIN_PRICE_DIFFERENCE || 2 // $2
        );

        for (const [serviceName, operators] of Object.entries(countryPrices)) {

            const prices = [];
            let totalCount = 0;

            for (const [operator, info] of Object.entries(operators)) {

                const qty = Number(
                    info.count ??
                    info.Count ??
                    info.qty ??
                    0
                );

                if (qty <= 0) continue;

                const usd = Number(
                    info.cost ??
                    info.Cost ??
                    info.price ??
                    info.Price ??
                    0
                );

                if (!usd) continue;

                prices.push({
                    operator,
                    usd,
                    qty,
                });

                totalCount += qty;
            }

            if (!prices.length) continue;

            // Lowest -> Highest
            prices.sort((a, b) => a.usd - b.usd);

            const cheapest = prices[0];
            const highest = prices[prices.length - 1];

            // Percentage increase
            const percentageIncrease =
                (highest.usd - cheapest.usd) / cheapest.usd;

            // Absolute difference
            const absoluteDifference =
                highest.usd - cheapest.usd;

            // Show highest price only when BOTH conditions are met
            const display =
                percentageIncrease >= PRICE_VARIANCE_THRESHOLD &&
                absoluteDifference >= MIN_ABSOLUTE_DIFFERENCE
                    ? highest
                    : cheapest;

            services.push({
                name: serviceName,
                operator: display.operator,

                usdPrice: display.usd,
                ngnPrice: convertPriceToNaira(display.usd),

                count: totalCount,

                // Useful metadata
                lowestUsdPrice: cheapest.usd,
                highestUsdPrice: highest.usd,
                percentageIncrease: Number(
                    (percentageIncrease * 100).toFixed(2)
                ),
                absoluteDifference: Number(
                    absoluteDifference.toFixed(2)
                ),
            });
        }

        services.sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        return res.status(200).json({
            success: true,
            total: services.length,
            services,
        });

    } catch (error) {
        console.error(
            error.response?.data || error.message
        );

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.message ||
                error.message ||
                "Unable to fetch services.",
        });
    }
};

/*
=========================
GET COUNTRIES
=========================
*/

exports.getCountries = async (req, res) => {
    try {

        const response = await fiveSim.get(
            "/guest/countries"
        );


        const countries = Object.keys(response.data).map(
            (key) => ({
                name:
                    response.data[key].text ||
                    response.data[key].name ||
                    key,

                code: key
            })
        );


        return res.status(200).json({
            success: true,
            total: countries.length,
            countries
        });


    } catch (error) {

        console.error(
            error.response?.data || error.message
        );


        return res.status(500).json({
            success:false,
            message:
                error.response?.data?.message ||
                "Unable to fetch countries."
        });

    }
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
        BUY NUMBER FROM 5SIM
        ===========================
        */

        const response = await fiveSim.get(
            `/user/buy/activation/${country}/any/${service}`
        );

        const order = response.data;

        if (!order || !order.id) {
            throw new Error("Unable to purchase number.");
        }

        /*
        ===========================
        DETERMINE THE SAME PRICE
        SHOWN TO THE USER
        ===========================
        */

        const pricesRes = await fiveSim.get(
            `/guest/prices?country=${country}`
        );

        const countryPrices =
            pricesRes.data[country] || pricesRes.data;

        const operators = countryPrices?.[service];

        if (!operators) {
            throw new Error(
                "Unable to determine service price."
            );
        }

        const PRICE_VARIANCE_THRESHOLD = Number(
            process.env.PRICE_VARIANCE_THRESHOLD || 1
        );

        const MIN_ABSOLUTE_DIFFERENCE = Number(
            process.env.MIN_PRICE_DIFFERENCE || 2
        );

        const prices = [];

        for (const info of Object.values(operators)) {

            const qty = Number(
                info.count ??
                info.Count ??
                info.qty ??
                0
            );

            if (qty <= 0) continue;

            const usd = Number(
                info.cost ??
                info.Cost ??
                info.price ??
                info.Price ??
                0
            );

            if (!usd) continue;

            prices.push({
                usd,
                qty,
            });
        }

        if (!prices.length) {
            throw new Error(
                "Unable to determine service price."
            );
        }

        prices.sort((a, b) => a.usd - b.usd);

        const cheapest = prices[0];
        const highest = prices[prices.length - 1];

        const percentageIncrease =
            (highest.usd - cheapest.usd) /
            cheapest.usd;

        const absoluteDifference =
            highest.usd - cheapest.usd;

        const displayPrice =
            percentageIncrease >=
                PRICE_VARIANCE_THRESHOLD &&
            absoluteDifference >=
                MIN_ABSOLUTE_DIFFERENCE
                ? highest.usd
                : cheapest.usd;

        const amount =
            convertPriceToNaira(displayPrice);

        /*
        ===========================
        CHECK WALLET
        ===========================
        */

        if (user.wallet < amount) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message:
                    "Insufficient wallet balance.",
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

                    // User is charged exactly what was displayed
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

               /*
        ===========================
        COMMIT TRANSACTION
        ===========================
        */

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

        console.error(
            error.response?.data || error.message
        );

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

        /*
        ===========================
        VALIDATIONS
        ===========================
        */

        if (
            order.status === "CANCELLED" ||
            order.status === "FINISHED" ||
            order.status === "EXPIRED"
        ) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: `Order is already ${order.status.toLowerCase()}.`,
            });
        }

        // Don't refund if an SMS has already been received
        if (
            order.status === "RECEIVED" ||
            (order.sms && order.sms.length > 0)
        ) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message:
                    "This number has already received an SMS and cannot be cancelled.",
            });
        }

        /*
        ===========================
        CANCEL ON 5SIM
        ===========================
        */

        await fiveSim.get(
            `/user/cancel/${order.orderId}`
        );

        /*
        ===========================
        UPDATE ORDER
        ===========================
        */

        order.status = "CANCELLED";

        await order.save({ session });

        /*
        ===========================
        REFUND USER
        ===========================
        */

        const user = await User.findById(userId).session(session);

        if (!user) {
            throw new Error("User not found.");
        }

        user.wallet += order.price;

        await user.save({ session });

        /*
        ===========================
        SAVE REFUND TRANSACTION
        ===========================
        */

        const refundTransaction = await Transaction.create(
            [
                {
                    user: user._id,

                    reference: generateReference(),

                    amount: order.price,

                    currency: "NGN",

                    provider: "SYSTEM",

                    type: "REFUND",

                    status: "SUCCESS",

                    gatewayTransactionId: String(order.orderId),

                    paymentMethod: "Wallet",

                    description: `Refund for cancelled ${order.service} number`,
                },
            ],
            { session }
        );

        /*
        ===========================
        COMMIT
        ===========================
        */

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully and wallet refunded.",

            wallet: user.wallet,

            refund: refundTransaction[0],
        });

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        console.error(
            error.response?.data || error.message
        );

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.message ||
                error.message ||
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

// exports.getActiveOrders = async (req, res) => {
//     try {
//         const order = await NumberOrder.findOne({
//             user: req.user.id,
//             status: { $in: ["PENDING", "RECEIVED"] },
//         }).sort({ createdAt: -1 });

//         if (!order) {
//             return res.json({
//                 success: true,
//                 order: null,
//                 sms: [],
//             });
//         }

//         res.json({
//             success: true,
//             order,
//             sms: order.sms || [],
//         });

//     } catch (err) {
//         res.status(500).json({
//             success: false,
//             message: err.message,
//         });
//     }
// };

exports.getActiveOrders = async (req, res) => {
    try {
        const order = await NumberOrder.findOne({
            user: req.user.id,
            status: { $in: ["PENDING", "RECEIVED"] },
        }).sort({ createdAt: -1 });

        if (!order) {
            return res.json({
                success: true,
                wallet: undefined,
                order: null,
                sms: [],
            });
        }

        // Check if order has expired
        if (order.expires && new Date(order.expires) <= new Date()) {
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found.",
                });
            }

            // Refund only once
            if (!order.refunded) {
                user.wallet += order.price;

                await Transaction.create({
                    user: user._id,
                    reference: generateReference(),
                    amount: order.price,
                    currency: "NGN",
                    provider: "SYSTEM",
                    type: "REFUND",
                    status: "SUCCESS",
                    gatewayTransactionId: String(order.orderId),
                    paymentMethod: "Wallet",
                    description: `Refund for expired ${order.service} number (${order.country})`,
                });

                order.refunded = true;
            }

            order.status = "EXPIRED";

            await Promise.all([
                user.save(),
                order.save(),
            ]);

            return res.json({
                success: true,
                wallet: user.wallet,
                order: null,
                sms: [],
            });
        }

        return res.json({
            success: true,
            wallet: undefined,
            order,
            sms: order.sms || [],
        });

    } catch (err) {
        console.error("getActiveOrders:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to load active order.",
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


