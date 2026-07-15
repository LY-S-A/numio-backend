const axios = require("axios");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

// ========================================
// Initialize Payment
// ========================================
exports.initializePayment = async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || Number(amount) < 1000) {
      return res.status(400).json({
        message: "Minimum funding amount is ₦1,000.",
      });
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: req.user.email,
        amount: Number(amount) * 100, // Convert to Kobo
        callback_url: `${BACKEND_URL}/api/paystack/verify`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const payment = response.data.data;

    await Transaction.create({
      user: req.user._id,
      reference: payment.reference,
      amount: Number(amount),
      currency: "NGN",
      provider: "PAYSTACK",
      status: "PENDING",
    });

    return res.json({
      paymentUrl: payment.authorization_url,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    return res.status(500).json({
      message: "Payment initialization failed.",
    });
  }
};

// ========================================
// Verify Payment
// ========================================
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    // Prevent duplicate wallet credit
    if (transaction.status === "SUCCESS") {
      return res.redirect(`${FRONTEND_URL}/fund-success`);
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const payment = response.data.data;

    // Payment failed
    if (payment.status !== "success") {
      transaction.status = "FAILED";
      await transaction.save();

      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    // Verify reference
    if (payment.reference !== transaction.reference) {
      transaction.status = "FAILED";
      await transaction.save();

      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    // Verify amount (Paystack returns Kobo)
    if (payment.amount !== transaction.amount * 100) {
      transaction.status = "FAILED";
      await transaction.save();

      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    // Credit wallet atomically
    await User.findByIdAndUpdate(
      transaction.user,
      {
        $inc: {
          walletBalanceNGN: transaction.amount,
        },
      },
      { new: true }
    );

    // Mark transaction successful
    transaction.status = "SUCCESS";
    await transaction.save();

    return res.redirect(`${FRONTEND_URL}/fund-success`);
  } catch (error) {
    console.error(error.response?.data || error.message);

    return res.redirect(`${FRONTEND_URL}/fund-cancel`);
  }
};
