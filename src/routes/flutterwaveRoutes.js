const express = require("express");

const router = express.Router();

const {
  initializePayment,
  verifyPayment,
} = require("../controllers/flutterwaveController");

const auth = require("../middleware/authMiddleware");

// Initialize Flutterwave payment
router.post("/init", auth, initializePayment);

// Flutterwave redirect after payment
router.get("/verify", verifyPayment);

module.exports = router;
