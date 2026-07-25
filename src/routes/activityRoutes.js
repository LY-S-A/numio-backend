const express = require("express");
const router = express.Router();

const {
    getLiveActivities,
} = require("../controllers/activityController");

const { protect } = require("../middleware/authMiddleware");

router.get("/live", protect, getLiveActivities);

module.exports = router;
