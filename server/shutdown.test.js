import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { shutdownServer } from './shutdown.js';

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for shutdown');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('shutdown finishes the open request before closing the pool', async () => {
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  let release;
  const released = new Promise(resolve => { release = resolve; });
  const events = [];
  const server = http.createServer(async (_req, res) => {
    markStarted();
    await released;
    res.end('done');
  });
  await listen(server);
  const pending = fetch(`http://127.0.0.1:${server.address().port}/`).then(async response => {
    events.push(`response:${await response.text()}`);
  });
  await started;
  const exits = [];
  shutdownServer(server, {
    async end() { events.push('pool-end'); }
  }, {
    exit(code) { exits.push(code); },
    timeoutMs: 2000,
    log: { error() {} }
  });
  assert.deepEqual(events, []);
  release();
  await pending;
  await waitFor(() => exits.length === 1);
  assert.deepEqual(exits, [0]);
  assert.deepEqual(events.sort(), ['pool-end', 'response:done']);
});

test('shutdown still exits when closing the pool fails', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  await listen(server);
  const exits = [];
  shutdownServer(server, {
    async end() { throw new Error('end failed'); }
  }, {
    exit(code) { exits.push(code); },
    timeoutMs: 2000,
    log: { error() {} }
  });
  await waitFor(() => exits.length === 1);
  assert.deepEqual(exits, [0]);
});
