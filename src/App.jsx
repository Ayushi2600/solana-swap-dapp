import { useState } from "react";
import BalanceCard from "./components/BalanceCard";
import TransferForm from "./components/TransferForm";
import SwapForm from "./components/SwapForm";
import { WalletContextProvider } from "./context/WalletContext";
import { HiMenu, HiX } from "react-icons/hi";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import TransactionHistory from "./components/TransactionHistory";
import { Toaster } from "react-hot-toast";

const App = () => {
  const [activeTab, setActiveTab] = useState("wallet");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState([]);

  // Handle new transaction completion
  const handleTransactionComplete = (txData) => {
    setTransactionHistory(prev => [txData, ...prev]);
  };

  return (
    <WalletContextProvider>
      <div className="flex min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-800 text-white relative">
        <Toaster position="top-right" />
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-full w-60 bg-gray-900/80 backdrop-blur-md p-6 flex flex-col gap-6 shadow-lg border-r border-gray-800 rounded-r-2xl z-50 transform transition-transform duration-300
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:translate-x-0`}
        >
          <h2 className="text-2xl font-bold mb-6 text-purple-400">Dashboard</h2>

          {["wallet", "transfer", "swap", "history"].map((tab) => (
            <button
              key={tab}
              className={`p-3 rounded-lg text-lg font-medium transition-all ${activeTab === tab
                ? "bg-purple-600/80 text-white shadow-md"
                : "hover:bg-gray-800/50 text-gray-300"
                }`}
              onClick={() => {
                setActiveTab(tab);
                setSidebarOpen(false);
              }}
            >
              {tab === "wallet"
                ? "Wallet Info"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </aside>

        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-60">
          {/* Header */}
          <header className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 relative z-50 sticky top-0">
            {/* Hamburger (mobile) */}
            <button
              className="lg:hidden text-2xl p-2 bg-gray-800/50 rounded-md backdrop-blur-sm z-50"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <HiX /> : <HiMenu />}
            </button>

            {/* Title */}
            <h1 className="text-2xl font-bold text-purple-400 text-center flex-1 lg:flex-none">
              Solana DApp
            </h1>

            {/* Phantom Wallet */}
            <div className="ml-auto relative z-50">
              <WalletMultiButton className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-semibold" />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 p-8 overflow-auto bg-gray-900/70 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto flex flex-col gap-8">
              {activeTab === "wallet" && (
                <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 relative z-10">
                  <BalanceCard />
                </div>
              )}
              {activeTab === "transfer" && (
                <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 relative z-10">
                  <TransferForm onTransactionComplete={handleTransactionComplete} />
                </div>
              )}
              {activeTab === "swap" && (
                <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 relative z-10">
                  <SwapForm onTransactionComplete={handleTransactionComplete} />
                </div>
              )}
              {activeTab === "history" && (
                <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 relative z-10">
                  <TransactionHistory
                    transactions={transactionHistory}
                    onAddTransaction={handleTransactionComplete}
                  />
                </div>
              )}
            </div>
          </main>
          {/* Footer */}
          <footer className="mt-20 py-6 text-center text-gray-500 border-t border-gray-800">
            <p className="text-sm">
              Built with ❤️ on Solana Devnet | Powered by Raydium SDK v2
            </p>
            <div className="mt-2 flex justify-center space-x-4 text-xs">
              <a href="https://solana.com" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400">
                Solana Docs
              </a>
              <span>•</span>
              <a href="https://raydium.io" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400">
                Raydium
              </a>
              <span>•</span>
              <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400">
                Devnet Faucet
              </a>
            </div>
          </footer>
        </div>
      </div>
    </WalletContextProvider>
  );
};

export default App;