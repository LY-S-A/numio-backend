const express = require("express");
const router = express.Router();

const {
    getDashboardStats,
} = require("../controllers/adminController");

const { protect, adminOnly } = require("../middleware/adminAuthMiddleware");

router.get(
    "/dashboard/stats",
    protect,
    adminOnly,
    getDashboardStats
);

module.exports = router;
