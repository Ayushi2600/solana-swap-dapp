import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

export const getSolBalance = async (connection, ownerPubkey) => {
  const balance = await connection.getBalance(new PublicKey(ownerPubkey));
  return balance / 1e9; // lamports → SOL
};

export const getTokenBalance = async (
  connection,
  ownerPubkey,
  tokenMint,
  decimals = 6
) => {
  try {
    const owner = new PublicKey(ownerPubkey);
    const mint = new PublicKey(tokenMint);

    // Get the associated token account
    const ata = await getAssociatedTokenAddress(mint, owner);

    // Try to fetch account info
    const account = await getAccount(connection, ata);

    // Convert raw amount to human-readable
    return Number(account.amount) / 10 ** decimals;
  } catch (err) {
    // If account doesn't exist or error, return 0
    return 0;
  }
};
