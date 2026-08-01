const PricingRule = require("../../models/PricingRule");
const ExchangeRate = require("../../models/ExchangeRate");

const loadPricingData = async () => {

    const [pricingRules, exchangeRate] = await Promise.all([

        PricingRule.find({
            enabled: true,
        }).lean(),

        ExchangeRate.findOne({
            enabled: true,
        }).lean(),

    ]);

    if (!exchangeRate) {
        throw new Error("No active exchange rate configured.");
    }

    return {

        pricingRules,

        exchangeRate: exchangeRate.rate,

    };

};

module.exports = loadPricingData;
