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

// 5. Route to handle balance callback
router.get("/balance", endpointController.getBalance); // Respond with user balance



router.get('/', (req, res) => {

const {action }= req.query;


if (action === "credit") {

     return endpointController.credit(req,res);
}

if (action === "debit") {

    return endpointController.debit(req,res);
}


return " missing";

}



);

// 6. Route to handle debit (bet) callback
router.get("/", endpointController.debit); // Deduct bet amount from user's balance

// 7. Route to handle credit (win) callback
router.get("/", endpointController.credit); // Add win amount to user's balance

// 8. Route to handle rollback callback
router.get("/", endpointController.rollback); // Rollback a previous transaction

module.exports = router;