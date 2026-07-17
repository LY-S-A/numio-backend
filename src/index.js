require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const flutterwaveRoutes = require("./routes/flutterwaveRoutes");
const paystackRoutes = require("./routes/paystackRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const fiveSimRoutes = require("./routes/fiveSimRoutes");

const app = express();

// ================= CORS =================
const allowedOrigins = [
  "http://localhost:3000",
  "https://numio-one.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman, curl, mobile apps, etc.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ROOT =================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "RealSMS API is running 🚀",
  });
});

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/flutterwave", flutterwaveRoutes);
app.use("/api/paystack", paystackRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/5sim", fiveSimRoutes);


// ================= 404 =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server");
    console.error(err);
    process.exit(1);
  }
};

startServer();
