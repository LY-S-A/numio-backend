const mongoose = require("mongoose");

const ExchangeRateSchema = new mongoose.Schema(
    {
        fromCurrency: {
            type: String,
            default: "USD",
            uppercase: true,
        },

        toCurrency: {
            type: String,
            default: "NGN",
            uppercase: true,
        },

        rate: {
            type: Number,
            required: true,
            min: 1,
        },

        enabled: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "ExchangeRate",
    ExchangeRateSchema
);
