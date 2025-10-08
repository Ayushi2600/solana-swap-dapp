const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create transaction
async function createTransaction(data) {
  return prisma.transaction.create({ data });
}

// Update transaction status
async function updateTransactionStatus(signature, status) {
  return prisma.transaction.update({
    where: { signature },
    data: { status },
  });
}

// Get transactions by wallet
async function getTransactions(walletAddress, filter = "all") {
  let txs = await prisma.transaction.findMany({
    where: { walletAddress },
    orderBy: { createdAt: "desc" },
  });

  if (filter !== "all") {
    txs = txs.filter((tx) => tx.type === filter);
  }

  return txs;
}

module.exports = {
  createTransaction,
  updateTransactionStatus,
  getTransactions,
};
