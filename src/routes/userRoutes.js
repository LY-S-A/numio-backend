const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
  getProfile,
  getWalletBalance,
  refreshWallet,
} = require("../controllers/userController");

// Get authenticated user's profile
router.get("/profile", auth, getProfile);

// Get wallet balance
router.get("/wallet", auth, getWalletBalance);

// Refresh wallet balance
router.get("/wallet/refresh", auth, refreshWallet);

module.exports = router;
