// backend/utils/solana.js
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet")); // or mainnet-beta

export async function checkTransactionOnSolana(signature) {
  try {
    const tx = await connection.getTransaction(signature);
    if (!tx) return "pending";
    return "confirmed";
  } catch (err) {
    console.error("Error checking transaction:", err);
    return "failed";
  }
}

export { connection };
