const express = require('express');
const cors = require('cors'); 
const connectDB = require("./config/db");
require('dotenv').config(); // Load environment variables
const app = express();
const port = process.env.PORT || 3001; // Dynamic port for Render
const AuthRoute = require("./routes/auth");
const TranferRoute = require("./routes/transfer");
const EndpointRoute = require("./routes/endpoints");

// Connect to the database
connectDB();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = ['https://yourdomain.com', 'https://staging.yourdomain.com'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Base route
app.get('/', (req, res) => {
  res.send('The server is running.');
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

// Routes
app.use("/tr", TranferRoute);
app.use("/auth", AuthRoute);
app.use("/api", EndpointRoute);

// Global error handler
app.use((err, req, res, next) => {
  console.error("[ERROR] Unexpected Error:", err.message);
  res.status(500).json({ success: false, message: "An internal server error occurred." });
});

// Start the server
app.listen(port, () => {
  console.log(`[INFO] Server running at http://localhost:${port}`);
});
