const express = require("express");
const router = express.Router();

const {
  getRecentDeposits,
} = require("../controllers/transactionController");

const { protect } = require("../middleware/authMiddleware");

router.get(
  "/deposits",
  protect,
  getRecentDeposits
);

module.exports = router;
