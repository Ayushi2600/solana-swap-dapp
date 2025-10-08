import React, { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { WSOL_MINT, USDC_MINT_DEVNET } from "../constants/constant";
import { WorkingSwap } from "../utils/workingSwapUtils";
import { RaydiumSwap } from "../utils/raydiumSwapUtils";
import { createTransactionRecord } from "../services/transactionAPI";

const SwapForm = ({ onTransactionComplete }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [formData, setFormData] = useState({
    fromToken: "SOL",
    toToken: "USDC",
    amount: "",
  });

  const [swapData, setSwapData] = useState({
    quote: null,
    loading: false,
    error: null,
  });

  const [isSwapping, setIsSwapping] = useState(false);
  const [balances, setBalances] = useState({ sol: 0, usdc: 0 });
  const [lastTransaction, setLastTransaction] = useState(null);
  const [useRaydium, setUseRaydium] = useState(false);

  const tokens = {
    SOL: {
      mint: WSOL_MINT,
      decimals: 9,
      symbol: "SOL",
      icon: "◎",
      balance: balances.sol,
    },
    USDC: {
      mint: USDC_MINT_DEVNET,
      decimals: 6,
      symbol: "USDC",
      icon: "$",
      balance: balances.usdc,
    },
  };

  // Refresh balances function
  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
      const solBalance = (await connection.getBalance(publicKey)) / 1e9;

      const usdcMintPubkey = new PublicKey(USDC_MINT_DEVNET);
      const usdcATA = await getAssociatedTokenAddress(usdcMintPubkey, publicKey);
      let usdcBalance = 0;

      try {
        const accountInfo = await getAccount(connection, usdcATA);
        usdcBalance = Number(accountInfo.amount) / 1e6;
      } catch {
        usdcBalance = 0;
      }

      setBalances({ sol: solBalance, usdc: usdcBalance });

    } catch (err) {
      console.error("Balance refresh failed", err);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (lastTransaction?.isRealTransaction) {
      // Refresh balances after a real transaction
      const timer = setTimeout(() => {
        refreshBalances();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastTransaction]);

  useEffect(() => {
    if (connected && publicKey) {
      refreshBalances();
    }
  }, [connected, publicKey, refreshBalances]);

  // Get swap quote
  const getQuote = useCallback(async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setSwapData({ quote: null, loading: false, error: "Please enter a valid amount" });
      return;
    }

    if (!publicKey) {
      setSwapData({ quote: null, loading: false, error: "Wallet not connected" });
      return;
    }

    try {
      setSwapData({ quote: null, loading: true, error: null });

      const inputAmount = parseFloat(formData.amount);
      const amountInSmallestUnit = Math.floor(
        inputAmount * Math.pow(10, tokens[formData.fromToken].decimals)
      );

      let quote;

      if (useRaydium) {
        // Use Raydium SDK with fallback
        try {
          const raydiumSwap = new RaydiumSwap(connection, publicKey, sendTransaction);
          quote = await raydiumSwap.getQuote(
            fromTokenData.mint,
            toTokenData.mint,
            amountInSmallestUnit
          );

          if (quote.isRaydium) {
            toast.success("Raydium quote received!");
          } else {
            toast.success("Manual quote (Raydium fallback)");
          }
        } catch (error) {
          console.error("Raydium failed:", error);
          // Fallback to manual
          const workingSwap = new WorkingSwap(connection, publicKey, sendTransaction);
          quote = await workingSwap.getQuote(
            fromTokenData.mint,
            toTokenData.mint,
            amountInSmallestUnit
          );
          toast.success("Manual quote (Raydium unavailable)");
        }
      } else {
        // Use manual swap
        const workingSwap = new WorkingSwap(connection, publicKey, sendTransaction);
        quote = await workingSwap.getQuote(
          fromTokenData.mint,
          toTokenData.mint,
          amountInSmallestUnit
        );
        toast.success("Manual quote received!");
      }

      setSwapData({
        quote,
        loading: false,
        error: null
      });

    } catch (err) {
      setSwapData({
        quote: null,
        loading: false,
        error: err.message
      });
      toast.error(`Quote failed: ${err.message}`);
    }
  }, [formData, connection, publicKey, sendTransaction, tokens, useRaydium]);

  // Execute swap 
  const handleSwap = async () => {
    if (!swapData.quote || !publicKey) {
      toast.error("No quote or wallet not connected");
      return;
    }

    setIsSwapping(true);

    const currentBalances = { ...balances };

    try {
      let result;

      if (useRaydium && swapData.quote.poolKeys) {
        // Execute Raydium swap
        const raydiumSwap = new RaydiumSwap(connection, publicKey, sendTransaction);
        result = await raydiumSwap.executeSwap(
          swapData.quote,
          fromTokenData.mint,
          toTokenData.mint
        );
      } else {
        // Execute manual swap
        const workingSwap = new WorkingSwap(connection, publicKey, sendTransaction);
        result = await workingSwap.executeSwap(
          swapData.quote,
          fromTokenData.mint,
          toTokenData.mint
        );
      }

      // Calculate actual token amounts
      const inputAmountInTokens = result.inputAmount / Math.pow(10, fromTokenData.decimals);
      const outputAmountInTokens = result.outputAmount / Math.pow(10, toTokenData.decimals);

      let newBalances = { ...currentBalances };

      if (fromTokenData.symbol === "SOL" && toTokenData.symbol === "USDC") {
        // SOL → USDC
        newBalances.sol = Math.max(0, currentBalances.sol - inputAmountInTokens);
        newBalances.usdc = currentBalances.usdc + outputAmountInTokens;
      } else if (fromTokenData.symbol === "USDC" && toTokenData.symbol === "SOL") {
        // USDC → SOL
        newBalances.sol = currentBalances.sol + outputAmountInTokens;
        newBalances.usdc = Math.max(0, currentBalances.usdc - inputAmountInTokens);
      }
      const sig = result.signature || result.txid;

      const transactionDetails = {
        walletAddress: publicKey.toBase58(),
        signature: sig,
        type: "swap",
        tokenChanges: [
          { amount: inputAmountInTokens, tokenSymbol: fromTokenData.symbol },   // token sent
          { amount: outputAmountInTokens, tokenSymbol: toTokenData.symbol }     // token received
        ],
        status: "confirmed",
        timestamp: Math.floor(Date.now() / 1000),
        explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
      };

      // optional
      transactionDetails.isRealTransaction = result.isRealTransaction;
      transactionDetails.inputMint = fromTokenData.mint;
      transactionDetails.outputMint = toTokenData.mint;
      transactionDetails.fee = result.fee;
      transactionDetails.priceImpact = result.priceImpact;

      await createTransactionRecord(transactionDetails);

      setLastTransaction(transactionDetails);

      // UPDATE UI BALANCES IMMEDIATELY
      setBalances(newBalances);

      // Notify parent component
      if (onTransactionComplete) {
        onTransactionComplete(transactionDetails);
      }

      if (result.isRealTransaction) {
        toast.success(
          <div>
            <div>REAL Swap Successful!</div>
            <div className="text-xs">Using {useRaydium ? "Raydium" : "Manual"} Swap</div>
          </div>
        );

        setTimeout(() => refreshBalances(), 2000);
      } else {
        toast.success(
          <div>
            <div>Simulation Successful!</div>
            <div className="text-xs">Balances updated locally</div>
          </div>
        );
      }
      // Reset form
      setFormData({ ...formData, amount: "" });
      setSwapData({ quote: null, loading: false, error: null });

    } catch (err) {
      console.error("Swap error:", err);
      toast.error(`❌ Swap failed: ${err.message}`);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleTokenSwap = () => {
    setFormData((prev) => ({
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      amount: "",
    }));
    setSwapData({ quote: null, loading: false, error: null });
  };

  const setMaxAmount = () => {
    const maxAmount = Math.max(0, fromTokenData.balance - 0.001);
    setFormData({ ...formData, amount: maxAmount.toFixed(6) });
  };

  const handleRefreshBalances = async () => {
    toast.loading("Refreshing balances...");
    await refreshBalances();
    toast.dismiss();
    toast.success("Balances updated!");
  };

  const clearLastTransaction = () => {
    setLastTransaction(null);
  };

  if (!connected)
    return (
      <p className="text-center text-gray-300 mt-6">
        Connect your wallet to use Swap
      </p>
    );

  const fromTokenData = tokens[formData.fromToken];
  const toTokenData = tokens[formData.toToken];
  const inputAmount = parseFloat(formData.amount) || 0;

  const outputAmount = swapData.quote && swapData.quote.outputAmount
    ? parseFloat(swapData.quote.outputAmount.toString()) / Math.pow(10, toTokenData.decimals)
    : 0;

  return (
    <div className="p-6 w-full max-w-md mx-auto bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl">
      <h3 className="text-2xl font-semibold text-white mb-6 text-center">
        Swap Tokens
      </h3>

      {/* Swap Mode Toggle */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Swap Mode:</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setUseRaydium(false)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${!useRaydium
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
            >
              Manual (Testing)
            </button>
            <button
              onClick={() => setUseRaydium(true)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${useRaydium
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
            >
              Raydium (Real)
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {useRaydium
            ? "Uses real Raydium liquidity pools (may fail on devnet)"
            : "Manual swap for testing purposes"}
        </p>
      </div>

      {/* Balance Refresh Button */}
      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={handleRefreshBalances}
          className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
        >
          🔄 Refresh Balances
        </button>
        <div className="text-xs text-gray-400">
          SOL: {balances.sol.toFixed(4)} | USDC: {balances.usdc.toFixed(4)}
        </div>
      </div>

      {/* Last Transaction Details */}
      {lastTransaction && (
        <div className={`mb-4 p-4 rounded-lg border ${lastTransaction.isRealTransaction
          ? 'bg-green-900 border-green-700'
          : 'bg-yellow-900 border-yellow-700'
          }`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className={`font-semibold ${lastTransaction.isRealTransaction ? 'text-green-200' : 'text-yellow-200'
                }`}>
                {lastTransaction.isRealTransaction ? 'Transaction Successful' : 'Simulation Complete'}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {lastTransaction.timestamp
                  ? new Date(lastTransaction.timestamp * 1000).toLocaleString()
                  : ""}
              </p>
            </div>
            <button
              onClick={clearLastTransaction}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Swapped:</span>
              <span className="text-white">
                {(lastTransaction?.inputAmount ?? 0).toFixed(4)} {lastTransaction?.fromToken ?? ""}
                →
                {(lastTransaction?.outputAmount ?? 0).toFixed(4)} {lastTransaction?.toToken ?? ""}

              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Price Impact:</span>
              <span className="text-white">{lastTransaction.priceImpact}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Fee:</span>
              <span className="text-white">{(lastTransaction?.fee ?? 0).toFixed(6)} SOL</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Signature:</span>
              <div className="flex items-center space-x-2">
                <code className="text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                  {lastTransaction.signature.slice(0, 8)}...{lastTransaction.signature.slice(-8)}
                </code>
                {lastTransaction.isRealTransaction && (
                  <a
                    href={lastTransaction.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs"
                    title="View on Solana Explorer"
                  >
                    🔍
                  </a>
                )}
              </div>
            </div>

            {lastTransaction.isRealTransaction ? (
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-green-400">Confirmed on Devnet</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-yellow-400">Simulation Only</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FROM TOKEN */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between text-gray-400 text-sm mb-2">
          <span>From</span>
          <div className="flex items-center space-x-2">
            <span>Balance: {(fromTokenData?.balance ?? 0).toFixed(4)}</span>
            <button
              onClick={setMaxAmount}
              className="text-blue-400 hover:text-blue-300 text-xs bg-blue-900 px-2 py-1 rounded"
            >
              MAX
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-700 rounded-lg px-3 py-2 space-x-2">
            <span className="text-xl">{fromTokenData.icon}</span>
            <span className="font-semibold">{fromTokenData.symbol}</span>
          </div>
          <input
            type="number"
            placeholder="0.0"
            className="flex-1 text-right bg-transparent text-xl text-white outline-none"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>
      </div>

      {/* SWITCH BUTTON */}
      <div className="flex justify-center mb-4">
        <button
          onClick={handleTokenSwap}
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-colors"
        >
          ⇅
        </button>
      </div>

      {/* TO TOKEN */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between text-gray-400 text-sm mb-2">
          <span>To</span>
          <span>Balance: {(toTokenData?.balance ?? 0).toFixed(4)}</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-700 rounded-lg px-3 py-2 space-x-2">
            <span className="text-xl">{toTokenData.icon}</span>
            <span className="font-semibold">{toTokenData.symbol}</span>
          </div>
          <div className="flex-1 text-right text-xl text-white">
            {swapData.loading ? "Loading..." : outputAmount.toFixed(6)}
          </div>
        </div>
        {swapData.quote && (
          <div className="mt-2 text-xs text-gray-400">
            Rate: 1 {fromTokenData.symbol} = {swapData.quote.exchangeRate} {toTokenData.symbol}
            {swapData.quote.priceImpact && (
              <span className="ml-2">| Impact: {swapData.quote.priceImpact}</span>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {swapData.error && (
        <div className="mb-3 p-2 bg-red-900 border border-red-700 rounded text-red-200 text-sm">
          {swapData.error}
        </div>
      )}

      {/* GET QUOTE BUTTON */}
      <button
        onClick={getQuote}
        disabled={!formData.amount || parseFloat(formData.amount) <= 0 || swapData.loading}
        className="w-full py-3 mb-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 transition-colors"
      >
        {swapData.loading ? "Getting Quote..." : "Get Quote"}
      </button>

      {/* SWAP BUTTON */}
      <button
        onClick={handleSwap}
        disabled={isSwapping || !swapData.quote || inputAmount <= 0 || inputAmount > fromTokenData.balance}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-semibold disabled:opacity-50 transition-opacity"
      >
        {isSwapping ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing...
          </div>
        ) : (
          `Swap ${fromTokenData.symbol} for ${toTokenData.symbol}`
        )}
      </button>

      {/* Current Quote Info */}
      {swapData.quote && (
        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400">
            <div className="flex justify-between">
              <span>You pay:</span>
              <span>{inputAmount.toFixed(6)} {fromTokenData.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>You receive:</span>
              <span>{outputAmount.toFixed(6)} {toTokenData.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange Rate:</span>
              <span>1 {fromTokenData.symbol} = {swapData.quote.exchangeRate} {toTokenData.symbol}</span>
            </div>
            {swapData.quote.priceImpact && (
              <div className="flex justify-between">
                <span>Price Impact:</span>
                <span>{swapData.quote.priceImpact}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-center text-gray-500 mt-3">
        Powered by{" "}
        <a
          href="https://solana.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300"
        >
          Solana Devnet
        </a>
        {useRaydium && " & Raydium"}
      </p>
    </div>
  );
};

export default SwapForm;