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

exports.getDepositHistory = async (req, res) => {
  try {
    const deposits = await Transaction.find({
      user: req.user.id,
      type: "DEPOSIT",
    })
      .sort({ createdAt: -1 })
      .select(
        "reference amount provider status paymentMethod description createdAt"
      );

    const totalDeposited = deposits
      .filter((tx) => tx.status === "SUCCESS")
      .reduce((sum, tx) => sum + tx.amount, 0);

    return res.status(200).json({
      success: true,
      totalDeposited,
      total: deposits.length,
      deposits,
    });
  } catch (error) {
    console.error("Deposit History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch deposit history.",
    });
  }
};
