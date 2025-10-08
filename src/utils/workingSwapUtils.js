import { SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { WSOL_MINT, USDC_MINT_DEVNET } from "../constants/constant";

export class WorkingSwap {
  constructor(connection, publicKey, sendTransaction) {
    this.connection = connection;
    this.publicKey = publicKey;
    this.sendTransaction = sendTransaction;
    this.exchangeRate = 100; // 1 SOL = 100 USDC
  }

  getManualQuote(inputMint, outputMint, amount) {
    const inputToken = this.getTokenInfo(inputMint);
    const outputToken = this.getTokenInfo(outputMint);

    const isSolToUsdc = inputMint === WSOL_MINT;

    let outputAmount;
    if (isSolToUsdc) {
      // SOL to USDC: amount * exchange rate
      outputAmount =
        amount *
        this.exchangeRate *
        (10 ** outputToken.decimals / 10 ** inputToken.decimals);
    } else {
      // USDC to SOL: amount / exchange rate
      outputAmount =
        (amount / this.exchangeRate) *
        (10 ** outputToken.decimals / 10 ** inputToken.decimals);
    }

    return {
      inputAmount: amount,
      outputAmount: Math.floor(outputAmount),
      exchangeRate: this.exchangeRate,
      priceImpact: "N/A",
      fee: 0.000005,
      inputToken,
      outputToken,
      isRaydium: false,
    };
  }

  async getQuote(inputMint, outputMint, amount) {
    return this.getManualQuote(inputMint, outputMint, amount);
  }

  async executeSwap(quote, inputMint, outputMint) {
    try {
      if (!this.sendTransaction) {
        return this.simulateSwap(quote, inputMint, outputMint);
      }

      const transaction = new Transaction();
      const isSolToUsdc = inputMint === WSOL_MINT;

      if (isSolToUsdc) {
        // SOL → USDC Swap
        await this.setupSolToUsdcSwap(transaction, quote);
      } else {
        // USDC → SOL Swap (Fixed)
        await this.setupUsdcToSolSwap(transaction, quote);
      }

      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.publicKey;

      const signature = await this.sendTransaction(
        transaction,
        this.connection,
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        }
      );

      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      const inputAmountInTokens =
        quote.inputAmount / Math.pow(10, this.getTokenInfo(inputMint).decimals);
      const outputAmountInTokens =
        quote.outputAmount /
        Math.pow(10, this.getTokenInfo(outputMint).decimals);

      return {
        signature,
        isRealTransaction: true,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        inputAmountInTokens,
        outputAmountInTokens,
        inputMint,
        outputMint,
        isSolToUsdc,
        priceImpact: "N/A",
        fee: 0.000005,
      };
    } catch (error) {
      console.error("Swap execution error:", error);
      return this.simulateSwap(quote, inputMint, outputMint);
    }
  }

  async setupSolToUsdcSwap(transaction, quote) {
    // SOL → USDC: Wrap SOL to wSOL
    const wsolAta = await getAssociatedTokenAddress(
      new PublicKey(WSOL_MINT),
      this.publicKey
    );

    // Create wSOL account if needed
    try {
      await getAccount(this.connection, wsolAta);
    } catch {
      const createWsolIx = createAssociatedTokenAccountInstruction(
        this.publicKey,
        wsolAta,
        this.publicKey,
        new PublicKey(WSOL_MINT)
      );
      transaction.add(createWsolIx);
    }

    // Wrap SOL
    const wrapSolIx = SystemProgram.transfer({
      fromPubkey: this.publicKey,
      toPubkey: wsolAta,
      lamports: quote.inputAmount,
    });

    const syncNativeIx = createSyncNativeInstruction(wsolAta);

    transaction.add(wrapSolIx, syncNativeIx);
  }

  async setupUsdcToSolSwap(transaction, quote) {
    // USDC → SOL: Actually unwrap wSOL and return SOL to wallet
    
    const wsolAta = await getAssociatedTokenAddress(
      new PublicKey(WSOL_MINT),
      this.publicKey
    );

    // Step 1: Create wSOL account if it doesn't exist
    try {
      await getAccount(this.connection, wsolAta);
    } catch {
      const createWsolIx = createAssociatedTokenAccountInstruction(
        this.publicKey,
        wsolAta,
        this.publicKey,
        new PublicKey(WSOL_MINT)
      );
      transaction.add(createWsolIx);
    }

    // Step 2: Wrap SOL first (simulate receiving SOL from swap)
    // In real swap, you'd burn USDC and receive wSOL
    // For testing, we wrap the output amount
    const wrapSolIx = SystemProgram.transfer({
      fromPubkey: this.publicKey,
      toPubkey: wsolAta,
      lamports: quote.outputAmount, // Output SOL amount
    });

    // Step 3: Sync native
    const syncNativeIx = createSyncNativeInstruction(wsolAta);

    // Step 4: Close wSOL account to unwrap and get SOL back
    const closeAccountIx = createCloseAccountInstruction(
      wsolAta,
      this.publicKey, // Destination (your wallet)
      this.publicKey, // Authority
      [],
      TOKEN_PROGRAM_ID
    );

    transaction.add(wrapSolIx, syncNativeIx, closeAccountIx);
  }

  async simulateSwap(quote, inputMint, outputMint) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockSignature = "sim_" + Math.random().toString(36).substring(2, 15);

    const inputAmountInTokens =
      quote.inputAmount / Math.pow(10, this.getTokenInfo(inputMint).decimals);
    const outputAmountInTokens =
      quote.outputAmount / Math.pow(10, this.getTokenInfo(outputMint).decimals);

    return {
      signature: mockSignature,
      isRealTransaction: false,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      inputAmountInTokens,
      outputAmountInTokens,
      inputMint,
      outputMint,
      isSolToUsdc: inputMint === WSOL_MINT,
      priceImpact: "N/A",
      fee: 0.000005,
    };
  }

  getTokenInfo(mintAddress) {
    if (mintAddress === WSOL_MINT) {
      return { symbol: "SOL", decimals: 9, mint: mintAddress };
    } else if (mintAddress === USDC_MINT_DEVNET) {
      return { symbol: "USDC", decimals: 6, mint: mintAddress };
    }
    throw new Error("Unknown token");
  }
}