import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTransactions } from "../hooks/useTransactions";

export default function TransactionHistory() {
  const { publicKey } = useWallet();
  const { transactions, loading, refresh } = useTransactions(publicKey?.toBase58());

  if (!publicKey) return <p className="text-center text-gray-400 mt-4">Connect your wallet to see history.</p>;

  return (
    <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
      <div className="flex justify-between mb-2">
        <h3 className="text-lg font-semibold text-white">Transaction History</h3>
        <button onClick={refresh} className="text-sm text-blue-400">Refresh</button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500">No transactions yet.</p>
      ) : (
        <ul className="space-y-3">
          {transactions.map((tx) => (
            <li key={tx.signature} className="p-3 bg-gray-800 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-white font-semibold">{tx.type.toUpperCase()}</p>
                <p className="text-xs text-gray-400">{new Date(tx.timestamp * 1000).toLocaleString()}</p>
              </div>
              <div className="text-right">
                {tx.tokenChanges.map((t, idx) => (
                  <p key={idx} className="text-white text-sm">
                    {t.amount} {t.tokenSymbol}
                  </p>
                ))}
                <a href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-xs hover:text-blue-300">
                  🔍 View
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}



