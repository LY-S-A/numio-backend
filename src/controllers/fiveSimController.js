const axios = require("axios");
const mongoose = require("mongoose");
const { v4: uuid } = require("uuid");

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");
const exchangeRateService = require(
    "../services/pricing/exchangeRateService"
);
const pricingEngine = require("../services/pricing/pricingEngine");

const fiveSim = axios.create({
    baseURL: "https://5sim.net/v1",
    headers: {
        Authorization: `Bearer ${process.env.FIVESIM_API_KEY}`,
        Accept: "application/json",
    },
});

const generateReference = () =>
    `NUMIO-${Date.now()}-${uuid().slice(0, 8).toUpperCase()}`;

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

/*
=====================================================
GET SERVICES
=====================================================
*/

exports.getServices = async (req, res) => {

    console.time("getServices");

    try {

        const { country } = req.query;

        if (!country) {

            console.timeEnd("getServices");

            return res.status(400).json({
                success: false,
                message: "Country is required.",
            });

        }

        console.time("5SIM Request");

        const response = await fiveSim.get(
            `/guest/prices?country=${country}`
        );

        console.timeEnd("5SIM Request");

        const countryPrices =
            response.data[country] ||
            response.data;

        if (!countryPrices) {

            console.timeEnd("getServices");

            return res.status(404).json({
                success: false,
                message: "No services found.",
            });

        }

        console.log(
            "Total services from 5SIM:",
            Object.keys(countryPrices).length
        );

        console.time("Pricing Engine");

        const services = await Promise.all(

            Object.entries(countryPrices).map(

                async ([serviceName, operators]) => {

                    try {

                        // Skip services with no operators
                        if (
                            !operators ||
                            Object.keys(operators).length === 0
                        ) {
                            return null;
                        }

                        // Calculate total stock first
                        const totalStock = Object.values(operators)
                            .reduce(
                                (total, item) =>
                                    total +
                                    Number(
                                        item.count ??
                                        item.Count ??
                                        item.qty ??
                                        0
                                    ),
                                0
                            );

                        // Skip if there is no stock
                        if (totalStock <= 0) {
                            return null;
                        }

                        const pricing =
                            await pricingEngine({

                                country,

                                service: serviceName,

                                operators,

                            });

                        return {

                            name: serviceName,

                            operator: pricing.operator,

                            usdPrice: pricing.usdPrice,

                            ngnPrice: pricing.ngnPrice,

                            count: totalStock,

                        };

                    }

                    catch (err) {

                        console.log(
                            `${serviceName}: ${err.message}`
                        );

                        return null;

                    }

                }

            )

        );

        console.timeEnd("Pricing Engine");

        const validServices = services
            .filter(Boolean)
            .sort((a, b) =>
                a.name.localeCompare(b.name)
            );

        console.timeEnd("getServices");

        return res.json({

            success: true,

            total: validServices.length,

            services: validServices,

        });

    }

    catch (err) {

        console.timeEnd("getServices");

        console.error(
            err.response?.data || err.message
        );

        return res.status(500).json({

            success: false,

            message:
                err.response?.data?.message ||
                err.message ||
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
            success: false,
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
            throw new Error("Service and country are required.");
        }

        /*
        =====================================
        GET USER
        =====================================
        */

        const user = await User.findById(userId).session(session);

        if (!user) {
            throw new Error("User not found.");
        }

        /*
        =====================================
        FETCH LATEST PRICES
        =====================================
        */

        const pricesResponse = await fiveSim.get(
            `/guest/prices?country=${country}`
        );

        const countryPrices =
            pricesResponse.data[country] ||
            pricesResponse.data;

        if (!countryPrices) {
            throw new Error("Country is unavailable.");
        }

        const operators =
            countryPrices[service];

        if (!operators) {
            throw new Error("Service is unavailable.");
        }

        /*
        =====================================
        RUN PRICING ENGINE
        =====================================
        */

        const pricing = await pricingEngine({
            country,
            service,
            operators,
        });

        /*
        =====================================
        CHECK WALLET
        =====================================
        */

        if (user.wallet < pricing.ngnPrice) {
            throw new Error("Insufficient wallet balance.");
        }

        /*
        =====================================
        BUY EXACT OPERATOR
        =====================================
        */

        const response = await fiveSim.get(
            `/user/buy/activation/${country}/${pricing.operator}/${service}`
        );

        const order = response.data;

        if (!order || !order.id) {
            throw new Error("Unable to purchase number.");
        }

        /*
        =====================================
        DEDUCT WALLET
        =====================================
        */

        user.wallet -= pricing.ngnPrice;

        await user.save({ session });

        /*
        =====================================
        SAVE TRANSACTION
        =====================================
        */

        const [transaction] = await Transaction.create(
            [
                {
                    user: user._id,

                    reference: generateReference(),

                    amount: pricing.ngnPrice,

                    currency: "NGN",

                    provider: "SYSTEM",

                    type: "PURCHASE",

                    status: "SUCCESS",

                    gatewayTransactionId: String(order.id),

                    paymentMethod: "Wallet",

                    description:
                        `Purchased ${service} number (${country})`,
                },
            ],
            { session }
        );

        /*
        =====================================
        SAVE ORDER
        =====================================
        */

        const [savedOrder] = await NumberOrder.create(
            [
                {
                    user: user._id,

                    orderId: order.id,

                    phone: order.phone,

                    country,

                    service,

                    operator: pricing.operator,

                    price: pricing.ngnPrice,

                    usdPrice: pricing.usdPrice,

                    exchangeRate: pricing.exchangeRate,

                    pricingRule: pricing.pricingRule._id,

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
        =====================================
        COMMIT
        =====================================
        */

        await session.commitTransaction();

        session.endSession();

        return res.status(200).json({
            success: true,

            message:
                "Number purchased successfully.",

            wallet: user.wallet,

            order: savedOrder,

            transaction,
        });

    } catch (error) {

        await session.abortTransaction();

        session.endSession();

        console.error(
            error.response?.data ||
            error.message
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
UPDATE ORDER
===========================
*/

        order.status = "CANCELLED";
        order.refunded = true;

        // Optional cleanup
        order.sms = [];
        order.expires = null;

        await order.save({ session });

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

        const user = await User.findById(userId);

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
                wallet: user?.wallet ?? 0,
            });
        }

        return res.status(200).json({
            success: true,
            order,
            sms: order.sms || [],
            wallet: user?.wallet ?? 0,
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch active order.",
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


exports.getInbox = async (req, res) => {
    try {
        const orders = await NumberOrder.find({
            user: req.user.id,
            status: "FINISHED",
            sms: { $exists: true, $ne: [] }
        })
            .sort({ updatedAt: -1 })
            .lean();

        const messages = [];

        orders.forEach(order => {
            order.sms.forEach(sms => {
                messages.push({
                    id: `${order._id}-${sms.id || Date.now()}`,
                    number: order.phone,
                    app: order.service,
                    country: order.country,
                    code: sms.code || "",
                    message: sms.text || sms.message || "",
                    time: sms.created_at || order.updatedAt,
                    status: "Read"
                });
            });
        });

        res.json({
            success: true,
            messages
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
                status: "PENDING",
                expires: { $lt: now }
            },
            {
                $set: {
                    status: "EXPIRED"
                }
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

                const response = await fiveSim.get(
                    `/user/check/${order.orderId}`
                );


                const data = response.data;


                console.log(
                    "5SIM SYNC:",
                    order.orderId,
                    data.status
                );


                const smsList = Array.isArray(data.sms)
                    ? data.sms.map((sms) => ({
                        code: sms.code || "",
                        text: sms.text || "",
                        sender: sms.sender || "",
                        createdAt: sms.created_at
                            ? new Date(sms.created_at)
                            : new Date()
                    }))
                    : [];

                /*
========================================
UPDATE SMS
========================================
*/

                if (smsList.length > 0) {
                    order.sms = smsList;
                }

                /*
                ========================================
                UPDATE EXPIRY TIME
                ========================================
                */

                order.expires = data.expires
                    ? new Date(data.expires)
                    : null;

                if (!data.status) {

                    await order.save();

                    continue;

                }

                const status = String(data.status).toUpperCase();

                console.log(
                    "5SIM SYNC:",
                    order.orderId,
                    status,
                    `SMS: ${smsList.length}`
                );

                switch (status) {


                    /*
                    ========================================
                    WAITING FOR SMS
                    ========================================
                    */


                    case "PENDING":

                    case "WAITING":

                        if (order.status !== "RECEIVED") {
                            order.status = "PENDING";
                        }

                        await order.save();

                        break;

                    /*
                       ========================================
                       SMS RECEIVED
                       ========================================
                       */

                    case "RECEIVED":

                        // Only mark as received if 5SIM actually returned an SMS
                        if (smsList.length > 0) {
                            order.status = "RECEIVED";
                            await order.save();
                        }

                        break;


                    /*
                    ========================================
                    CANCELLED FROM 5SIM
                    ========================================
                    */

                    case "CANCEL":

                    case "CANCELED":

                    case "CANCELLED": {


                        if (order.refunded) {


                            order.status = "CANCELLED";

                            await order.save();


                            continue;

                        }



                        const session = await mongoose.startSession();



                        try {


                            session.startTransaction();



                            const user = await User.findById(order.user)
                                .session(session);



                            if (!user) {

                                throw new Error(
                                    "User not found"
                                );

                            }



                            // Refund wallet

                            user.wallet += order.price;



                            await user.save({
                                session
                            });





                            await Transaction.create(
                                [
                                    {
                                        user: user._id,

                                        reference: generateReference(),

                                        amount: order.price,

                                        currency: "NGN",

                                        provider: "SYSTEM",

                                        type: "REFUND",

                                        status: "SUCCESS",

                                        gatewayTransactionId:
                                            String(order.orderId),

                                        paymentMethod:
                                            "Wallet",

                                        description:
                                            `Refund for cancelled ${order.service} number`
                                    }
                                ],
                                {
                                    session
                                }
                            );





                            await NumberOrder.updateOne(
                                {
                                    _id: order._id
                                },
                                {
                                    $set: {
                                        status: "CANCELLED",

                                        refunded: true,

                                        phone: null,

                                        sms: [],

                                        expires: null
                                    }
                                },
                                {
                                    session
                                }
                            );



                            await session.commitTransaction();



                        } catch (err) {


                            await session.abortTransaction();



                            console.error(
                                `Cancel refund failed ${order.orderId}:`,
                                err.message
                            );


                        } finally {


                            session.endSession();


                        }



                        break;

                    }





                    /*
                    ========================================
                    FINISHED
                    ========================================
                    */

                    case "FINISHED":

                        order.status = "FINISHED";
                        order.expires = null;

                        await order.save();

                        break;


                    /*
                    ========================================
                    EXPIRED / TIMEOUT
                    ========================================
                    */

                    case "TIMEOUT":

                    case "EXPIRED": {


                        if (order.refunded) {


                            order.status = "EXPIRED";


                            await order.save();


                            continue;

                        }




                        const session = await mongoose.startSession();



                        try {


                            session.startTransaction();



                            const user =
                                await User.findById(order.user)
                                    .session(session);



                            if (!user) {

                                throw new Error(
                                    "User not found"
                                );

                            }



                            user.wallet += order.price;



                            await user.save({
                                session
                            });





                            await Transaction.create(
                                [
                                    {

                                        user: user._id,

                                        reference: generateReference(),

                                        amount: order.price,

                                        currency: "NGN",

                                        provider: "SYSTEM",

                                        type: "REFUND",

                                        status: "SUCCESS",

                                        gatewayTransactionId:
                                            String(order.orderId),

                                        paymentMethod: "Wallet",

                                        description:
                                            `Refund for expired ${order.service} number`
                                    }
                                ],
                                {
                                    session
                                }
                            );





                            await NumberOrder.updateOne(
                                {
                                    _id: order._id
                                },
                                {
                                    $set: {
                                        status: "EXPIRED",

                                        refunded: true,

                                        phone: null,

                                        sms: [],

                                        expires: null
                                    }
                                },
                                {
                                    session
                                }
                            );




                            await session.commitTransaction();



                        } catch (err) {


                            await session.abortTransaction();



                            console.error(
                                `Expire refund failed ${order.orderId}:`,
                                err.message
                            );


                        } finally {


                            session.endSession();


                        }



                        break;

                    }





                    default:

                        console.log(
                            "Unknown 5SIM status:",
                            status
                        );

                        break;


                }



            } catch (err) {


                console.error(
                    `Unable to sync order ${order.orderId}:`,
                    err.response?.data || err.message
                );


            }

        }



    } catch (err) {


        console.error(
            "syncOrders:",
            err.response?.data || err.message
        );


    }

};
