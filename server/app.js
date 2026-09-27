import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry } from './validation.js';

const clientErrors = {
  400: 'Request body must be valid JSON.',
  413: 'Request body is too large.'
};

export function createApp({ pool, env = process.env, state = { connected: false, schemaReady: false }, startupAt = Date.now() }) {
  const startupDelayMs = Number(env.HARBOR_STARTUP_DELAY_MS || 0);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/health/live', (_req, res) => res.json({ status: 'alive' }));

  app.get('/health/ready', async (_req, res) => {
    if (!state.schemaReady) {
      return res.status(503).json({ status: 'not ready', reason: 'schema initialising' });
    }
    const labHold = env.HARBOR_FORCE_NOT_READY === 'true'
      || (Number.isFinite(startupDelayMs) && startupDelayMs > 0 && Date.now() - startupAt < startupDelayMs);
    if (labHold) {
      return res.status(503).json({ status: 'not ready', reason: 'lab condition' });
    }
    try {
      await pool.query('SELECT 1');
      state.connected = true;
      return res.json({ status: 'ready' });
    } catch {
      state.connected = false;
      return res.status(503).json({ status: 'not ready', reason: 'database unavailable' });
    }
  });

  app.get('/api/info', async (_req, res) => {
    let noteCount = null;
    if (state.schemaReady) {
      try {
        const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM entries');
        noteCount = Number(rows[0].count);
        state.connected = true;
      } catch {
        state.connected = false;
      }
    }
    res.json({
      app: 'Harbor',
      version: env.HARBOR_VERSION || '0.2.0',
      instance: env.HOSTNAME || 'local',
      databaseConnected: state.connected,
      noteCount
    });
  });

  app.get('/api/entries', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, message, created_at AS "createdAt" FROM entries ORDER BY created_at DESC, id DESC LIMIT 30'
      );
      state.connected = true;
      res.json(rows.map(row => ({ ...row, id: String(row.id) })));
    } catch (error) {
      state.connected = false;
      next(error);
    }
  });

  app.post('/api/entries', async (req, res, next) => {
    const entry = validateEntry(req.body);
    if (!entry) return res.status(400).json({ error: 'Name (1–60) and message (1–280) are required.' });
    try {
      const { rows } = await pool.query(
        'INSERT INTO entries (name, message) VALUES ($1, $2) RETURNING id, name, message, created_at AS "createdAt"',
        [entry.name, entry.message]
      );
      state.connected = true;
      res.status(201).json({ ...rows[0], id: String(rows[0].id) });
    } catch (error) {
      state.connected = false;
      next(error);
    }
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
    const status = Number(error.status || error.statusCode || 0);
    if (status >= 400 && status < 500) {
      return res.status(status).json({ error: clientErrors[status] || 'Bad request.' });
    }
    console.error('request failed:', error.message);
    res.status(503).json({ error: 'Service temporarily unavailable.' });
  });

  return app;
}
