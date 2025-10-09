const { PrismaClient } = require("@prisma/client");
const { Connection, clusterApiUrl, PublicKey } = require("@solana/web3.js");

const prisma = new PrismaClient();
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

function getFromToValue(tx) {
  if (!tx || !tx.meta || !tx.transaction) return {};

  const preBalances = tx.meta.preBalances;
  const postBalances = tx.meta.postBalances;
  const accountKeys = tx.transaction.message.accountKeys.map((k) =>
    k.toBase58()
  );

  let from = null;
  let to = null;
  let value = 0;

  // Detect which account sent SOL and which received
  preBalances.forEach((pre, i) => {
    const post = postBalances[i];
    if (pre > post && !from) from = accountKeys[i]; // sender
    if (post > pre && !to) {
      to = accountKeys[i]; // recipient
      value = (post - pre) / 1e9; // convert lamports to SOL
    }
  });

  return { from, to, value };
}

async function fetchSolanaDetails(signature) {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return {};

    return getFromToValue(tx);
  } catch (err) {
    console.error("Error fetching Solana tx details:", err);
    return {};
  }
}

// Create transaction
async function createTransaction(data) {
  const { signature } = data;
  const solanaInfo = await fetchSolanaDetails(signature);

  return prisma.transaction.create({
    data: {
      ...data,
      ...solanaInfo,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    },
  });
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
