const express = require("express");
const router = express.Router();

const {
  register,
  login,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const {
  googleLogin,
} = require("../controllers/googleAuthController");

// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Forgot Password
router.post(
  "/forgot-password",
  forgotPassword
);

// Reset Password
router.post(
  "/reset-password/:token",
  resetPassword
);

// Google Login
router.post(
  "/google",
  googleLogin
);


module.exports = router;
