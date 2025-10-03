import React, { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getSwapQuote, executeSwap } from "../utils/swapUtils";
import toast from "react-hot-toast";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { WSOL_MINT, USDC_MINT_DEVNET } from "../constants/constant";

const SwapForm = () => {
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

  // 🪙 Fetch balances
  useEffect(() => {
    if (!connected || !publicKey) return;

    const fetchBalances = async () => {
      try {
        const solBalance = (await connection.getBalance(publicKey)) / 1e9;

        const usdcMintPubkey = new PublicKey(USDC_MINT_DEVNET);
        const usdcATA = await getAssociatedTokenAddress(
          usdcMintPubkey,
          publicKey
        );
        let usdcBalance = 0;

        try {
          const accountInfo = await getAccount(connection, usdcATA);
          usdcBalance = Number(accountInfo.amount) / 1e6;
        } catch {
          usdcBalance = 0;
        }

        setBalances({ sol: solBalance, usdc: usdcBalance });
      } catch (err) {
        console.error("Balance fetch failed", err);
      }
    };

    fetchBalances();
  }, [connected, publicKey, connection]);

  // 🔍 Fetch quote from Jupiter
  const getQuote = useCallback(
    async (inputMint, outputMint, amount) => {
      if (!amount || parseFloat(amount) <= 0) return null;

      try {
        setSwapData({ quote: null, loading: true, error: null });

        const amountInSmallestUnit = Math.floor(
          parseFloat(amount) * Math.pow(10, tokens[formData.fromToken].decimals)
        );

        const quote = await getSwapQuote(
          inputMint,
          outputMint,
          amountInSmallestUnit
        );
        setSwapData({ quote, loading: false, error: null });
      } catch (err) {
        setSwapData({ quote: null, loading: false, error: err.message });
      }
    },
    [formData.fromToken, tokens]
  );

  // 🔁 Execute swap
  const handleSwap = async () => {
    if (!swapData.quote || !publicKey) {
      toast.error("No quote or wallet not connected");
      return;
    }

    setIsSwapping(true);
    try {
      const sig = await executeSwap(
        swapData.quote,
        publicKey.toString(),
        connection,
        sendTransaction
      );
      if (!sig) throw new Error("Transaction failed");
      toast.success(`Swap success! Tx: ${sig.slice(0, 8)}...`);
      setFormData((f) => ({ ...f, amount: "" }));
      setSwapData({ quote: null, loading: false, error: null });
    } catch (err) {
      toast.error(`Swap failed: ${err.message}`);
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

  if (!connected)
    return (
      <p className="text-center text-gray-300 mt-6">
        Connect your wallet to use Swap
      </p>
    );

  const fromTokenData = tokens[formData.fromToken];
  const toTokenData = tokens[formData.toToken];
  const inputAmount = parseFloat(formData.amount) || 0;
  const outputAmount =
    swapData.quote && swapData.quote.outAmount
      ? parseFloat(swapData.quote.outAmount) /
        Math.pow(10, toTokenData.decimals)
      : 0;

  return (
    <div className="p-6 w-full max-w-md mx-auto bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl">
      <h3 className="text-2xl font-semibold text-white mb-6 text-center">
        Swap Tokens
      </h3>

      {/* FROM TOKEN */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between text-gray-400 text-sm mb-2">
          <span>From</span>
          <span>Balance: {fromTokenData.balance.toFixed(4)}</span>
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
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
          />
        </div>
      </div>

      {/* SWITCH BUTTON */}
      <div className="flex justify-center mb-4">
        <button
          onClick={handleTokenSwap}
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full"
        >
          ⇅
        </button>
      </div>

      {/* TO TOKEN */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between text-gray-400 text-sm mb-2">
          <span>To</span>
          <span>Balance: {toTokenData.balance.toFixed(4)}</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-700 rounded-lg px-3 py-2 space-x-2">
            <span className="text-xl">{toTokenData.icon}</span>
            <span className="font-semibold">{toTokenData.symbol}</span>
          </div>
          <div className="flex-1 text-right text-xl text-white">
            {swapData.loading ? "Loading..." : outputAmount.toFixed(4)}
          </div>
        </div>
      </div>

      {/* GET QUOTE BUTTON */}
      <button
        onClick={() =>
          getQuote(fromTokenData.mint, toTokenData.mint, formData.amount)
        }
        disabled={!formData.amount || parseFloat(formData.amount) <= 0}
        className="w-full py-2 mb-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
      >
        Get Quote
      </button>

      {/* SWAP BUTTON */}
      <button
        onClick={handleSwap}
        disabled={
          isSwapping ||
          !swapData.quote ||
          inputAmount <= 0 ||
          inputAmount > fromTokenData.balance
        }
        className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-semibold"
      >
        {isSwapping ? "Swapping..." : "Swap"}
      </button>

      <p className="text-xs text-center text-gray-500 mt-3">
        Powered by{" "}
        <a
          href="https://jup.ag"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300"
        >
          Jupiter (Devnet)
        </a>
      </p>
    </div>
  );
};

export default SwapForm;






