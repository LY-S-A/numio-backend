const mongoose = require("mongoose");
require("dotenv").config();

const PricingRule = require("../models/PricingRule");

const pricingRules = [
    {
        type: "DEFAULT",
        strategy: "PERCENTAGE",
        value: 20,
        priority: 1,
        enabled: true,
    },
];

const seedPricingRulesIfEmpty = async () => {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        console.log("🔥 Checking Pricing Rules...");

        const count = await PricingRule.countDocuments();

        if (count > 0) {
            console.log("⚡ Pricing rules already exist — skipping seed");
            return;
        }

        await PricingRule.insertMany(pricingRules);

        console.log("✅ Pricing rules seeded successfully");

    } catch (err) {

        console.error("❌ Pricing Rule Seed Error:", err.message);

    }
};

module.exports = seedPricingRulesIfEmpty;
