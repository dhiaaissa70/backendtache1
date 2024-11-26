const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints");

// Game List
router.post("/getlist", endpointController.getlist);

// Player Management
router.post("/player-exists", endpointController.playerExists);
router.post("/create-player", endpointController.createPlayer);

// Game Session Management
router.post("/get-game", endpointController.getGame);

// Callback Handlers
router.get("/api", endpointController.getBalance); // Respond to balance requests from the provider
router.get("/debit", endpointController.debit);
router.get("/credit", endpointController.credit);
router.get("/rollback", endpointController.rollback);

module.exports = router;
