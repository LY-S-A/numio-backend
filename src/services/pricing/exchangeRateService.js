const ExchangeRate = require("../../models/ExchangeRate");

/**
 * Get the active USD -> NGN exchange rate.
 */
const getRate = async () => {
    const exchangeRate = await ExchangeRate.findOne({
        enabled: true,
    }).sort({ updatedAt: -1 });

    if (!exchangeRate) {
        throw new Error(
            "No active exchange rate configured."
        );
    }

    return exchangeRate.rate;
};

/**
 * Convert USD to NGN.
 */
const convertUsdToNgn = async (usdAmount) => {

    const rate = await getRate();

    return Math.ceil(Number(usdAmount) * rate);
};

module.exports = {
    getRate,
    convertUsdToNgn,
};
