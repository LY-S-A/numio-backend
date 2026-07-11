require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(console.error);

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(`Server running on ${PORT}`)
);
