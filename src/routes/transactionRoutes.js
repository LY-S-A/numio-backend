const express = require("express");
const router = express.Router();

const {
  getRecentDeposits,
  getDepositHistory,
} = require("../controllers/transactionController");

const { protect } = require("../middleware/authMiddleware");

router.get(
  "/recent-deposits",
  protect,
  getRecentDeposits
);

router.get(
  "/deposits-history",
  protect,
  getDepositHistory
);

module.exports = router;
