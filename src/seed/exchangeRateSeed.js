// const mongoose = require("mongoose");
// require("dotenv").config();

// const ExchangeRate = require("../models/ExchangeRate");

// const exchangeRates = [
//     {
//         baseCurrency: "USD",
//         targetCurrency: "NGN",
//         rate: 1400,
//         provider: "SYSTEM",
//         enabled: true,
//     },
// ];

// // const seedExchangeRateIfEmpty = async () => {
// //     try {

// //         if (mongoose.connection.readyState === 0) {
// //             await mongoose.connect(process.env.MONGODB_URI);
// //         }

// //         console.log("🔥 Checking Exchange Rates...");

// //         const count = await ExchangeRate.countDocuments();

// //         if (count > 0) {
// //             console.log("⚡ Exchange rate already exists — skipping seed");
// //             return;
// //         }

// //         await ExchangeRate.insertMany(exchangeRates);

// //         console.log("✅ Exchange rate seeded successfully");

// //     } catch (err) {

// //         console.error("❌ Exchange Rate Seed Error:", err.message);

// //     }
// // };

// const seedExchangeRateIfEmpty = async () => {
//     try {

//         if (mongoose.connection.readyState === 0) {
//             await mongoose.connect(process.env.MONGODB_URI);
//         }

//         console.log("🔥 Checking Exchange Rates...");


//         const existingRate = await ExchangeRate.findOne({
//             baseCurrency: "USD",
//             targetCurrency: "NGN",
//         });


//         if (existingRate) {

//             existingRate.rate = 1500;

//             await existingRate.save();

//             console.log(
//                 "✅ Exchange rate updated to 1500"
//             );

//             return;
//         }


//         await ExchangeRate.create({
//             baseCurrency: "USD",
//             targetCurrency: "NGN",
//             rate: 1500,
//             provider: "SYSTEM",
//             enabled: true,
//         });


//         console.log(
//             "✅ Exchange rate seeded successfully"
//         );


//     } catch (err) {

//         console.error(
//             "❌ Exchange Rate Seed Error:",
//             err.message
//         );

//     }
// };

// module.exports = seedExchangeRateIfEmpty;

const mongoose = require("mongoose");
require("dotenv").config();

const ExchangeRate = require("../models/ExchangeRate");

const exchangeRate = {
    baseCurrency: "USD",
    targetCurrency: "NGN",
    rate: 1500,
    provider: "SYSTEM",
    enabled: true,
};

const seedExchangeRate = async () => {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        console.log("🔥 Checking Exchange Rates...");

        await ExchangeRate.findOneAndUpdate(
            {
                baseCurrency: exchangeRate.baseCurrency,
                targetCurrency: exchangeRate.targetCurrency,
            },
            exchangeRate,
            {
                new: true,
                upsert: true,
            }
        );

        // Remove any accidental duplicates
        const duplicates = await ExchangeRate.find({
            baseCurrency: exchangeRate.baseCurrency,
            targetCurrency: exchangeRate.targetCurrency,
        }).sort({ createdAt: -1 });

        if (duplicates.length > 1) {
            const idsToDelete = duplicates.slice(1).map(doc => doc._id);

            await ExchangeRate.deleteMany({
                _id: { $in: idsToDelete },
            });

            console.log(
                `🧹 Removed ${idsToDelete.length} duplicate exchange rate(s)`
            );
        }

        console.log("✅ Exchange rate is set to 1500");

    } catch (err) {
        console.error(
            "❌ Exchange Rate Seed Error:",
            err.message
        );
    }
};

module.exports = seedExchangeRate;
