const express = require("express");
const router = express.Router();
const TransferController = require("../controllers/transfercontroller");

// Route to handle transfers (deposit/withdraw)
router.post("/transfer", TransferController.makeTransfer);

// Route to get transfer history for a specific user
router.get("/transfer-history", TransferController.getTransferHistory);

router.get("/all-transfers", TransferController.getAllTransfers);


module.exports = router;
