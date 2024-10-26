const express = require("express");
const router = express.Router();
const TransferController = require("../controllers/transfercontroller");

// Route to handle transfers (deposit/withdraw)
router.post("/transfer", TransferController.transfer);

// Route to get transfer history for a specific user
router.get("/transfer-history", TransferController.getTransferHistory);

module.exports = router;
