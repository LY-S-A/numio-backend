const express = require("express");

const router = express.Router();

const {
    adminLogin,
    getDashboardStats,
} = require("../controllers/adminController");

const {
    protect,
    adminOnly,
} = require("../middleware/adminAuthMiddleware");


/*
========================================
ADMIN LOGIN
========================================
*/
router.post(
    "/login",
    adminLogin
);


/*
========================================
ADMIN DASHBOARD STATS
========================================
*/
router.get(
    "/dashboard/stats",
    protect,
    adminOnly,
    getDashboardStats
);


module.exports = router;
