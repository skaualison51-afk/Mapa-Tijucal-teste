const express = require("express");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const FILE = "progresso.json";

// Rota para carregar progresso
app.get("/progresso", (req, res) => {
  if (fs.existsSync(FILE)) {
    res.json(JSON.parse(fs.readFileSync(FILE)));
  } else {
    res.json({});
  }
});

// Rota para salvar progresso
app.post("/progresso", (req, res) => {
  fs.writeFileSync(FILE, JSON.stringify(req.body, null, 2));
  res.json({status: "ok"});
});

app.listen(3000, () => console.log("Servidor rodando em http://localhost:3000"));
