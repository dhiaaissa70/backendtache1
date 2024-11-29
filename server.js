const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const Redis = require("ioredis");
require("dotenv").config();

const app = express();
const port = 3001;

// Initialize Redis client
const redis = new Redis();

redis.on("connect", () => {
  console.log("Connected to Redis!");
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const AuthRoute = require("./routes/auth");
const TransferRoute = require("./routes/transfer");
const EndpointRoute = require("./routes/endpoints");

connectDB();

app.get("/", (req, res) => {
  res.send("Server is running...");
});

app.use("/tr", TransferRoute);
app.use("/auth", AuthRoute);
app.use("/api", EndpointRoute);

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = redis; // Export Redis for reuse
