const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints"); // Controller containing logic

// 1. Route to retrieve the game list
router.post("/getlist", endpointController.getlist); // Fetch list of available games

// 2. Route to retrieve a specific game session
router.post("/get-game", endpointController.getGame); // Retrieve game launch URL and session

// 3. Route to check if player exists
router.post("/player-exists", endpointController.playerExists); // Check if player exists in provider's system

// 4. Route to create a new player
router.post("/create-player", endpointController.createPlayer); // Create a new player account

router.get("/balance", endpointController.getBalance);
router.get("/debit", endpointController.debit);
router.get("/credit", endpointController.credit);
router.get("/rollback", endpointController.rollback);


module.exports = router;