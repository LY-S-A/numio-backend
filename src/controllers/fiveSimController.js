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

exports.getActiveOrders = async (req, res) => {
    try {
        const userId = req.user.id;

        const order = await NumberOrder.findOne({
            user: userId,
            status: {
                $nin: ["FINISHED", "CANCELLED", "EXPIRED"],
            },
        }).sort({ createdAt: -1 });

        if (!order) {
            return res.status(200).json({
                success: true,
                order: null,
                sms: [],
            });
        }

        // Automatically sync latest data from 5SIM
        try {
            const response = await fiveSim.get(
                `/user/check/${order.orderId}`
            );

            const data = response.data;

            // Map SMS
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

            // Update SMS only if changed
            if (
                JSON.stringify(order.sms) !==
                JSON.stringify(smsList)
            ) {
                order.sms = smsList;
            }

            // Sync status
            if (smsList.length > 0) {
                order.status = "RECEIVED";
            } else if (data.status) {
                order.status = data.status.toUpperCase();
            }

            // Sync expiry
            if (data.expires) {
                order.expires = new Date(data.expires);
            }

            // If 5SIM reports finished/cancelled/timeout,
            // update local status as well.
            if (
                ["FINISHED", "CANCELLED", "TIMEOUT", "EXPIRED"].includes(
                    order.status
                )
            ) {
                order.status = order.status;
            }

            await order.save();
        } catch (err) {
            console.error(
                "5SIM sync failed:",
                err.response?.data || err.message
            );
            // Don't fail the request if 5SIM is temporarily unavailable.
            // Return the latest data stored in MongoDB.
        }

        return res.status(200).json({
            success: true,
            order,
            sms: order.sms || [],
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch active order.",
        });
    }
};

// exports.getActiveOrders = async (req, res) => {
//     try {
//         const userId = req.user.id;

//         const order = await NumberOrder.findOne({
//             user: userId,
//             status: {
//                 $nin: ["FINISHED", "CANCELLED", "EXPIRED"],
//             },
//         }).sort({ createdAt: -1 });

//         if (!order) {
//             return res.status(200).json({
//                 success: true,
//                 order: null,
//                 sms: [],
//             });
//         }

//         try {
//             const response = await fiveSim.get(
//                 `/user/check/${order.orderId}`
//             );

//             const data = response.data;

//             // ==========================
//             // MAP SMS
//             // ==========================
//             const smsList = Array.isArray(data.sms)
//                 ? data.sms.map((sms) => ({
//                       code: sms.code || "",
//                       text: sms.text || "",
//                       sender: sms.sender || "",
//                       createdAt: sms.created_at
//                           ? new Date(sms.created_at)
//                           : new Date(),
//                   }))
//                 : [];

//             // Update SMS only if changed
//             if (
//                 JSON.stringify(order.sms) !==
//                 JSON.stringify(smsList)
//             ) {
//                 order.sms = smsList;
//             }

//             // ==========================
//             // SMS RECEIVED
//             // ==========================
//             if (smsList.length > 0) {
//                 order.status = "RECEIVED";

//                 // Freeze expiry so background jobs
//                 // cannot later mark it EXPIRED.
//                 order.expires = null;
//             }

//             // ==========================
//             // NO SMS YET
//             // ==========================
//             else {

//                 if (data.status) {
//                     const status = data.status.toUpperCase();

//                     switch (status) {
//                         case "FINISHED":
//                             order.status = "FINISHED";
//                             break;

//                         case "CANCELLED":
//                             order.status = "CANCELLED";
//                             break;

//                         case "TIMEOUT":
//                         case "EXPIRED":
//                             order.status = "EXPIRED";
//                             break;

//                         default:
//                             order.status = "PENDING";
//                     }
//                 }

//                 if (data.expires) {
//                     order.expires = new Date(data.expires);
//                 }
//             }

//             await order.save();

//         } catch (err) {

//             console.error(
//                 "5SIM sync failed:",
//                 err.response?.data || err.message
//             );

//             // Continue returning MongoDB data
//         }

//         return res.status(200).json({
//             success: true,
//             order,
//             sms: order.sms || [],
//         });

//     } catch (error) {

//         console.error(error);

//         return res.status(500).json({
//             success: false,
//             message: "Unable to fetch active order.",
//         });
//     }
// };

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

// exports.expireOrders = async () => {
//     try {
//         const now = new Date();

//         await NumberOrder.updateMany(
//             {
//                 status: "PENDING",
//                 expires: { $lt: now }
//             },
//             {
//                 $set: {
//                     status: "EXPIRED"
//                 }
//             }
//         );

//     } catch (err) {
//         console.log("Expire Orders:", err.message);
//     }
// };

