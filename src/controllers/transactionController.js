const Transaction = require("../models/Transaction");

exports.getRecentDeposits = async (req, res) => {
  try {
    const deposits = await Transaction.find({
      user: req.user.id,
      type: "deposit",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "amount gateway status reference createdAt"
      );

    return res.status(200).json({
      success: true,
      deposits,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent deposits.",
    });
  }
};
