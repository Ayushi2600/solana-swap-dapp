import React, { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import {WSOL_MINT, USDC_MINT_DEVNET } from "../constants/constant";
import toast from "react-hot-toast";
import { createTransactionRecord } from "../services/transactionAPI";

const TransferForm = ({ onTransactionComplete }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState("SOL");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState({ sol: 0, usdc: 0 });

  // Fetch balances
  const fetchBalances = async () => {
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
      console.error("Balance fetch failed", err);
    }
  };

  React.useEffect(() => {
    if (connected && publicKey) {
      fetchBalances();
    }
  }, [connected, publicKey]);

  const handleTransfer = async () => {
    if (!recipient || !amount) {
      toast.error("Please enter recipient and amount");
      return;
    }

    // Validate recipient address
    try {
      new PublicKey(recipient);
    } catch {
      toast.error("Invalid recipient address");
      return;
    }

    const transferAmount = Number(amount);
    if (transferAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    // Check balance
    const currentBalance = tokenType === "SOL" ? balances.sol : balances.usdc;
    if (transferAmount > currentBalance) {
      toast.error(`Insufficient ${tokenType} balance`);
      return;
    }
    setLoading(true);

    try {
      let tx;
      let fee = 0.000005; // Approximate fee

      if (tokenType === "SOL") {
        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(recipient),
            lamports: transferAmount * 1e9,
          })
        );
      } else {
        const usdcMint = new PublicKey(USDC_MINT_DEVNET);
        const fromTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          publicKey
        );
        const toTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          new PublicKey(recipient)
        );

        const instructions = [];
        const accountInfo = await connection.getAccountInfo(toTokenAccount);
        if (!accountInfo) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              toTokenAccount,
              new PublicKey(recipient),
              usdcMint
            )
          );
        }

        instructions.push(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            publicKey,
            transferAmount * 1e6,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        tx = new Transaction().add(...instructions);
      }

      const sig = await sendTransaction(tx, connection);
      toast.loading("Confirming transaction...");

      const confirmation = await connection.confirmTransaction(sig, "confirmed");

      if (confirmation.value.err) {
        throw new Error("Transaction failed");
      }

      setSignature(sig);
      toast.dismiss();
      toast.success(`${tokenType} transfer successful!`);

      // Create transaction record
      const transactionData = {
        walletAddress: publicKey.toBase58(),
        signature: sig,
        type: "transfer",
        tokenChanges: [
          { amount: transferAmount, tokenSymbol: tokenType }
        ],
        status: "confirmed",
        timestamp: Math.floor(Date.now() / 1000),
        explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`
      };

      transactionData.isRealTransaction = true; // transfer hamesha real hota
      transactionData.inputMint = tokenType === "SOL" ? WSOL_MINT : USDC_MINT_DEVNET;
      transactionData.outputMint = tokenType === "SOL" ? WSOL_MINT : USDC_MINT_DEVNET;
      transactionData.fee = 0.000005;
      transactionData.priceImpact = "N/A";


      // Call backend to save transaction
      await createTransactionRecord(transactionData);

      // Notify parent component
      if (onTransactionComplete) {
        onTransactionComplete(transactionData);
      }

      // Update local balances
      if (tokenType === "SOL") {
        setBalances(prev => ({
          ...prev,
          sol: Math.max(0, prev.sol - transferAmount - fee)
        }));
      } else {
        setBalances(prev => ({
          ...prev,
          usdc: Math.max(0, prev.usdc - transferAmount),
          sol: prev.sol - fee // Deduct fee from SOL
        }));
      }

      // Refresh actual balances after a delay
      setTimeout(() => fetchBalances(), 2000);

      // Reset form
      setAmount("");
      setRecipient("");

    } catch (err) {
      console.error("Transfer failed", err);
      toast.dismiss();
      toast.error(`❌ Transfer failed: ${err.message}`);
      setSignature(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="p-6 bg-gray-900/70 border border-gray-700 text-white rounded-2xl shadow-lg text-center">
        Connect your wallet to transfer tokens.
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto p-8 bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700">
      <h3 className="mb-6 text-2xl font-bold text-center tracking-wide">
        Transfer Tokens
      </h3>

      {/* Balance Display */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <div className="text-sm text-gray-400 mb-2">Your Balances</div>
        <div className="flex justify-between text-white">
          <span>SOL: {balances.sol.toFixed(4)}</span>
          <span>USDC: {balances.usdc.toFixed(4)}</span>
        </div>
      </div>

      {/* Token Type Selection */}
      <div className="mb-4">
        <label className="block text-gray-400 text-sm mb-2">Select Token</label>
        <select
          value={tokenType}
          onChange={(e) => setTokenType(e.target.value)}
          className="border border-gray-700 p-3 w-full rounded-xl bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
        >
          <option value="SOL">SOL</option>
          <option value="USDC">USDC (Devnet)</option>
        </select>
      </div>

      {/* Recipient Input */}
      <div className="mb-4">
        <label className="block text-gray-400 text-sm mb-2">Recipient Wallet Address</label>
        <input
          placeholder="Enter Solana wallet address"
          className="border border-gray-700 p-3 w-full rounded-xl bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-gray-400 text-sm mb-2">Amount</label>
        <div className="relative">
          <input
            placeholder={`Enter amount in ${tokenType}`}
            type="number"
            step="0.000001"
            className="border border-gray-700 p-3 w-full rounded-xl bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            onClick={() => setAmount((tokenType === "SOL"
              ? Math.max(0, balances.sol - 0.001)
              : balances.usdc).toFixed(6))}
            className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Transfer Button */}
      <button
        onClick={handleTransfer}
        disabled={loading || !recipient || !amount}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-500 disabled:hover:to-pink-500"
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Sending...
          </div>
        ) : (
          `Send ${tokenType}`
        )}
      </button>

      {/* Transaction signature */}
      {signature && !signature.startsWith("Error") && (
        <div className="mt-6 p-4 bg-green-900 border border-green-700 rounded-xl">
          <div className="text-green-200 font-semibold mb-2">
            Transaction Successful
          </div>
          <div className="text-gray-300 font-mono text-sm break-all mb-3">
            Signature: {signature}
          </div>
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            View in Solana Explorer →
          </a>
        </div>
      )}

      {/* Error Message */}
      {signature && signature.startsWith("Error") && (
        <div className="mt-6 p-4 bg-red-900 border border-red-700 rounded-xl text-red-200">
          {signature}
        </div>
      )}

      {/* Fee Info */}
      <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-300 text-sm">
          <strong>Transaction Fee:</strong> ~0.000005 SOL (~$0.0001)
        </p>
        <p className="text-blue-400 text-xs mt-1">
          Make sure you have enough SOL for transaction fees
        </p>
      </div>
    </div>
  );
};

export default TransferForm;