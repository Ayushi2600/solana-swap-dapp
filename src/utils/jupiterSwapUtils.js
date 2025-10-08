// jupiterSwapUtils.js
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

export class JupiterSwap {
  constructor(connection, publicKey, sendTransaction) {
    this.connection = connection;
    this.publicKey = publicKey;
    this.sendTransaction = sendTransaction;
    this.jupiterApi = "https://quote-api.jup.ag/v6"; // Jupiter V6 API
  }

  /**
   * Get swap quote from Jupiter
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
    try {
      const params = new URLSearchParams({
        inputMint: inputMint,
        outputMint: outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: "false", // Allow multi-hop routes
        asLegacyTransaction: "false", // Use Versioned Transactions
      });

      const response = await fetch(`${this.jupiterApi}/quote?${params}`);
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.statusText}`);
      }

      const quoteResponse = await response.json();

      if (!quoteResponse || quoteResponse.error) {
        throw new Error(quoteResponse.error || "Failed to get quote");
      }

      // Parse quote data
      const inputToken = this.getTokenInfo(inputMint);
      const outputToken = this.getTokenInfo(outputMint);

      const inputAmount = parseInt(quoteResponse.inAmount);
      const outputAmount = parseInt(quoteResponse.outAmount);

      const exchangeRate = (
        outputAmount / Math.pow(10, outputToken.decimals) /
        (inputAmount / Math.pow(10, inputToken.decimals))
      ).toFixed(6);

      const priceImpact = quoteResponse.priceImpactPct 
        ? (parseFloat(quoteResponse.priceImpactPct) * 100).toFixed(2) + "%" 
        : "< 0.01%";

      return {
        inputAmount: inputAmount,
        outputAmount: outputAmount,
        exchangeRate: exchangeRate,
        priceImpact: priceImpact,
        inputToken: inputToken,
        outputToken: outputToken,
        routePlan: quoteResponse.routePlan,
        otherAmountThreshold: quoteResponse.otherAmountThreshold,
        swapMode: quoteResponse.swapMode,
        quoteResponse: quoteResponse, // Keep full response for swap execution
      };
    } catch (error) {
      console.error("Jupiter quote error:", error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(quote, priorityFee = 0) {
    try {
      // Get serialized transaction from Jupiter
      const swapRequestBody = {
        quoteResponse: quote.quoteResponse,
        userPublicKey: this.publicKey.toBase58(),
        wrapAndUnwrapSol: true, // Automatically wrap/unwrap SOL
        dynamicComputeUnitLimit: true, // Optimize compute units
        prioritizationFeeLamports: priorityFee || "auto", // Priority fee
      };

      const swapResponse = await fetch(`${this.jupiterApi}/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapRequestBody),
      });

      if (!swapResponse.ok) {
        throw new Error(`Swap API error: ${swapResponse.statusText}`);
      }

      const { swapTransaction } = await swapResponse.json();

      if (!swapTransaction) {
        throw new Error("No swap transaction returned");
      }

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Send transaction through wallet
      const signature = await this.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        maxRetries: 3,
      });

      console.log("Transaction sent:", signature);

      // Wait for confirmation
      const latestBlockhash = await this.connection.getLatestBlockhash();
      
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("Transaction failed to confirm");
      }

      // Calculate fee (approximate)
      const txDetails = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
      const fee = txDetails?.meta?.fee || 5000;

      return {
        signature: signature,
        isRealTransaction: true,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        inputMint: quote.inputToken.mint,
        outputMint: quote.outputToken.mint,
        isSolToUsdc: quote.inputToken.symbol === "SOL",
        priceImpact: quote.priceImpact,
        fee: fee / 1e9, // Convert lamports to SOL
        routeInfo: quote.routePlan,
      };
    } catch (error) {
      console.error("Jupiter swap execution error:", error);
      throw new Error(`Swap failed: ${error.message}`);
    }
  }

  /**
   * Get token information
   */
  getTokenInfo(mintAddress) {
    const WSOL_MINT = "So11111111111111111111111111111111111111112";
    const USDC_MINT_DEVNET = "94CyfM1LcY8riaZJotZXGjB7GfjVZKWSiQ13DXwmnN8Z";

    if (mintAddress === WSOL_MINT) {
      return { symbol: "SOL", decimals: 9, mint: mintAddress };
    } else if (mintAddress === USDC_MINT_DEVNET) {
      return { symbol: "USDC", decimals: 6, mint: mintAddress };
    }
    throw new Error("Unknown token");
  }

  /**
   * Get token price (optional - for display purposes)
   */
  async getTokenPrice(mintAddress) {
    try {
      const response = await fetch(
        `https://price.jup.ag/v4/price?ids=${mintAddress}`
      );
      const data = await response.json();
      return data.data[mintAddress]?.price || 0;
    } catch (error) {
      console.error("Failed to fetch token price:", error);
      return 0;
    }
  }
}

// Export for use in SwapForm
export default JupiterSwap;