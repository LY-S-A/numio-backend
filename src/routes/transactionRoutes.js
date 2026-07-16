const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getRecentDeposits,
} = require("../controllers/walletController");

router.get(
  "/deposits",
  protect,
  getRecentDeposits
);

module.exports = router;
