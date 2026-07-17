const mongoose = require("mongoose");

const numberOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderId: {
      type: Number,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
    },

    country: {
      type: String,
      required: true,
    },

    service: {
      type: String,
      required: true,
    },

    operator: {
      type: String,
      default: "any",
    },

    price: {
      type: Number,
      required: true,
    },

    expires: Date,

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
    },

    sms: [
      {
        code: String,
        text: String,
        sender: String,
        createdAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("NumberOrder", numberOrderSchema);
