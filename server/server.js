const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Salesforce CRUD Manager backend is running",
  });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});