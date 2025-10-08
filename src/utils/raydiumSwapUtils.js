import {
  Raydium,
  TxVersion,
  parseTokenAccountResp,
} from "@raydium-io/raydium-sdk-v2";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  WSOL_MINT,
  USDC_MINT_DEVNET,
  SLIPPAGE_BPS,
} from "../constants/constant";

export class RaydiumSwap {
  constructor(connection, publicKey, sendTransaction) {
    this.connection = connection;
    this.publicKey = publicKey;
    this.sendTransaction = sendTransaction;
    this.raydium = null;
  }

  /**
   * Initialize Raydium SDK
   */
  async initialize() {
    if (this.raydium) return;

    try {
      this.raydium = await Raydium.load({
        owner: this.publicKey,
        connection: this.connection,
        cluster: "devnet",
        disableFeatureCheck: true,
        disableLoadToken: false,
      });
    } catch (error) {
      console.error("Failed to initialize Raydium:", error);
      throw new Error("Raydium initialization failed");
    }
  }

  async getQuote(inputMint, outputMint, amount) {
    try {
      await this.initialize();

      const inputToken = this.getTokenInfo(inputMint);
      const outputToken = this.getTokenInfo(outputMint);

      // For devnet, use fixed rate if Raydium fails
      if (!this.poolId) {
        return this.getManualQuote(inputMint, outputMint, amount);
      }

      const poolKeys = await this.raydium.liquidity.getPoolInfoFromRpc({
        poolId: this.poolId,
      });

      if (!poolKeys) {
        console.log("Raydium pool not found, using manual quote");
        return this.getManualQuote(inputMint, outputMint, amount);
      }

      const { amountOut, minAmountOut, priceImpact, fee } =
        await this.raydium.liquidity.computeAmountOut({
          poolInfo: poolKeys,
          amountIn: amount,
          mintIn: inputMint,
          mintOut: outputMint,
          slippage: SLIPPAGE_BPS / 10000,
        });

      const exchangeRate = (
        amountOut /
        Math.pow(10, outputToken.decimals) /
        (amount / Math.pow(10, inputToken.decimals))
      ).toFixed(6);

      return {
        inputAmount: amount,
        outputAmount: amountOut,
        minAmountOut,
        exchangeRate,
        priceImpact: priceImpact ? (priceImpact * 100).toFixed(2) + "%" : "N/A",
        fee: fee / Math.pow(10, inputToken.decimals),
        inputToken,
        outputToken,
        poolKeys,
        isRaydium: true, // ✅ ADD THIS LINE
      };
    } catch (error) {
      console.error("Raydium quote failed, using manual:", error);
      return this.getManualQuote(inputMint, outputMint, amount);
    }
  }

  getManualQuote(inputMint, outputMint, amount) {
    const inputToken = this.getTokenInfo(inputMint);
    const outputToken = this.getTokenInfo(outputMint);

    const isSolToUsdc = inputMint === WSOL_MINT;
    const exchangeRate = 100; // 1 SOL = 100 USDC

    let outputAmount;
    if (isSolToUsdc) {
      outputAmount =
        amount *
        exchangeRate *
        (10 ** outputToken.decimals / 10 ** inputToken.decimals);
    } else {
      outputAmount =
        (amount / exchangeRate) *
        (10 ** outputToken.decimals / 10 ** inputToken.decimals);
    }

    return {
      inputAmount: amount,
      outputAmount: Math.floor(outputAmount),
      exchangeRate,
      priceImpact: "N/A",
      fee: 0.000005,
      inputToken,
      outputToken,
      poolKeys: null,
      isRaydium: false, // ✅ ADD THIS LINE
    };
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(quote, inputMint, outputMint) {
    try {
      await this.initialize();

      // Build swap transaction
      const { transaction } = await this.raydium.liquidity.swap({
        poolInfo: quote.poolKeys,
        amountIn: quote.inputAmount,
        amountOut: quote.minAmountOut,
        fixedSide: "in",
        inputMint,
        txVersion: TxVersion.V0,
        computeBudgetConfig: {
          microLamports: 100000,
        },
      });

      // Send transaction through wallet
      const signature = await this.sendTransaction(
        transaction,
        this.connection,
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      );

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("Transaction failed");
      }

      return {
        signature,
        isRealTransaction: true,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        inputMint,
        outputMint,
        isSolToUsdc: inputMint === WSOL_MINT,
        priceImpact: quote.priceImpact,
        fee: quote.fee,
      };
    } catch (error) {
      console.error("Swap execution error:", error);
      throw error;
    }
  }

  /**
   * Get pool ID for token pair (you need to fetch this from Raydium API)
   */
  getPoolId(inputMint, outputMint) {
    // For SOL-USDC on devnet
    if (
      (inputMint === WSOL_MINT && outputMint === USDC_MINT_DEVNET) ||
      (inputMint === USDC_MINT_DEVNET && outputMint === WSOL_MINT)
    ) {
      // This is a placeholder - you need to get actual pool ID from Raydium
      return "POOL_ID_HERE";
    }
    throw new Error("Unsupported token pair");
  }

  /**
   * Get token information
   */
  getTokenInfo(mintAddress) {
    if (mintAddress === WSOL_MINT) {
      return { symbol: "SOL", decimals: 9, mint: mintAddress };
    } else if (mintAddress === USDC_MINT_DEVNET) {
      return { symbol: "USDC", decimals: 6, mint: mintAddress };
    }
    throw new Error("Unknown token");
  }

  /**
   * Fetch user token accounts
   */
  async fetchTokenAccounts() {
    try {
      const solAccountResp = await this.connection.getAccountInfo(
        this.publicKey
      );
      const tokenAccountResp = await this.connection.getTokenAccountsByOwner(
        this.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      const token2022Req = await this.connection.getTokenAccountsByOwner(
        this.publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );

      const tokenAccountData = parseTokenAccountResp({
        owner: this.publicKey,
        solAccountResp,
        tokenAccountResp: {
          context: tokenAccountResp.context,
          value: [...tokenAccountResp.value, ...token2022Req.value],
        },
      });

      return tokenAccountData;
    } catch (error) {
      console.error("Failed to fetch token accounts:", error);
      return [];
    }
  }
}
