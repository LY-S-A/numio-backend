const express = require("express");

const router = express.Router();

const {
  buyNumber,
  refreshSMS,
  finishOrder,
  cancelOrder,
  getActiveOrders,
  getOrderHistory,
  getOrder,
  deleteOrder,
  getProfile,
  getServices,
  getCountries,
  getInbox,
} = require("../controllers/fiveSimController");

const { protect } = require("../middleware/authMiddleware");


// Get available services
router.get("/services", protect, getServices);

// Get all countries
router.get("/countries", protect, getCountries);

// Buy a new number
router.post("/buy", protect, buyNumber);


// Refresh SMS for an order
router.get("/refresh/:orderId", protect, refreshSMS);


// Finish an order
router.post("/finish/:orderId", protect, finishOrder);


// Cancel an order
router.post("/cancel/:orderId", protect, cancelOrder);


// Get active orders
router.get("/active", protect, getActiveOrders);


// Get SMS inbox (FINISHED orders with OTP only)
router.get("/inbox", protect, getInbox);

// Get order history
router.get("/history", protect, getOrderHistory);


// Get a single order
router.get("/order/:orderId", protect, getOrder);


// Delete a completed/cancelled order
router.delete("/order/:orderId", protect, deleteOrder);


// Get 5SIM account profile
router.get("/profile", protect, getProfile);


module.exports = router;
