const mongoose = require("mongoose");
require("dotenv").config();

const ExchangeRate = require("../models/ExchangeRate");

const exchangeRates = [
    {
        baseCurrency: "USD",
        targetCurrency: "NGN",
        rate: 1400,
        provider: "SYSTEM",
        enabled: true,
    },
];

const seedExchangeRateIfEmpty = async () => {
    try {

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        console.log("🔥 Checking Exchange Rates...");

        const count = await ExchangeRate.countDocuments();

        if (count > 0) {
            console.log("⚡ Exchange rate already exists — skipping seed");
            return;
        }

        await ExchangeRate.insertMany(exchangeRates);

        console.log("✅ Exchange rate seeded successfully");

    } catch (err) {

        console.error("❌ Exchange Rate Seed Error:", err.message);

    }
};

module.exports = seedExchangeRateIfEmpty;
