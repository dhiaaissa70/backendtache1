const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints");
const { validateRequestKey } = require("../middleware/middleware");

// Game-related routes
router.post("/getlist", endpointController.getlist); // Fetch provider game list
router.get("/gamesLocal", endpointController.getGameListFromDatabase); // Fetch games from local database
router.get("/get-all-games", endpointController.getAllGames); // Fetch all games

// Game session routes
router.post("/get-game", endpointController.getGame); // Get game launch URL and session details

// Player management routes
router.post("/player-exists", endpointController.playerExists); // Check if a player exists
router.post("/create-player", endpointController.createPlayer); // Create a new player account

// Transaction-related routes
router.get("/balance", endpointController.getBalance); // Retrieve player's balance
router.get("/debit", endpointController.debit); // Debit player balance
router.get("/credit", endpointController.credit); // Credit player balance
router.get("/rollback", endpointController.rollback); // Rollback a transaction

// Apply `validateRequestKey` middleware specifically to the fallback route
router.get("/", validateRequestKey, (req, res) => {
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
            console.warn("[WARN] Invalid action query parameter");
            return res.status(404).json({ success: false, message: "Invalid action." });
    }
});

module.exports = router;
