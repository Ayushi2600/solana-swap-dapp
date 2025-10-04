import React, { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { WSOL_MINT, USDC_MINT_DEVNET } from "../constants/constant";
import { WorkingSwap } from "../utils/workingSwapUtils";

const SwapForm = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected, wallet } = useWallet();

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
  const [lastTransactionType, setLastTransactionType] = useState(''); // 'real' or 'simulation'

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
        // Fetch SOL balance
        const solBalance = (await connection.getBalance(publicKey)) / 1e9;

        // Fetch USDC balance
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
        console.error("Balance fetch failed", err);
      }
    };

    fetchBalances();
  }, [connected, publicKey, connection]);

  // 🔍 Get swap quote
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

      const workingSwap = new WorkingSwap(connection, publicKey, sendTransaction);
      const amountInSmallestUnit = Math.floor(
        parseFloat(formData.amount) * Math.pow(10, tokens[formData.fromToken].decimals)
      );

      const quote = await workingSwap.getQuote(
        fromTokenData.mint,
        toTokenData.mint,
        amountInSmallestUnit
      );

      setSwapData({ 
        quote, 
        loading: false, 
        error: null 
      });
      
      toast.success("Quote received!");
    } catch (err) {
      setSwapData({ 
        quote: null, 
        loading: false, 
        error: err.message 
      });
      toast.error(`Quote failed: ${err.message}`);
    }
  }, [formData, connection, publicKey, sendTransaction, tokens]);

  // 🔁 Execute REAL swap
  const handleSwap = async () => {
    if (!swapData.quote || !publicKey) {
      toast.error("No quote or wallet not connected");
      return;
    }

    setIsSwapping(true);
    setLastTransactionType('');
    
    try {
      const workingSwap = new WorkingSwap(connection, publicKey, sendTransaction);
      const signature = await workingSwap.executeSwap(
        swapData.quote,
        fromTokenData.mint,
        toTokenData.mint
      );

      // Determine if it was a real transaction or simulation
      const isRealTransaction = signature.length === 88; // Real Solana signatures are 88 chars
      setLastTransactionType(isRealTransaction ? 'real' : 'simulation');

      if (isRealTransaction) {
        toast.success(
          <div>
            <div>✅ REAL Swap Successful!</div>
            <div className="text-xs">Signature: {signature.slice(0, 16)}...</div>
            <div className="text-xs mt-1">
              <a 
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 underline"
              >
                View on Explorer
              </a>
            </div>
          </div>
        );

        // Refresh balances after real transaction
        setTimeout(async () => {
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
            console.error("Failed to refresh balances:", err);
          }
        }, 2000);
      } else {
        toast.success(
          <div>
            <div>🔄 Swap Simulation Successful!</div>
            <div className="text-xs">Mock Signature: {signature.slice(0, 16)}...</div>
            <div className="text-xs mt-1 text-yellow-300">
              This was a simulation. Balances updated in UI only.
            </div>
          </div>
        );

        // Update UI balances for simulation
        const inputAmount = parseFloat(formData.amount);
        const outputAmount = swapData.quote.outputAmount / Math.pow(10, toTokenData.decimals);
        
        if (formData.fromToken === "SOL") {
          setBalances(prev => ({
            sol: Math.max(0, prev.sol - inputAmount),
            usdc: prev.usdc + outputAmount
          }));
        } else {
          setBalances(prev => ({
            sol: prev.sol + outputAmount,
            usdc: Math.max(0, prev.usdc - inputAmount)
          }));
        }
      }
      
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

  // Set max amount (leave some for fees)
  const setMaxAmount = () => {
    const maxAmount = Math.max(0, fromTokenData.balance - 0.001);
    setFormData({ ...formData, amount: maxAmount.toFixed(6) });
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
  
  // Calculate output amount
  const outputAmount = swapData.quote && swapData.quote.outputAmount
    ? parseFloat(swapData.quote.outputAmount.toString()) / Math.pow(10, toTokenData.decimals)
    : 0;

  return (
    <div className="p-6 w-full max-w-md mx-auto bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl">
      <h3 className="text-2xl font-semibold text-white mb-6 text-center">
        Swap Tokens
      </h3>

      {/* Transaction Mode Indicator */}
      {lastTransactionType && (
        <div className={`mb-4 p-3 rounded-lg border ${
          lastTransactionType === 'real' 
            ? 'bg-green-900 border-green-700' 
            : 'bg-yellow-900 border-yellow-700'
        }`}>
          <p className={`text-sm text-center ${
            lastTransactionType === 'real' ? 'text-green-200' : 'text-yellow-200'
          }`}>
            <strong>
              {lastTransactionType === 'real' ? '✅ REAL Transaction' : '🔄 SIMULATION Mode'}
            </strong>
          </p>
          <p className="text-xs text-center mt-1 text-gray-300">
            {lastTransactionType === 'real' 
              ? 'Transaction was sent to blockchain' 
              : 'UI simulation only - no blockchain transaction'
            }
          </p>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-4 p-3 bg-blue-900 border border-blue-700 rounded-lg">
        <p className="text-blue-200 text-sm text-center">
          <strong>Smart Mode:</strong> Tries real transactions, falls back to simulation
        </p>
      </div>

      {/* FROM TOKEN */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between text-gray-400 text-sm mb-2">
          <span>From</span>
          <div className="flex items-center space-x-2">
            <span>Balance: {fromTokenData.balance.toFixed(4)}</span>
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
          <span>Balance: {toTokenData.balance.toFixed(4)}</span>
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

      {/* Transaction Info */}
      {swapData.quote && (
        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400">
            <div className="flex justify-between">
              <span>Input:</span>
              <span>{inputAmount} {fromTokenData.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Output:</span>
              <span>{outputAmount.toFixed(6)} {toTokenData.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange Rate:</span>
              <span>1 {fromTokenData.symbol} = {swapData.quote.exchangeRate} {toTokenData.symbol}</span>
            </div>
            <div className="mt-2 text-xs text-yellow-400">
              {sendTransaction ? 
                "Will attempt real transaction with Phantom" : 
                "Simulation mode - no wallet connection"
              }
            </div>
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
      </p>
    </div>
  );
};

export default SwapForm;