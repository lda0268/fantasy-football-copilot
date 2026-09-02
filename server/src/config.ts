import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../.env") });

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
    redirectUri: requireEnv("YAHOO_REDIRECT_URI"),
    authorizeUrl: "https://api.login.yahoo.com/oauth2/request_auth",
    tokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
    scope: "fspt-r",
  },
};
