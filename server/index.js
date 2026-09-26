import express from 'express';
import pg from 'pg';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry } from './validation.js';

const { Pool } = pg;
const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://harbor:harbor@localhost:5432/harbor',
  connectionTimeoutMillis: 2000,
  max: 10
});
pool.on('error', error => console.error('idle database connection failed:', error.message));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
let connected = false;
let schemaReady = false;
const startupAt = Date.now();
const startupDelayMs = Number(process.env.HARBOR_STARTUP_DELAY_MS || 0);

app.get('/health/live', (_req, res) => res.json({ status: 'alive' }));
app.get('/health/ready', async (_req, res) => {
  if (!schemaReady) return res.status(503).json({ status: 'not ready', reason: 'schema initialising' });
  if (process.env.HARBOR_FORCE_NOT_READY === 'true' || Date.now() - startupAt < startupDelayMs) {
    return res.status(503).json({ status: 'not ready', reason: 'lab condition' });
  }
  try {
    await pool.query('SELECT 1');
    connected = true;
    return res.json({ status: 'ready' });
  } catch {
    connected = false;
    return res.status(503).json({ status: 'not ready', reason: 'database unavailable' });
  }
});
app.get('/api/info', (_req, res) => res.json({
  app: 'Harbor', version: process.env.HARBOR_VERSION || '0.2.0',
  instance: process.env.HOSTNAME || 'local', databaseConnected: connected
}));
app.get('/api/entries', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, message, created_at AS "createdAt" FROM entries ORDER BY created_at DESC, id DESC LIMIT 30'
    );
    res.json(rows.map(row => ({ ...row, id: String(row.id) })));
  } catch (error) { next(error); }
});
app.post('/api/entries', async (req, res, next) => {
  const entry = validateEntry(req.body);
  if (!entry) return res.status(400).json({ error: 'Name (1–60) and message (1–280) are required.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO entries (name, message) VALUES ($1, $2) RETURNING id, name, message, created_at AS "createdAt"',
      [entry.name, entry.message]
    );
    res.status(201).json({ ...rows[0], id: String(rows[0].id) });
  } catch (error) { next(error); }
});

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/health/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}
app.use((error, _req, res, _next) => {
  console.error('request failed:', error.message);
  res.status(503).json({ error: 'Service temporarily unavailable.' });
});

const server = app.listen(port, '0.0.0.0', () => console.log(`Harbor listening on ${port}`));
// HTTP stays alive during a database outage; readiness reports whether the service can work.
async function initialise() {
  while (true) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS entries (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        message VARCHAR(280) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      connected = true;
      schemaReady = true;
      console.log('Postgres connected and schema ready');
      break;
    } catch (error) {
      connected = false;
      console.error('Postgres connection failed:', error.message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
initialise();
async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
