const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const endpointController = require("../controllers/endpoints"); // Controller containing logic

// 1. Route to retrieve the game list
router.post("/getlist", endpointController.getlistgame); // Fetch list of available games

// 2. Route to retrieve a specific game session
router.post("/get-game", endpointController.getGame); // Retrieve game launch URL and session

// 3. Route to check if player exists
router.post("/player-exists", endpointController.playerExists); // Check if player exists in provider's system

// 4. Route to create a new player
router.post("/create-player", endpointController.createPlayer); // Create a new player account

const validateHash = (req, res, next) => {
  try {
    const queryParams = { ...req.query };
    const providedKey = queryParams.key;
    delete queryParams.key;

    const queryString = Object.entries(queryParams)
      .sort()
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    const expectedKey = crypto.createHash("sha1").update(`${process.env.API_SALT}${queryString}`).digest("hex");

    if (providedKey !== expectedKey) {
      console.error("[ERROR] Invalid hash key provided.");
      return res.status(403).json({ success: false, message: "Invalid hash key." });
    }

    next();
  } catch (error) {
    console.error("[ERROR] Hash validation error:", error.message);
    return res.status(500).json({ success: false, message: "Hash validation failed." });
  }
};

// Middleware: Validate input
const validateInput = (req, res, next) => {
  const { action } = req.query;

  switch (action) {
    case "balance":
      if (!req.query.remote_id || !req.query.username || !req.query.currency) {
        return res.status(400).json({ success: false, message: "Missing required parameters for balance action." });
      }
      break;

    case "debit":
    case "credit":
      if (
        !req.query.remote_id ||
        !req.query.username ||
        !req.query.amount ||
        !req.query.transaction_id ||
        !req.query.currency
      ) {
        return res.status(400).json({ success: false, message: `Missing required parameters for ${action} action.` });
      }
      break;

    case "rollback":
      if (!req.query.transaction_id) {
        return res.status(400).json({ success: false, message: "Missing required parameters for rollback action." });
      }
      break;

    default:
      return res.status(404).json({ success: false, message: "Invalid action." });
  }

  next();
};

// Middleware: Log request
const logRequest = (req, res, next) => {
  console.log(`[INFO] Incoming Request:`, {
    action: req.query.action,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    params: req.query,
  });
  next();
};

// Apply middleware
router.get("/", logRequest, validateHash, validateInput, (req, res, next) => {
  const action = req.query.action;

  switch (action) {
    case "balance":
      return endpointController.getBalance(req, res);
    case "debit":
      return endpointController.debit(req, res);
    case "credit":
      return endpointController.credit(req, res);
    case "rollback":
      return endpointController.rollback(req, res);
    default:
      return res.status(404).json({ success: false, message: "Invalid action." });
  }
});

module.exports = router;

