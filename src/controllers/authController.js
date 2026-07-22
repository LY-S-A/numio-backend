const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// ================= CREATE JWT =================
const createToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// ================= REGISTER =================
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      return res.status(409).json({
        message: "Email already exists.",
      });
    }

    const existingUsername = await User.findOne({
      username,
    });

    if (existingUsername) {
      return res.status(409).json({
        message: "Username already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = createToken(user._id);

    res.status(201).json({
      message: "Registration successful.",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        wallet: user.wallet,
        verified: user.verified,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user._id);

    res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        wallet: user.wallet,
        verified: user.verified,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const user = await User.findOne({ email });

    // Don't reveal whether the email exists
    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists, a password reset link has been sent.",
      });
    }

    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      }
    );

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset Your Numio Password",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px">

          <h2 style="color:#6f5eff;">
            Reset Your Password
          </h2>

          <p>Hello <strong>${user.username}</strong>,</p>

          <p>
            We received a request to reset the password for your Numio account.
          </p>

          <p>
            Click the button below to continue.
          </p>

          <p style="margin:30px 0;">
            <a
              href="${resetLink}"
              style="
                background:#6f5eff;
                color:#ffffff;
                padding:14px 28px;
                text-decoration:none;
                border-radius:8px;
                display:inline-block;
                font-weight:bold;
              "
            >
              Reset Password
            </a>
          </p>

          <p>
            Or copy and paste this link into your browser:
          </p>

          <p>
            ${resetLink}
          </p>

          <hr>

          <p>
            This link expires in
            <strong>15 minutes</strong>.
          </p>

          <p>
            If you didn't request a password reset,
            you can safely ignore this email.
          </p>

          <br>

          <p>
            — Numio Team
          </p>

        </div>
      `,
    });

    res.status(200).json({
      message:
        "If an account exists, a password reset link has been sent.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Unable to send reset email.",
    });
  }
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    user.password = await bcrypt.hash(
      password,
      10
    );

    await user.save();

    res.status(200).json({
      message:
        "Password has been reset successfully.",
    });
  } catch (err) {
    console.error(err);

    if (err.name === "TokenExpiredError") {
      return res.status(400).json({
        message: "Reset link has expired.",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(400).json({
        message: "Invalid reset link.",
      });
    }

    res.status(500).json({
      message: "Unable to reset password.",
    });
  }
};
