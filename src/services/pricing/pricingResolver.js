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

let cachedRules = null;
let lastFetched = 0;

const CACHE_TIME = 5 * 60 * 1000;

/*
========================================
LOAD RULES ONLY ONCE
========================================
*/

const loadRules = async () => {

    const now = Date.now();

    if (
        cachedRules &&
        now - lastFetched < CACHE_TIME
    ) {
        return cachedRules;
    }

    cachedRules = await PricingRule.find({
        enabled: true,
    }).lean();

    lastFetched = now;

    return cachedRules;

};

/*
========================================
CLEAR CACHE
========================================
*/

const clearPricingCache = () => {

    cachedRules = null;
    lastFetched = 0;

};

/*
========================================
GET RULE
========================================
*/

const getPricingRule = ({
    country,
    service,
    usdPrice,
    rules,
}) => {

    country = country?.toLowerCase().trim();
    service = service?.toLowerCase().trim();

    /*
    ===============================
    COUNTRY + SERVICE
    ===============================
    */

    let rule = rules.find(r =>
        r.type === "RULE" &&
        r.country === country &&
        r.service === service
    );

    if (rule) return rule;

    /*
    ===============================
    SERVICE
    ===============================
    */

    rule = rules.find(r =>
        r.type === "RULE" &&
        !r.country &&
        r.service === service
    );

    if (rule) return rule;

    /*
    ===============================
    THRESHOLD
    ===============================
    */

    const thresholds = rules
        .filter(r =>
            r.type === "THRESHOLD" &&
            r.minUsdPrice <= usdPrice
        )
        .sort((a, b) => b.minUsdPrice - a.minUsdPrice);

    if (thresholds.length)
        return thresholds[0];

    /*
    ===============================
    DEFAULT
    ===============================
    */

    rule = rules.find(r =>
        r.type === "DEFAULT"
    );

    if (!rule) {

        throw new Error(
            "No default pricing rule configured."
        );

    }

    return rule;

};

module.exports = {
    loadRules,
    getPricingRule,
    clearPricingCache,
};
