const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints");

// Routes
router.post("/getlist", endpointController.getlist);
router.post("/get-game", endpointController.getGame);
router.post("/player-exists", endpointController.playerExists);
router.post("/create-player", endpointController.createPlayer);
router.get("/balance", endpointController.getBalance); // Balance endpoint
router.get("/debit", endpointController.debit);        // Debit endpoint
router.get("/credit", endpointController.credit);      // Credit endpoint
router.get("/rollback", endpointController.rollback);  // Rollback endpoint

module.exports = router;
