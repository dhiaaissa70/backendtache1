const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
require("dotenv").config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3001;
const AuthRoute = require("./routes/auth");
const TranferRoute = require("./routes/transfer");
const EndpointRoute = require("./routes/endpoints");

// Connect to the database
connectDB();

// Enable 'trust proxy' for proper IP detection
app.set("trust proxy", 1); // Required for environments like Render, Heroku, etc.

// Middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "https://tache1.netlify.app"], // Allowed origins
    methods: ["GET", "POST"], // Allowed HTTP methods
    credentials: true, // Allow cookies if needed
  })
);
app.use(compression());
app.use(express.json());

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Send rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// Base route
app.get("/", (req, res) => {
  res.send("le serveur est en marche");
});

// Route configurations
app.use("/tr", TranferRoute);
app.use("/auth", AuthRoute);
app.use("/api", EndpointRoute);

// Log response sizes
app.use((req, res, next) => {
  const oldWrite = res.write;
  const oldEnd = res.end;
  let chunks = [];

  res.write = function (chunk) {
    chunks.push(chunk);
    oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    console.log(`[DEBUG] Response size for ${req.path}: ${Buffer.byteLength(body)} bytes`);
    oldEnd.apply(res, arguments);
  };

  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[GLOBAL ERROR HANDLER]:", err.stack || err.message);
  res.status(500).json({ success: false, message: "Internal server error." });
});

// Unhandled errors monitoring
process.on("unhandledRejection", (reason, promise) => {
  console.error("[UNHANDLED REJECTION]:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]:", err);
  process.exit(1);
});

// Start the server
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution à http://localhost:${port}`);
});
