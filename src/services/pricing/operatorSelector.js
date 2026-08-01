/**
 * Select the operator that should be used.
 *
 * operators = object returned by 5SIM
 */

const selectOperator = (
    operators,
    options = {}
) => {

    const {

        percentageThreshold = 1,

        absoluteThreshold = 2,

    } = options;

    const available = [];

    for (const [operator, info] of Object.entries(operators)) {

        const quantity = Number(

            info.count ??

            info.Count ??

            info.qty ??

            0

        );

        if (quantity <= 0) {

            continue;

        }

        const usdPrice = Number(

            info.cost ??

            info.Cost ??

            info.price ??

            info.Price ??

            0

        );

        if (!usdPrice) {

            continue;

        }

        available.push({

            operator,

            usdPrice,

            quantity,

        });

    }

    if (!available.length) {

        throw new Error(
            "No operators available."
        );

    }

    available.sort(
        (a, b) => a.usdPrice - b.usdPrice
    );

    const cheapest =
        available[0];

    const highest =
        available[
            available.length - 1
        ];

    const percentageIncrease =

        (highest.usdPrice -
            cheapest.usdPrice)

        /

        cheapest.usdPrice;

    const absoluteDifference =

        highest.usdPrice -
        cheapest.usdPrice;

    const selected =

        percentageIncrease >= percentageThreshold &&

        absoluteDifference >= absoluteThreshold

            ? highest

            : cheapest;

    return {

        selected,

        cheapest,

        highest,

        percentageIncrease,

        absoluteDifference,

        operators: available,

    };

};

module.exports = {
    selectOperator,
};