exports.expireOrders = async () => {
    try {
        const now = new Date();

        await NumberOrder.updateMany(
            {
                status: "PENDING",
                expires: {
                    $ne: null,
                    $lt: now,
                },
                sms: {
                    $size: 0,
                },
            },
            {
                $set: {
                    status: "EXPIRED",
                },
            }
        );

    } catch (err) {
        console.log("Expire Orders:", err.message);
    }
};

/*
=====================================================
SYNC ACTIVE ORDERS
=====================================================
*/

// exports.syncOrders = async () => {
//     try {

//         // Only sync orders still waiting for an SMS
//         const orders = await NumberOrder.find({
//             status: "PENDING"
//         });

//         for (const order of orders) {

//             try {

//                 const response = await fiveSim.get(
//                     `/user/check/${order.orderId}`
//                 );

//                 const data = response.data;

//                 const smsList = Array.isArray(data.sms)
//                     ? data.sms.map((sms) => ({
//                           code: sms.code || "",
//                           text: sms.text || "",
//                           sender: sms.sender || "",
//                           createdAt: sms.created_at
//                               ? new Date(sms.created_at)
//                               : new Date(),
//                       }))
//                     : [];

//                 /*
//                 ========================================
//                 SMS RECEIVED
//                 ========================================
//                 */

//                 if (smsList.length > 0) {

//                     order.sms = smsList;

//                     // Lock the order
//                     order.status = "RECEIVED";

//                     // Freeze expiry so it cannot expire/refund
//                     order.expires = new Date();

//                     await order.save();

//                     // Stop processing this order
//                     continue;
//                 }

//                 /*
//                 ========================================
//                 STILL WAITING FOR SMS
//                 ========================================
//                 */

//                 if (data.expires) {
//                     order.expires = new Date(data.expires);
//                 }

//                 if (data.status) {

//                     const status = data.status.toUpperCase();

//                     switch (status) {

//                         case "PENDING":
//                         case "RECEIVED":
//                             order.status = "PENDING";
//                             break;

//                         case "FINISHED":
//                             order.status = "FINISHED";
//                             break;

//                         case "CANCELLED":
//                             order.status = "CANCELLED";
//                             break;

//                         case "TIMEOUT":
//                         case "EXPIRED":
//                             order.status = "EXPIRED";
//                             break;

//                         default:
//                             break;
//                     }
//                 }

//                 await order.save();

//             } catch (err) {

//                 console.error(
//                     `Unable to sync order ${order.orderId}:`,
//                     err.response?.data || err.message
//                 );

//                 // Continue syncing remaining orders
//                 continue;
//             }
//         }

//     } catch (err) {

//         console.error(
//             "syncOrders:",
//             err.response?.data || err.message
//         );

//     }
// };

exports.syncOrders = async () => {
    try {

        // Only sync orders still waiting for an SMS
        const orders = await NumberOrder.find({
            status: "PENDING",
        });

        for (const order of orders) {

            try {

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

                /*
                ========================================
                SMS RECEIVED
                ========================================
                */

                if (smsList.length > 0) {

                    await NumberOrder.updateOne(
                        {
                            _id: order._id,
                            status: "PENDING",
                        },
                        {
                            $set: {
                                sms: smsList,
                                status: "RECEIVED",
                                expires: null,
                            },
                        }
                    );

                    // Skip remaining processing
                    continue;
                }

                /*
                ========================================
                STILL WAITING FOR SMS
                ========================================
                */

                const updates = {};

                if (data.expires) {
                    updates.expires = new Date(data.expires);
                }

                if (data.status) {

                    switch (data.status.toUpperCase()) {

                        case "PENDING":
                        case "RECEIVED":
                            updates.status = "PENDING";
                            break;

                        case "FINISHED":
                            updates.status = "FINISHED";
                            break;

                        case "CANCELLED":
                            updates.status = "CANCELLED";
                            break;

                        case "TIMEOUT":
                        case "EXPIRED":
                            updates.status = "EXPIRED";
                            break;

                        default:
                            break;
                    }
                }

                if (Object.keys(updates).length > 0) {

                    await NumberOrder.updateOne(
                        {
                            _id: order._id,
                            status: "PENDING",
                        },
                        {
                            $set: updates,
                        }
                    );
                }

            } catch (err) {

                // Ignore orders that no longer exist on 5SIM
                if (err.response?.status !== 404) {

                    console.error(
                        `Unable to sync order ${order.orderId}:`,
                        err.response?.data || err.message
                    );
                }

                continue;
            }
        }

    } catch (err) {

        console.error(
            "syncOrders:",
            err.response?.data || err.message
        );
    }
};
