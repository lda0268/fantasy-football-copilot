import express from "express";
import fs from "node:fs";
import https from "node:https";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { copilotRouter } from "./routes/copilot.js";
import { fantasyProsRouter } from "./routes/fantasypros.js";
import { playerIdentityRouter } from "./routes/playerIdentity.js";
import { playerIntelligenceRouter } from "./routes/playerIntelligence.js";
import { yahooRouter } from "./routes/yahoo.js";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/api/yahoo", yahooRouter);
app.use("/api/copilot", copilotRouter);
app.use("/api/fantasypros", fantasyProsRouter);
app.use("/api/player-identity", playerIdentityRouter);
app.use("/api/player-intelligence", playerIntelligenceRouter);

const server = https.createServer(
  {
    key: fs.readFileSync(config.https.keyPath),
    cert: fs.readFileSync(config.https.certPath),
  },
  app,
);

server.listen(config.port, () => {
  console.log(`Server listening on https://localhost:${config.port}`);
});
