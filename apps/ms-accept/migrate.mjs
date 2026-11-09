import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS acceptance_migration (
      id serial PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query("INSERT INTO acceptance_migration DEFAULT VALUES");
  console.log("acceptance migration applied");
} finally {
  await pool.end();
}
