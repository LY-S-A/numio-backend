const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Invalid email"],
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    wallet: {
      type: Number,
      default: 0,
    },

    role: {
      type: String,
      default: "user",
      enum: ["user", "admin"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);

