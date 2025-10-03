import axios from "axios";
import { VersionedTransaction } from "@solana/web3.js";

/**
 * Fetch swap quote from Jupiter API
 */
export const getSwapQuote = async (
  inputMint,
  outputMint,
  amountInSmallestUnit
) => {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=50&cluster=mainnet-beta`;
    const res = await axios.get(url);

    if (!res.data || !res.data.routePlan || res.data.routePlan.length === 0) {
      console.error("No valid route found:", res.data);
      return null;
    }

    return res.data; // Return full quote object (Jupiter format)
  } catch (err) {
    console.error(
      "Error fetching swap quote:",
      err.response?.data || err.message
    );
    return null;
  }
};

export const executeSwap = async (
  route,
  userPublicKey,
  connection,
  sendTransaction
) => {
  try {
    const url = "https://quote-api.jup.ag/v6/swap?cluster=mainnet-beta";
    const payload = {
      quoteResponse: route,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto"
    };

    const { data } = await axios.post(url, payload);

    if (!data.swapTransaction)
      throw new Error("No transaction returned from Jupiter");

    // Use VersionedTransaction
    const tx = VersionedTransaction.deserialize(
      Buffer.from(data.swapTransaction, "base64")
    );

    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");

    return signature;
  } catch (err) {
    console.error("Swap execution error:", err.response?.data || err.message);
    return null;
  }
};
