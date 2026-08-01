const mongoose = require("mongoose");
require("dotenv").config();

const PricingRule = require("../models/PricingRule");

const pricingRules = [

    /*
    ==========================
    DEFAULT FALLBACK
    ==========================
    */

    // {
    //     type: "DEFAULT",
    //     strategy: "PERCENTAGE",
    //     value: 20,
    //     priority: 1,
    //     enabled: true,
    // },

    {
    type: "DEFAULT",
    strategy: "FIXED",
    value: 600,
    priority: 1,
    enabled: true,
},


    /*
    ==========================
    SERVICE FIXED PROFIT
    ==========================
    */


    {
        type: "RULE",

        service: "whatsapp",

        strategy: "FIXED",

        value: 800,

        priority: 50,

        enabled: true,
    },


    {
        type: "RULE",

        service: "telegram",

        strategy: "FIXED",

        value: 500,

        priority: 50,

        enabled: true,
    },


    /*
    ==========================
    HIGH PRICE SERVICES
    USD >= $4
    ==========================
    */


    {
        type: "THRESHOLD",

        strategy: "PERCENTAGE",

        value: 25,

        minUsdPrice: 4,

        priority: 20,

        enabled: true,
    },


    /*
    ==========================
    COUNTRY OVERRIDE
    FRANCE WHATSAPP
    ==========================
    */


    {
        type: "RULE",

        country: "france",

        service: "whatsapp",

        strategy: "PERCENTAGE",

        value: 25,

        priority: 100,

        enabled: true,
    }

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
