const service = require("../services/transactionService");

// POST /api/transactions
async function createTransaction(req, res) {
  try {
    const tx = await service.createTransaction(req.body);
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create transaction" });
  }
}

// PATCH /api/transactions/:signature
async function updateTransaction(req, res) {
  try {
    const { signature } = req.params;
    const { status } = req.body;
    const tx = await service.updateTransactionStatus(signature, status);
    res.json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update transaction" });
  }
}

// GET /api/transactions/:walletAddress?filter=all
async function getTransactionHistory(req, res) {
  try {
    const { walletAddress } = req.params;
    const filter = req.query.filter || "all";
    const txs = await service.getTransactions(walletAddress, filter);
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}

module.exports = {
  createTransaction,
  updateTransaction,
  getTransactionHistory,
};
