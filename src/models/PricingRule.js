const mongoose = require("mongoose");

const PricingRuleSchema = new mongoose.Schema(
    {
        // RULE | THRESHOLD | DEFAULT
        type: {
            type: String,
            enum: ["RULE", "THRESHOLD", "DEFAULT"],
            default: "RULE",
            required: true,
        },

        // Example: france
        country: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
        },

        // Example: whatsapp
        service: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
        },

        // FIXED = Add fixed NGN profit
        // PERCENTAGE = Add % markup
        strategy: {
            type: String,
            enum: ["FIXED", "PERCENTAGE"],
            required: true,
        },

        // Profit value
        // FIXED -> ₦200
        // PERCENTAGE -> 20
        value: {
            type: Number,
            required: true,
            min: 0,
        },

        // Used only by THRESHOLD rules
        // Example:
        // If USD >= 4
        minUsdPrice: {
            type: Number,
            default: null,
        },

        // Rule priority
        // Higher wins
        priority: {
            type: Number,
            default: 1,
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
    "PricingRule",
    PricingRuleSchema
);
