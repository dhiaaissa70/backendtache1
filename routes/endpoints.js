const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints"); // Controller containing logic
const { validateRequestKey } = require("../middleware/middleware"); // Middleware for key validation

// Routes that require key validation
router.use(validateRequestKey); // Apply key validation middleware globally to relevant routes

// 1. Routes to retrieve game lists
router.post("/getlist", endpointController.getlist); // Fetch list of available games
router.get("/gamesLocal", endpointController.getGameListFromDatabase); // Fetch list of available games from local DB
router.get("/get-all-games", endpointController.getAllGames); // Fetch all games

// 2. Route to retrieve a specific game session
router.post("/get-game", endpointController.getGame); // Retrieve game launch URL and session

// 3. Routes for player management
router.post("/player-exists", endpointController.playerExists); // Check if player exists in provider's system
router.post("/create-player", endpointController.createPlayer); // Create a new player account

// 4. Routes for transactions
router.get("/", (req, res, next) => {
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

// Individual routes for transactions
router.get("/balance", endpointController.getBalance); // Get player balance
router.get("/debit", endpointController.debit); // Debit player's balance
router.get("/credit", endpointController.credit); // Credit player's balance
router.get("/rollback", endpointController.rollback); // Rollback transaction

module.exports = router;
