const express = require("express");
const router = express.Router();
const controller = require("../controllers/transactionController");

router.post("/", controller.createTransaction);
router.patch("/:signature", controller.updateTransaction);
router.get("/:walletAddress", controller.getTransactionHistory);

module.exports = router;
