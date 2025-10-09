import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTransactions } from "../hooks/useTransactions";

export default function TransactionHistory() {
  const { publicKey } = useWallet();
  const { transactions, loading, refresh } = useTransactions(publicKey?.toBase58());

  if (!publicKey)
    return (
      <p className="text-center text-gray-400 mt-4">
        Connect your wallet to see history.
      </p>
    );

  return (
    <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Transaction History</h3>
        <button onClick={refresh} className="text-sm text-blue-400 hover:underline">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs uppercase bg-gray-800 text-gray-300">
              <tr>
                <th className="px-4 py-3">Tx Hash</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.signature} className="border-b border-gray-700 hover:bg-gray-800">
                  <td className="px-4 py-2">
                    <a
                      href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-white font-semibold">
                    {tx.type.toUpperCase()}
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {tx.from ? tx.from.slice(0, 6) + "..." + tx.from.slice(-6) : "-"}
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {tx.to ? tx.to.slice(0, 6) + "..." + tx.to.slice(-6) : "-"}
                  </td>
                  <td className="px-4 py-2 text-white">
                    {tx.value ? tx.value.toFixed(4) + " SOL" : "-"} {tx.tokenSymbol}
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {new Date(tx.timestamp * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
