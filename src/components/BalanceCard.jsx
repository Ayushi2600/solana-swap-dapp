import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getSolBalance, getTokenBalance } from "../utils/solana";
import { USDC_MINT_DEVNET } from "../constants/constant";

const BalanceCard = () => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchBalances = async () => {
    if (!connected || !publicKey) return;
    setLoading(true);
    try {
      const solBalance = await getSolBalance(connection, publicKey);
      const usdcBalance = await getTokenBalance(
        connection,
        publicKey,
        USDC_MINT_DEVNET
      );
      setSol(solBalance);
      setUsdc(usdcBalance);
    } catch (error) {
      console.error("Balance fetch failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [connected, publicKey]);

  if (!connected) return null;

  return (
    <div className="flex flex-col bg-gray-900/80 backdrop-blur-md text-white p-6 rounded-2xl shadow-2xl w-full max-w-md mx-auto border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold tracking-wide">
          Wallet Dashboard
        </h2>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg transition-colors"
        >
          {loading ? "..." : "🔄 Refresh"}
        </button>
      </div>

      {/* Wallet Address */}
      <div className="mb-6 p-4 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-lg p-4 border border-gray-500/30">
        <div className="text-sm text-gray-400 mb-1">Wallet</div>
        <div className="font-mono truncate text-lg">{publicKey.toBase58()}</div>
      </div>

      {/* Balances */}
      <div className="space-y-4">
        {/* SOL Balance */}
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">SOL</p>
              <p className="text-white text-2xl font-bold">
                {sol.toFixed(4)} SOL
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">◎</span>
            </div>
          </div>
        </div>

        {/* USDC Balance */}
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">USDC</p>
              <p className="text-white text-2xl font-bold">
                {usdc.toFixed(2)} USDC
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">$</span>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-300 text-sm">
            {" "}
            💡 <strong>Need Devnet tokens?</strong> Visit the{" "}
            <a
              href="https://faucet.solana.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              Solana Faucet
            </a>{" "}
            to get free SOL on Devnet.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;





