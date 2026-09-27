export function shutdownServer(server, pool, { exit = code => process.exit(code), timeoutMs = 10_000, log = console } = {}) {
  const timer = setTimeout(() => {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    log.error('shutdown timed out');
    exit(1);
  }, timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();

  // Keep-alive sockets stay open after a response. Drop idle ones so close can finish
  // once in-flight requests have ended.
  const releaseIdle = () => {
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  };
  const idleTimer = setInterval(releaseIdle, 20);
  if (typeof idleTimer.unref === 'function') idleTimer.unref();

  server.close(() => {
    clearInterval(idleTimer);
    clearTimeout(timer);
    Promise.resolve()
      .then(() => pool.end())
      .catch(error => log.error('database pool shutdown failed:', error.message))
      .finally(() => exit(0));
  });
  releaseIdle();
}
