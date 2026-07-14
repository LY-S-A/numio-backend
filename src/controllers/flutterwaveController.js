const axios = require("axios");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

// =============================
// Initialize Payment
// =============================
exports.initializePayment = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) < 1000) {
      return res.status(400).json({
        message: "Minimum deposit is ₦1,000",
      });
    }

    const tx_ref = `FLW_${Date.now()}_${req.user._id}`;

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount: Number(amount),
        currency: "NGN",
        redirect_url: `${BACKEND_URL}/api/flutterwave/verify`,
        customer: {
          email: req.user.email,
          name: req.user.username,
        },
        customizations: {
          title: "Wallet Funding",
          description: "Fund your wallet",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    await Transaction.create({
      user: req.user._id,
      reference: tx_ref,
      amount: Number(amount),
      currency: "NGN",
      provider: "FLUTTERWAVE",
      status: "PENDING",
    });

    return res.json({
      paymentUrl: response.data.data.link,
    });
  } catch (error) {
    console.error(
      "Flutterwave Initialize Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      message: "Payment initialization failed",
    });
  }
};

// =============================
// Verify Payment
// =============================
exports.verifyPayment = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.query;

    if (!transaction_id || !tx_ref) {
      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    const transaction = await Transaction.findOne({
      reference: tx_ref,
    });

    if (!transaction) {
      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    // Prevent duplicate credit
    if (transaction.status === "SUCCESS") {
      return res.redirect(`${FRONTEND_URL}/fund-success`);
    }

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
        },
      }
    );

    const payment = response.data.data;

    // Security checks
    if (
      payment.status !== "successful" ||
      payment.tx_ref !== tx_ref ||
      Number(payment.amount) !== Number(transaction.amount) ||
      payment.currency !== "NGN"
    ) {
      transaction.status = "FAILED";
      await transaction.save();

      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    const user = await User.findById(transaction.user);

    if (!user) {
      transaction.status = "FAILED";
      await transaction.save();

      return res.redirect(`${FRONTEND_URL}/fund-cancel`);
    }

    // Credit wallet
    user.wallet += transaction.amount;
    await user.save();

    // Update transaction
    transaction.status = "SUCCESS";
    transaction.gatewayTransactionId = payment.id;
    transaction.paymentMethod = payment.payment_type;

    await transaction.save();

    return res.redirect(`${FRONTEND_URL}/fund-success`);
  } catch (error) {
    console.error(
      "Flutterwave Verify Error:",
      error.response?.data || error.message
    );

    return res.redirect(`${FRONTEND_URL}/fund-cancel`);
  }
};
