import React, { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { USDC_MINT_DEVNET } from "../constants/constant";

const TransferForm = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState("SOL");
  const [signature, setSignature] = useState("");

  const handleTransfer = async () => {
    if (!recipient || !amount) return;

    try {
      let tx;

      if (tokenType === "SOL") {
        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(recipient),
            lamports: Number(amount) * 1e9,
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
            Number(amount) * 1e6,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        tx = new Transaction().add(...instructions);
      }

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setSignature(sig);

      setAmount("");
      setRecipient("");
    } catch (err) {
      console.error("Transfer failed", err);
      setSignature(`Error: ${err.message}`);
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

      {/* Inputs */}
      <input
        placeholder="Recipient Wallet"
        className="border border-gray-700 p-3 mb-4 w-full rounded-xl bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <input
        placeholder="Amount"
        type="number"
        className="border border-gray-700 p-3 mb-4 w-full rounded-xl bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select
        value={tokenType}
        onChange={(e) => setTokenType(e.target.value)}
        className="border border-gray-700 p-3 mb-6 w-full rounded-xl bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
      >
        <option value="SOL">SOL</option>
        <option value="USDC">USDC</option>
      </select>

      <button
        onClick={handleTransfer}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-500 disabled:hover:to-pink-500"
      >
        Send Tokens
      </button>

      {/* Transaction signature */}
      {signature && (
        <div className="mt-6 p-4 bg-gray-800 border border-gray-700 rounded-xl text-gray-200 font-mono break-all">
          Transaction Signature: <br />
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-400 hover:text-blue-300"
          >
            {signature}
          </a>
        </div>
      )}
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









