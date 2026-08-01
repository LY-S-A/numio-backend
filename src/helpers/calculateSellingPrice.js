/**
 * Calculate the final selling price.
 *
 * @param {Object} options
 * @param {Number} options.usdPrice
 * @param {Number} options.exchangeRate
 * @param {String} options.strategy
 * @param {Number} options.value
 *
 * @returns {Object}
 */

const calculateSellingPrice = ({
    usdPrice,
    exchangeRate,
    strategy,
    value,
}) => {

    usdPrice = Number(usdPrice);
    exchangeRate = Number(exchangeRate);
    value = Number(value);

    if (
        Number.isNaN(usdPrice) ||
        Number.isNaN(exchangeRate)
    ) {
        throw new Error("Invalid price calculation.");
    }

    // Base Cost (without profit)
    const baseCost = Math.ceil(
        usdPrice * exchangeRate
    );

    let profit = 0;

    let sellingPrice = baseCost;

    switch (strategy) {

        case "FIXED":

            profit = value;

            sellingPrice =
                baseCost + profit;

            break;

        case "PERCENTAGE":

            profit = Math.ceil(
                (baseCost * value) / 100
            );

            sellingPrice =
                baseCost + profit;

            break;

        default:

            throw new Error(
                `Unknown pricing strategy: ${strategy}`
            );
    }

    return {

        usdPrice,

        exchangeRate,

        strategy,

        value,

        baseCost,

        profit,

        sellingPrice,
    };
};

module.exports =
calculateSellingPrice;
