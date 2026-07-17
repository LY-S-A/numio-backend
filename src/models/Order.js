const mongoose = require("mongoose");

const smsSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: null,
    },

    text: {
      type: String,
      default: null,
    },

    sender: {
      type: String,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const fiveSimOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
    },

    service: {
      type: String,
      required: true,
      index: true,
    },

    country: {
      type: String,
      required: true,
      index: true,
    },

    operator: {
      type: String,
      default: "any",
    },

    providerPrice: {
      type: Number,
      required: true,
    },

    sellingPrice: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "USD",
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "RECEIVED",
        "FINISHED",
        "CANCELLED",
        "EXPIRED",
      ],
      default: "PENDING",
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    sms: [smsSchema],

    rawResponse: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "FiveSimOrder",
  fiveSimOrderSchema
);
