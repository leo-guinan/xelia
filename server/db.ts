import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { config } from './config';

// Configure pool for production/development
const poolConfig: any = {
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Add SSL configuration for production (required for RDS and most cloud providers)
if (config.NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: false, // Required for AWS RDS
  };
}

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });