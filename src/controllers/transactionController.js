const Transaction = require("../models/Transaction");

exports.getRecentDeposits = async (req, res) => {
  try {
    const deposits = await Transaction.find({
      user: req.user.id,
      type: "DEPOSIT",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "reference amount provider status paymentMethod description createdAt"
      );

    return res.status(200).json({
      success: true,
      deposits,
    });
  } catch (error) {
    console.error("Recent Deposits Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch recent deposits.",
    });
  }
};
