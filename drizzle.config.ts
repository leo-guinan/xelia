import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Parse DATABASE_URL and add SSL parameter if in production
let dbUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV === "production" && !dbUrl.includes("ssl=")) {
  // Add SSL parameter to the connection string
  const separator = dbUrl.includes("?") ? "&" : "?";
  dbUrl = `${dbUrl}${separator}sslmode=require`;
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
