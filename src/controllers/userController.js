const User = require("../models/User");

/**
 * Get authenticated user's profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        role: user.role,
        wallet: user.wallet,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get authenticated user's wallet balance
 */
exports.getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("wallet");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      balance: user.wallet,
    });
  } catch (error) {
    console.error("Get Wallet Balance Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Refresh wallet balance
 * (Useful after deposits or purchases)
 */
exports.refreshWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("wallet");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      wallet: user.wallet,
      message: "Wallet refreshed successfully.",
    });
  } catch (error) {
    console.error("Refresh Wallet Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
