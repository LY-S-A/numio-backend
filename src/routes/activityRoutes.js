const express = require("express");
const router = express.Router();

const {
    getLiveActivities,
    getDashboardStats,
} = require("../controllers/activityController");

const { protect } = require("../middleware/authMiddleware");

router.get("/live", protect, getLiveActivities);

router.get("/stats", protect, getDashboardStats);

module.exports = router;
