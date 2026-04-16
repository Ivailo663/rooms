import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const initPostgres = async () => {
  try {
    const client = await pool.connect();
    return await client.query("SELECT 1");
  } catch (err) {
    console.error("❌ PostgreSQL connection failed");
    console.error(err);
    process.exit(1);
  }
};
