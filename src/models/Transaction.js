const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "NGN",
    },

    provider: {
      type: String,
      enum: ["FLUTTERWAVE", "PAYSTACK", "SYSTEM"],
      required: true,
    },

    type: {
      type: String,
      enum: ["DEPOSIT", "WITHDRAWAL", "PURCHASE", "REFUND"],
      default: "DEPOSIT",
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },

    gatewayTransactionId: {
      type: String,
      default: null,
    },

    paymentMethod: {
      type: String,
      default: null,
    },

    description: {
      type: String,
      default: "Wallet Funding",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
