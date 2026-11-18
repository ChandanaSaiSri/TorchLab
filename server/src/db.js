import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://torchlab:torchlab@localhost:5432/torchlab',
});

export const query = (text, params) => pool.query(text, params);

export async function waitForDb(retries = 120) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      if (i % 5 === 0) console.log('Waiting for the database on localhost:5432 ...');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Database not reachable');
}
