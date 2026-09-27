import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

const podName = 'harbor-7d4f8b9c5-xk2pq';

function memoryPool({ fail = false, count = 0, entries = [] } = {}) {
  return {
    async query(sql, params) {
      if (fail) throw new Error('database unavailable');
      if (sql.includes('COUNT')) return { rows: [{ count }] };
      if (sql.startsWith('SELECT id')) return { rows: entries };
      if (sql.startsWith('INSERT')) {
        return {
          rows: [{ id: 4, name: params[0], message: params[1], createdAt: '2026-09-27T09:00:00.000Z' }]
        };
      }
      return { rows: [{ ok: 1 }] };
    }
  };
}

async function withServer(app, fn) {
  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function appWith(pool, env = {}, state = { connected: false, schemaReady: true }, startupAt = Date.now()) {
  return createApp({
    pool,
    env: { HOSTNAME: podName, HARBOR_VERSION: '0.2.0', ...env },
    state,
    startupAt
  });
}

test('liveness stays up when the database is down', async () => {
  const state = { connected: false, schemaReady: false };
  await withServer(appWith(memoryPool({ fail: true }), {}, state), async base => {
    const live = await fetch(`${base}/health/live`);
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: 'alive' });
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), { status: 'not ready', reason: 'schema initialising' });
  });
});

test('readiness reports a database outage and clears the connected flag', async () => {
  const state = { connected: true, schemaReady: true };
  await withServer(appWith(memoryPool({ fail: true }), {}, state), async base => {
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), { status: 'not ready', reason: 'database unavailable' });
    const info = await fetch(`${base}/api/info`);
    assert.equal(info.status, 200);
    assert.equal((await info.json()).databaseConnected, false);
  });
});

test('a lab hold keeps the process unready while the database stays connected', async () => {
  const state = { connected: true, schemaReady: true };
  await withServer(appWith(memoryPool({ count: 2 }), { HARBOR_FORCE_NOT_READY: 'true' }, state), async base => {
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).reason, 'lab condition');
    const info = await fetch(`${base}/api/info`);
    const body = await info.json();
    assert.equal(body.databaseConnected, true);
    assert.equal(body.noteCount, 2);
  });
});

test('startup delay holds readiness until it elapses', async () => {
  const held = appWith(memoryPool(), { HARBOR_STARTUP_DELAY_MS: '60000' });
  await withServer(held, async base => {
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).reason, 'lab condition');
  });

  const elapsed = appWith(
    memoryPool(),
    { HARBOR_STARTUP_DELAY_MS: '1000' },
    { connected: false, schemaReady: true },
    Date.now() - 5000
  );
  await withServer(elapsed, async base => {
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: 'ready' });
  });
});

test('info returns the full instance name and the total note count', async () => {
  const entries = [{ id: 9, name: 'Ada', message: 'latest', createdAt: '2026-09-27T09:00:00.000Z' }];
  await withServer(appWith(memoryPool({ count: 42, entries })), async base => {
    const info = await fetch(`${base}/api/info`);
    assert.deepEqual(await info.json(), {
      app: 'Harbor',
      version: '0.2.0',
      instance: podName,
      databaseConnected: true,
      noteCount: 42
    });
    const list = await fetch(`${base}/api/entries`);
    const notes = await list.json();
    assert.equal(notes.length, 1);
    assert.equal(notes[0].id, '9');
  });
});

test('a rejected note returns 400 and leaves the database flag unchanged', async () => {
  const state = { connected: true, schemaReady: true };
  let queried = false;
  const pool = {
    async query() {
      queried = true;
      return { rows: [{ count: 1 }] };
    }
  };
  await withServer(appWith(pool, {}, state), async base => {
    const response = await fetch(`${base}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', message: 'hello' })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Name (1–60) and message (1–280) are required.');
    assert.equal(queried, false);
    assert.equal(state.connected, true);
  });
});

test('malformed and oversized JSON keep their client statuses', async () => {
  const state = { connected: true, schemaReady: true };
  await withServer(appWith(memoryPool({ count: 1 }), {}, state), async base => {
    const malformed = await fetch(`${base}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":'
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'Request body must be valid JSON.');

    const oversized = await fetch(`${base}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', message: 'x'.repeat(20_000) })
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error, 'Request body is too large.');
    assert.equal(state.connected, true);
  });
});

test('a failed note query returns 503 and marks the database disconnected', async () => {
  const state = { connected: true, schemaReady: true };
  await withServer(appWith(memoryPool({ fail: true }), {}, state), async base => {
    const list = await fetch(`${base}/api/entries`);
    assert.equal(list.status, 503);
    assert.deepEqual(await list.json(), { error: 'Service temporarily unavailable.' });
    const info = await fetch(`${base}/api/info`);
    const body = await info.json();
    assert.equal(body.databaseConnected, false);
    assert.equal(body.noteCount, null);
    assert.equal(body.instance, podName);
  });
});

test('a valid note is stored and returned with a string id', async () => {
  await withServer(appWith(memoryPool()), async base => {
    const response = await fetch(`${base}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ' Ada ', message: ' persisted ' })
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      id: '4',
      name: 'Ada',
      message: 'persisted',
      createdAt: '2026-09-27T09:00:00.000Z'
    });
  });
});
