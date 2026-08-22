// const express = require("express");

// const router = express.Router();


// const {
//     adminLogin,
//     getDashboardStats,

//     getUserCount,
//     getUserStats,
//     getUsers,
//     toggleUserBan,
//     deleteUser,
//     sendMailToUsers,

//     getOrderStats,
//     getOrders,

// } = require("../controllers/adminController");

// const {
//     protect,
//     adminOnly,
// } = require("../middleware/adminAuthMiddleware");


// /*
// ========================================
// ADMIN LOGIN
// ========================================
// */

// router.post(
//     "/login",
//     adminLogin
// );


// /*
// ========================================
// DASHBOARD STATS
// ========================================
// */

// router.get(
//     "/dashboard/stats",
//     protect,
//     adminOnly,
//     getDashboardStats
// );


// /*
// ========================================
// USER COUNT
// ========================================
// */

// router.get(
//     "/users/count",
//     protect,
//     adminOnly,
//     getUserCount
// );


// /*
// ========================================
// USER STATS
// ========================================
// */

// router.get(
//     "/users/stats",
//     protect,
//     adminOnly,
//     getUserStats
// );


// /*
// ========================================
// GET USERS
// ========================================
// */

// router.get(
//     "/users",
//     protect,
//     adminOnly,
//     getUsers
// );


// /*
// ========================================
// BAN / UNBAN USER
// ========================================
// */

// router.patch(
//     "/users/:userId/toggle-ban",
//     protect,
//     adminOnly,
//     toggleUserBan
// );


// /*
// ========================================
// DELETE USER
// ========================================
// */

// router.delete(
//     "/users/:userId",
//     protect,
//     adminOnly,
//     deleteUser
// );


// /*
// ========================================
// SEND EMAIL TO ALL USERS
// ========================================
// */

// router.post(
//     "/users/send-mail",
//     protect,
//     adminOnly,
//     sendMailToUsers
// );


// /*
// ========================================
// ORDER STATS
// ========================================
// */

// router.get(
//     "/orders/stats",
//     protect,
//     adminOnly,
//     getOrderStats
// );


// /*
// ========================================
// GET ORDERS
// ========================================
// */

// router.get(
//     "/orders",
//     protect,
//     adminOnly,
//     getOrders
// );


// module.exports = router;

const express = require("express");

const router = express.Router();

const {
    adminLogin,

    getDashboardStats,

    getUserCount,
    getUserStats,
    getUsers,
    toggleUserBan,
    deleteUser,
    sendMailToUsers,

    getOrderStats,
    getOrders,

    getTransactionStats,
    getTransactions,

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
USER STATS
========================================
*/

router.get(
    "/users/stats",
    protect,
    adminOnly,
    getUserStats
);


/*
========================================
GET USERS
========================================
*/

router.get(
    "/users",
    protect,
    adminOnly,
    getUsers
);


/*
========================================
BAN / UNBAN USER
========================================
*/

router.patch(
    "/users/:userId/toggle-ban",
    protect,
    adminOnly,
    toggleUserBan
);


/*
========================================
DELETE USER
========================================
*/

router.delete(
    "/users/:userId",
    protect,
    adminOnly,
    deleteUser
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


/*
========================================
ORDER STATS
========================================
*/

router.get(
    "/orders/stats",
    protect,
    adminOnly,
    getOrderStats
);


/*
========================================
GET ORDERS
========================================
*/

router.get(
    "/orders",
    protect,
    adminOnly,
    getOrders
);


/*
========================================
TRANSACTION STATS
========================================
*/

router.get(
    "/transactions/stats",
    protect,
    adminOnly,
    getTransactionStats
);


/*
========================================
GET TRANSACTIONS
========================================
*/

router.get(
    "/transactions",
    protect,
    adminOnly,
    getTransactions
);


module.exports = router;
