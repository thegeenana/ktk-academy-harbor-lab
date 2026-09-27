import pg from 'pg';
import { existsSync, readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { shutdownServer } from './shutdown.js';

// Compose reads `.env` on its own. The host process does too, and an already-set variable wins.
function loadLocalEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
loadLocalEnv();

const { Pool } = pg;
const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://harbor:harbor@localhost:5432/harbor',
  connectionTimeoutMillis: 2000,
  max: 10
});
pool.on('error', error => console.error('idle database connection failed:', error.message));

const state = { connected: false, schemaReady: false };
const app = createApp({ pool, state });
const server = app.listen(port, '0.0.0.0', () => console.log(`Harbor listening on ${port}`));

let stopping = false;
let retryTimer;

function delay(ms) {
  return new Promise(resolve => {
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      resolve();
    }, ms);
  });
}

// HTTP stays alive during a database outage; readiness reports whether the service can work.
async function initialise() {
  while (!stopping) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS entries (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        message VARCHAR(280) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      state.connected = true;
      state.schemaReady = true;
      console.log('Postgres connected and schema ready');
      return;
    } catch (error) {
      state.connected = false;
      if (stopping) return;
      console.error('Postgres connection failed:', error.message);
      await delay(3000);
    }
  }
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  clearTimeout(retryTimer);
  shutdownServer(server, pool);
}

initialise();
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
