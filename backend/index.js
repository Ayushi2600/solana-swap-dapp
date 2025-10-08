const express = require("express");
const cors = require("cors");
const transactionRoutes = require("./routes/transactionRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/transactions", transactionRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
