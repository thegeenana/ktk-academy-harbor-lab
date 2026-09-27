import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [entries, setEntries] = useState([]);
  const [info, setInfo] = useState(null);
  const [health, setHealth] = useState('checking');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [ready, detail, list] = await Promise.all([
        fetch('/health/ready'), fetch('/api/info'), fetch('/api/entries')
      ]);
      setHealth(ready.ok ? 'ready' : 'unavailable');
      if (detail.ok) setInfo(await detail.json());
      if (!list.ok) throw new Error('Entries could not be loaded.');
      setEntries(await list.json()); setError('');
    } catch { setHealth('unavailable'); setError('The service cannot load entries right now.'); }
  }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Save failed.');
      setMessage(''); await refresh();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  return <main>
    <header><span className="eyebrow">KTK Academy · Kubernetes learning project</span><h1>Harbor</h1><p>A small service with a big operational story. Leave a note, then learn what keeps it available.</p></header>
    <section className="status" aria-live="polite"><div><small>SERVICE</small><strong className={health}>{health}</strong></div><div><small>DATABASE</small><strong className={info ? (info.databaseConnected ? 'ready' : 'unavailable') : ''}>{info ? (info.databaseConnected ? 'connected' : 'down') : '—'}</strong></div><div><small>VERSION</small><strong>{info?.version || '—'}</strong></div><div><small>INSTANCE</small><strong>{info?.instance || '—'}</strong></div><div><small>NOTES</small><strong>{info?.noteCount ?? '—'}</strong></div></section>
    <div className="grid"><section className="card"><h2>Leave a note</h2><p>Each note is saved in Postgres. Restart the application, then check whether it remains.</p><form onSubmit={submit}><label>Name<input value={name} onChange={e => setName(e.target.value)} maxLength="60" required placeholder="Your name"/></label><label>Message<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength="280" required placeholder="What did you observe?"/></label><button disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button></form>{error && <p role="alert" className="error">{error}</p>}</section>
    <section className="card"><h2>Recent notes</h2>{info?.noteCount > entries.length ? <p>Showing the latest {entries.length} of {info.noteCount}.</p> : null}{entries.length ? <ul className="entries">{entries.map(entry => <li key={entry.id}><strong>{entry.name}</strong><time>{new Date(entry.createdAt).toLocaleString()}</time><p>{entry.message}</p></li>)}</ul> : error ? <p>Notes are still stored in Postgres. This list will return when the database is reachable.</p> : <p>No notes yet. Add one to begin the persistence lab.</p>}</section></div>
    <footer>Follow the request: browser → Harbor API → Postgres → persistent storage.</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
