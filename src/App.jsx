import { useState } from "react";
import BalanceCard from "./components/BalanceCard";
import TransferForm from "./components/TransferForm";
import SwapForm from "./components/SwapForm";
import { WalletContextProvider } from "./context/WalletContext";
import { HiMenu, HiX } from "react-icons/hi";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const App = () => {
  const [activeTab, setActiveTab] = useState("wallet");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WalletContextProvider>
      <div className="flex min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-800 text-white relative">
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
            ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:translate-x-0`}
        >
          <h2 className="text-2xl font-bold mb-6 text-purple-400">Dashboard</h2>

          {["wallet", "transfer", "swap"].map((tab) => (
            <button
              key={tab}
              className={`p-3 rounded-lg text-lg font-medium transition-all ${
                activeTab === tab
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
                  <TransferForm />
                </div>
              )}
              {activeTab === "swap" && (
                <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl shadow-lg p-6 relative z-10">
                  <SwapForm />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </WalletContextProvider>
  );
};

export default App;






