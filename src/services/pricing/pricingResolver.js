// const PricingRule = require("../../models/PricingRule");

// /**
//  * Finds the pricing rule to use.
//  */
// const getPricingRule = async ({
//     country,
//     service,
//     usdPrice,
// }) => {

//     country = country?.toLowerCase().trim();
//     service = service?.toLowerCase().trim();

//     /*
//     ===================================
//     Priority 1
//     Country + Service
//     ===================================
//     */

//     let rule = await PricingRule.findOne({

//         enabled: true,

//         type: "RULE",

//         country,

//         service,

//     }).sort({ priority: -1 });

//     if (rule) return rule;

//     /*
//     ===================================
//     Priority 2
//     Service
//     ===================================
//     */

//     rule = await PricingRule.findOne({

//         enabled: true,

//         type: "RULE",

//         country: null,

//         service,

//     }).sort({ priority: -1 });

//     if (rule) return rule;

//     /*
//     ===================================
//     Priority 3
//     Threshold
//     ===================================
//     */

//     rule = await PricingRule.findOne({

//         enabled: true,

//         type: "THRESHOLD",

//         minUsdPrice: {
//             $lte: usdPrice,
//         },

//     }).sort({

//         minUsdPrice: -1,

//         priority: -1,

//     });

//     if (rule) return rule;

//     /*
//     ===================================
//     Priority 4
//     Default
//     ===================================
//     */

//     rule = await PricingRule.findOne({

//         enabled: true,

//         type: "DEFAULT",

//     }).sort({

//         priority: -1,

//     });

//     if (!rule) {

//         throw new Error(
//             "No default pricing rule configured."
//         );

//     }

//     return rule;

// };

// module.exports = {
//     getPricingRule,
// };

const PricingRule = require("../../models/PricingRule");

/**
 * Finds the pricing rule to use.
 */
const getPricingRule = async ({
    country,
    service,
    usdPrice,
}) => {

    country = country?.toLowerCase().trim();
    service = service?.toLowerCase().trim();
    usdPrice = Number(usdPrice);

    /*
    ==========================
    1. THRESHOLD RULE
    ==========================

    If the USD price meets the threshold,
    use the threshold rule first.

    Example:

    minUsdPrice: 4
    strategy: PERCENTAGE
    value: 25

    Any price >= $4 will use this rule.
    */

    const thresholdRule = await PricingRule.findOne({
        enabled: true,
        type: "THRESHOLD",
        minUsdPrice: {
            $lte: usdPrice,
        },
    }).sort({
        minUsdPrice: -1,
        priority: -1,
    });

    if (thresholdRule) {
        return thresholdRule;
    }


    /*
    ==========================
    2. COUNTRY + SERVICE RULE
    ==========================

    Only use this when no threshold
    applies.
    */

    let rule = await PricingRule.findOne({
        enabled: true,
        type: "RULE",
        country,
        service,
    }).sort({
        priority: -1,
    });

    if (rule) {
        return rule;
    }


    /*
    ==========================
    3. SERVICE-ONLY RULE
    ==========================

    Example:

    country: null
    service: whatsapp
    strategy: FIXED
    value: 800
    */

    rule = await PricingRule.findOne({
        enabled: true,
        type: "RULE",
        country: null,
        service,
    }).sort({
        priority: -1,
    });

    if (rule) {
        return rule;
    }


    /*
    ==========================
    4. DEFAULT RULE
    ==========================
    */

    rule = await PricingRule.findOne({
        enabled: true,
        type: "DEFAULT",
    }).sort({
        priority: -1,
    });

    if (!rule) {
        throw new Error(
            "No default pricing rule configured."
        );
    }

    return rule;
};

module.exports = {
    getPricingRule,
};
