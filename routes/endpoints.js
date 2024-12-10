const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints"); // Controller containing logic
const { validateRequestKey } = require("../middleware/middleware"); // Middleware for key validation

// Apply key validation middleware globally to all routes that require it
router.use(validateRequestKey);

// Game-related routes
router.post("/getlist", endpointController.getlist); // Fetch list of available games
router.get("/gamesLocal", endpointController.getGameListFromDatabase); // Fetch local database games
router.get("/get-all-games", endpointController.getAllGames); // Fetch all games

// Game session route
router.post("/get-game", endpointController.getGame); // Retrieve game launch URL and session

// Player management routes
router.post("/player-exists", endpointController.playerExists); // Check if player exists
router.post("/create-player", endpointController.createPlayer); // Create a new player account

// Transaction-related routes
router.get("/balance", endpointController.getBalance); // Get player's balance
router.get("/debit", endpointController.debit); // Debit player's balance
router.get("/credit", endpointController.credit); // Credit player's balance
router.get("/rollback", endpointController.rollback); // Rollback a transaction

// Fallback route to handle actions via query parameter
router.get("/", (req, res) => {
    const { action } = req.query;

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
