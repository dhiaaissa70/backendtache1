const express = require("express");
const router = express.Router();
const endpointController = require("../controllers/endpoints");

// Route POST pour récupérer la liste
router.route("/getlist").post(endpointController.getlist);

module.exports = router;
