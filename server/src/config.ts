import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.resolve(serverRoot, ".env") });

function resolveFromServerRoot(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(serverRoot, filePath);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 5178),
  yahoo: {
    clientId: requireEnv("YAHOO_CLIENT_ID"),
    clientSecret: requireEnv("YAHOO_CLIENT_SECRET"),
    redirectUri: process.env.YAHOO_REDIRECT_URI?.trim() || "https://localhost:5178/auth/yahoo/callback",
    authorizeUrl: "https://api.login.yahoo.com/oauth2/request_auth",
    tokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
    tokenStorePath: resolveFromServerRoot(process.env.YAHOO_TOKEN_STORE_PATH?.trim() || "./data/yahoo-tokens.json"),
    fixtureMode: process.env.YAHOO_FIXTURE_MODE?.trim().toLowerCase() === "true",
    fixturesDir: resolveFromServerRoot("src/yahoo/fixtures"),
  },
  https: {
    keyPath: resolveFromServerRoot("./certs/localhost-key.pem"),
    certPath: resolveFromServerRoot("./certs/localhost-cert.pem"),
  },
  fantasypros: {
    apiKey: process.env.FANTASYPROS_API_KEY?.trim() ?? "",
    fixtureMode: process.env.FANTASYPROS_FIXTURE_MODE?.trim().toLowerCase() === "true",
    baseUrl: "https://api.fantasypros.com/public/v2/json",
    timeoutMs: 10_000,
    fixturesDir: resolveFromServerRoot("src/fantasypros/fixtures"),
  },
};
