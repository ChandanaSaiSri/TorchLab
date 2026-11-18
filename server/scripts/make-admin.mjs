// Usage: node scripts/make-admin.mjs you@example.com [student|instructor|admin]
// Gives an existing account a role. Works with the local database (DATABASE_URL or the default).
import pg from 'pg';

const [email, role = 'admin'] = process.argv.slice(2);
if (!email || !['student', 'instructor', 'admin'].includes(role)) {
  console.error('Usage: node scripts/make-admin.mjs <email> [student|instructor|admin]');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://torchlab:torchlab@localhost:5432/torchlab' });
const r = await pool.query('UPDATE users SET role=$1 WHERE email=$2 RETURNING id,name,email,role', [role, email.toLowerCase()]);
console.log(r.rows[0] ? `Done: ${r.rows[0].email} is now ${r.rows[0].role}.` : `No account with email ${email}. Sign up first, then run this again.`);
await pool.end();
process.exit(r.rows[0] ? 0 : 2);
