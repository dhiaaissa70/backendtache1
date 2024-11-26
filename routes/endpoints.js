const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints"); // Controller containing logic

// Route to retrieve the game list
router.post("/getlist", endpointController.getlist); // Fetch list of available games

// Route to retrieve a specific game session
router.post("/get-game", endpointController.getGame); // Retrieve game launch URL and session

// Route to get user balance
//router.post("/getUserbalance", endpointController.getuserbalance); // Fetch user balance from provider

// Route to transfer funds to a user
//router.post("/givemoney", endpointController.giveMoneytoUser); // Send funds to the user

// Route to create a new player
//router.post("/createplayer", endpointController.createPlayer); // Create a new player account

// Route to log in an existing player
//router.post("/loginPlayer", endpointController.loginPlayer); // Log in the user via provider API

module.exports = router;
