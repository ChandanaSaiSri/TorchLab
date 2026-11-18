// Local-development Postgres without Docker or a system install.
// Downloads a Postgres binary through npm (embedded-postgres), stores data in ./.pgdata,
// applies db/schema.sql, then keeps running. Stop with Ctrl+C. Data persists between runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../.pgdata');
const schema = fs.readFileSync(path.resolve(here, '../schema.sql'), 'utf8');

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'torchlab',
  password: 'torchlab',
  port: 5432,
  persistent: true,
  // UTF-8 everywhere: Windows would otherwise default to WIN1252 and reject characters like "≈".
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) await server.initialise();
await server.start();
// Make sure the app database exists and is UTF-8 (older runs may have created it as WIN1252).
const admin = new pg.Client({ connectionString: 'postgres://torchlab:torchlab@localhost:5432/postgres' });
await admin.connect();
const found = await admin.query(
  "SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = 'torchlab'"
);
if (found.rows[0] && found.rows[0].enc !== 'UTF8') {
  console.log(`Existing database uses ${found.rows[0].enc}; recreating it as UTF8 (local dev data is reset once).`);
  await admin.query('DROP DATABASE torchlab WITH (FORCE)');
  found.rows.length = 0;
}
if (!found.rows[0]) {
  await admin.query("CREATE DATABASE torchlab TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'");
}
await admin.end();

const client = new pg.Client({ connectionString: 'postgres://torchlab:torchlab@localhost:5432/torchlab' });
await client.connect();
await client.query(schema);
await client.end();

console.log('Local Postgres ready on localhost:5432 (db: torchlab). Press Ctrl+C to stop.');

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
