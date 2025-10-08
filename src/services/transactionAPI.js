const API_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api/transactions";

export async function createTransactionRecord(txData) {
  try {
    const res = await fetch(`${API_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(txData),
    });
    return await res.json();
  } catch (err) {
    console.error("Failed to create transaction:", err);
    return null;
  }
}

export async function updateTransactionStatus(signature, status) {
  try {
    const res = await fetch(`${API_URL}/${signature}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  } catch (err) {
    console.error("Failed to update transaction:", err);
    return null;
  }
}

export async function getTransactionHistory(walletAddress, filter = "all") {
  if (!walletAddress) return [];

  const url = `${API_URL}/${walletAddress}?filter=${filter}`;

  try {
    const res = await fetch(url);

    // Check response type before parsing
    const text = await res.text();
    // Try parsing JSON
    try {
      return JSON.parse(text);
    } catch (jsonErr) {
      console.error("Failed to parse JSON:", jsonErr);
      return [];
    }
  } catch (err) {
    console.error("Failed to fetch transaction history:", err);
    return [];
  }
}
