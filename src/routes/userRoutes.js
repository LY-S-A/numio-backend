const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getProfile,
  getWalletBalance,
  refreshWallet,
} = require("../controllers/userController");

// Get authenticated user's profile
router.get("/profile", protect, getProfile);

// Get wallet balance
router.get("/wallet", protect, getWalletBalance);

// Refresh wallet balance
router.get("/wallet/refresh", protect, refreshWallet);

module.exports = router;
