import { defineConfig } from "drizzle-kit";
import type { Config } from "drizzle-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const isProduction = process.env.NODE_ENV === "production";

// For production, append SSL parameters to the connection string
const getDatabaseUrl = () => {
  let url = process.env.DATABASE_URL!;
  
  if (isProduction) {
    // Add SSL parameters if not already present
    if (!url.includes("ssl=") && !url.includes("sslmode=")) {
      const separator = url.includes("?") ? "&" : "?";
      // Add sslmode=no-verify to accept self-signed certificates from RDS
      url = `${url}${separator}sslmode=no-verify`;
    }
  }
  
  return url;
};

const config: Config = {
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
};

export default defineConfig(config);
