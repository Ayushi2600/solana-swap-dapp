import { Connection, clusterApiUrl } from "@solana/web3.js";
import { WSOL_MINT, USDC_MINT_DEVNET } from "../constants/constant";

export async function findRaydiumPoolId() {
  try {
    const connection = new Connection(clusterApiUrl("devnet"));
    
    // Method 1: Query Raydium API for devnet pools
    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
    const allPools = await response.json();
    
    // Filter for SOL-USDC pools on devnet
    const solUsdcPools = allPools.official.filter(pool => 
      (pool.baseMint === WSOL_MINT && pool.quoteMint === USDC_MINT_DEVNET) ||
      (pool.baseMint === USDC_MINT_DEVNET && pool.quoteMint === WSOL_MINT)
    );
    
    if (solUsdcPools.length > 0) {
      console.log("Found Raydium pools:", solUsdcPools);
      return solUsdcPools[0].id;
    }
    
    // Method 2: Common devnet pool IDs (try these)
    const commonDevnetPools = [
      "6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg", // Common devnet pool
      "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8", // Another common one
    ];
    
    // Test which pool exists
    for (const poolId of commonDevnetPools) {
      try {
        const poolAccount = await connection.getAccountInfo(new PublicKey(poolId));
        if (poolAccount) {
          console.log("Using pool:", poolId);
          return poolId;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error("No active SOL-USDC pool found on devnet");
    
  } catch (error) {
    console.error("Failed to find pool:", error);
    return null;
  }
}