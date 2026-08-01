const { getPricingRule } = require("./pricingResolver");
const { selectOperator } = require("./operatorSelector");
const { getExchangeRate } = require("./exchangeRateService");
const calculateSellingPrice = require("../../helpers/calculateSellingPrice");

const pricingEngine = async ({
    country,
    service,
    operators,
}) => {

    /*
    ==========================
    STEP 1
    SELECT OPERATOR
    ==========================
    */

    const operatorResult = selectOperator(
        operators,

        {
            percentageThreshold: Number(
                process.env.PRICE_VARIANCE_THRESHOLD || 1
            ),

            absoluteThreshold: Number(
                process.env.MIN_PRICE_DIFFERENCE || 2
            ),
        }
    );

    /*
    ==========================
    STEP 2
    GET PRICING RULE
    ==========================
    */

    const pricingRule =
        await getPricingRule({

            country,

            service,

            usdPrice:
                operatorResult.selected.usdPrice,

        });

    /*
    ==========================
    STEP 3
    GET EXCHANGE RATE
    ==========================
    */

    const exchangeRate =
        await getExchangeRate();

    /*
    ==========================
    STEP 4
    CALCULATE PRICE
    ==========================
    */

    const calculation =
        calculateSellingPrice({

            usdPrice:
                operatorResult.selected.usdPrice,

            exchangeRate,

            strategy:
                pricingRule.strategy,

            value:
                pricingRule.value,

        });

    /*
    ==========================
    FINAL RESULT
    ==========================
    */

    return {

        operator:
            operatorResult.selected.operator,

        quantity:
            operatorResult.selected.quantity,

        usdPrice:
            operatorResult.selected.usdPrice,

        ngnPrice:
            calculation.sellingPrice,

        baseCost:
            calculation.baseCost,

        profit:
            calculation.profit,

        exchangeRate,

        pricingRule,

        calculation,

        operatorResult,

    };

};

module.exports = pricingEngine;

