const express = require("express");

const router = express.Router();

const {
  initializePayment,
  verifyPayment,
} = require("../controllers/paystackController");

const { protect } = require("../middleware/authMiddleware");

// Initialize Paystack payment
router.post("/init", protect, initializePayment);

// Paystack redirect after payment
router.get("/verify", verifyPayment);

module.exports = router;
