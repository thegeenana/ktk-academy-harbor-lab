export function validateEntry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!name || name.length > 60 || !message || message.length > 280) return null;
  return { name, message };
}

