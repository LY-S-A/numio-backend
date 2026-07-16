const express = require("express");
const router = express.Router();

const {
  getRecentDeposits,
} = require("../controllers/transactionController");

const { protect } = require("../middleware/authMiddleware");

router.get(
  "/recent-deposits",
  protect,
  getRecentDeposits
);

module.exports = router;
