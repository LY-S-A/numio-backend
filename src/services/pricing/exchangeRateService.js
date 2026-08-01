// const ExchangeRate = require("../../models/ExchangeRate");

// /**
//  * Get the active USD -> NGN exchange rate.
//  */
// const getRate = async () => {
//     const exchangeRate = await ExchangeRate.findOne({
//         enabled: true,
//     }).sort({ updatedAt: -1 });

//     if (!exchangeRate) {
//         throw new Error(
//             "No active exchange rate configured."
//         );
//     }

//     return exchangeRate.rate;
// };

// /**
//  * Convert USD to NGN.
//  */
// const convertUsdToNgn = async (usdAmount) => {

//     const rate = await getRate();

//     return Math.ceil(Number(usdAmount) * rate);
// };

// module.exports = {
//     getRate,
//     convertUsdToNgn,
// };

const ExchangeRate = require("../../models/ExchangeRate");

let cachedRate = null;
let lastFetched = 0;

const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

const getRate = async () => {

    const now = Date.now();

    if (
        cachedRate &&
        now - lastFetched < CACHE_TIME
    ) {
        return cachedRate;
    }

    const exchangeRate = await ExchangeRate.findOne({
        enabled: true,
    }).sort({ updatedAt: -1 });

    if (!exchangeRate) {
        throw new Error(
            "No active exchange rate configured."
        );
    }

    cachedRate = exchangeRate.rate;
    lastFetched = now;

    return cachedRate;
};

const clearCache = () => {
    cachedRate = null;
    lastFetched = 0;
};

module.exports = {
    getRate,
    clearCache,
};
