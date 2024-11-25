const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints");

// Route POST to retrieve the game list
router.post("/getlist", endpointController.getlist);

// Route POST to retrieve a specific game
router.post("/get-game", endpointController.getGame);

router.post("/getUserbalance", endpointController.getuserbalance);

router.post("/givemoney", endpointController.giveMoneytoUser);

module.exports = router;
