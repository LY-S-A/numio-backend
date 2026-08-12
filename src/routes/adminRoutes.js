const express = require("express");

const router = express.Router();

const {
    adminLogin,
    getDashboardStats,
    getUserCount,
    sendMailToUsers,
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
DASHBOARD STATS
========================================
*/

router.get(
    "/dashboard/stats",
    protect,
    adminOnly,
    getDashboardStats
);


/*
========================================
USER COUNT
========================================
*/

router.get(
    "/users/count",
    protect,
    adminOnly,
    getUserCount
);


/*
========================================
SEND EMAIL TO ALL USERS
========================================
*/

router.post(
    "/users/send-mail",
    protect,
    adminOnly,
    sendMailToUsers
);


module.exports = router;
