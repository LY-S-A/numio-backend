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

    /*
    ===================================
    Priority 1
    Country + Service
    ===================================
    */

    let rule = await PricingRule.findOne({

        enabled: true,

        type: "RULE",

        country,

        service,

    }).sort({ priority: -1 });

    if (rule) return rule;

    /*
    ===================================
    Priority 2
    Service
    ===================================
    */

    rule = await PricingRule.findOne({

        enabled: true,

        type: "RULE",

        country: null,

        service,

    }).sort({ priority: -1 });

    if (rule) return rule;

    /*
    ===================================
    Priority 3
    Threshold
    ===================================
    */

    rule = await PricingRule.findOne({

        enabled: true,

        type: "THRESHOLD",

        minUsdPrice: {
            $lte: usdPrice,
        },

    }).sort({

        minUsdPrice: -1,

        priority: -1,

    });

    if (rule) return rule;

    /*
    ===================================
    Priority 4
    Default
    ===================================
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
