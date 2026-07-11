const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const createToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// REGISTER
exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({
        message: "Email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    const token = createToken(user._id);

    res.status(201).json({
      message: "Registration successful.",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        wallet: user.wallet,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

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

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        wallet: user.wallet,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
