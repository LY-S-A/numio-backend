// exports.getRules = async (req, res) => {

//     const rules =
//         await PricingRule.find()

//         .sort({

//             priority:-1

//         });

//     res.json({

//         success:true,

//         rules

//     });

// };

// exports.createRule = async (req, res) => {

//     const rule =
//         await PricingRule.create(req.body);

//     res.status(201).json({

//         success:true,

//         rule

//     });

// };

// exports.updateRule = async (req, res) => {

//     const rule =
//         await PricingRule.findByIdAndUpdate(

//             req.params.id,

//             req.body,

//             {

//                 new:true,

//                 runValidators:true

//             }

//         );

//     res.json({

//         success:true,

//         rule

//     });

// };

// exports.deleteRule = async (req, res) => {

//     await PricingRule.findByIdAndDelete(

//         req.params.id

//     );

//     res.json({

//         success:true,

//         message:"Pricing rule deleted."

//     });

// };

// exports.getExchangeRate = async (req, res) => {

//     const rate =
//         await ExchangeRate.findOne({
//             active:true
//         });

//     res.json({

//         success:true,

//         rate

//     });

// };

// exports.updateExchangeRate = async (req, res) => {

//     const { rate } = req.body;

//     const exchangeRate =
//         await ExchangeRate.findOneAndUpdate(

//             {

//                 active:true

//             },

//             {

//                 rate

//             },

//             {

//                 new:true

//             }

//         );

//     res.json({

//         success:true,

//         exchangeRate

//     });

// };
