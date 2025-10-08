import { useState, useEffect } from "react";
import { getTransactionHistory } from "../services/transactionAPI";

export function useTransactions(walletAddress, filter = "all") {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!walletAddress) return;
    setLoading(true);
    const data = await getTransactionHistory(walletAddress, filter);
    setTransactions(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [walletAddress, filter]);

  return { transactions, loading, refresh };
}
