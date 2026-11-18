import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export const CATEGORY_LABELS = { general: 'General', help: 'Help & questions', projects: 'Projects', showcase: 'Showcase', feedback: 'Feedback' };

export function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export default function Community() {
  const nav = useNavigate();
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ category: 'help', title: '', body_md: '' });
  const [formErr, setFormErr] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get(`/api/forum/threads?category=${category}&sort=${sort}&q=${encodeURIComponent(query)}&page=${page}`).then(setData).catch((e) => setError(e.message));
  }, [category, sort, query, page]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault(); setFormErr('');
    try { const { id } = await api.post('/api/forum/threads', form); nav(`/community/${id}`); }
    catch (er) { setFormErr(er.message); }
  };

  return (
    <div>
      <div className="row-between"><h1>Community</h1><button className="btn primary" onClick={() => setComposing(!composing)}>{composing ? 'Cancel' : 'New thread'}</button></div>
      <p className="muted">Ask questions, share what you built, and help others. When your reply is accepted as the answer you earn 15 XP.</p>

      {composing && (
        <form className="card" onSubmit={submit} style={{ marginBottom: '1rem' }}>
          <label>Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Title<input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What do you want to know or share?" /></label>
          <label>Details (Markdown works; wrap code in triple backticks)
            <textarea rows={8} value={form.body_md} maxLength={8000} onChange={(e) => setForm({ ...form, body_md: e.target.value })} />
          </label>
          {formErr && <div className="alert err">{formErr}</div>}
          <button className="btn primary">Post thread</button>
        </form>
      )}

      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }}>
        <input placeholder="Search threads" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Search</button>
      </form>
      <div className="row-gap" style={{ marginBottom: '1rem' }}>
        <div className="seg">
          <button className={category === '' ? 'active' : ''} onClick={() => { setCategory(''); setPage(1); }}>All</button>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <button key={k} className={category === k ? 'active' : ''} onClick={() => { setCategory(k); setPage(1); }}>{v}</button>)}
        </div>
        <div className="seg">
          {[['recent', 'Latest'], ['top', 'Top voted'], ['unanswered', 'No replies']].map(([k, v]) => <button key={k} className={sort === k ? 'active' : ''} onClick={() => { setSort(k); setPage(1); }}>{v}</button>)}
        </div>
      </div>

      {error && <div className="alert err">{error}</div>}
      {!data ? <div className="muted">Loading…</div> : data.threads.length === 0 ? (
        <div className="card muted">No threads here yet. Be the first to start one.</div>
      ) : (
        <div className="thread-list">
          {data.threads.map((t) => (
            <Link to={`/community/${t.id}`} className="thread-row" key={t.id}>
              <div className="thread-votes"><strong>{t.votes}</strong><span className="muted sm">votes</span></div>
              <div className="thread-main">
                <div className="thread-title">
                  {t.pinned && <span title="Pinned">📌 </span>}{t.locked && <span title="Locked">🔒 </span>}{t.title}
                </div>
                <div className="muted sm">{CATEGORY_LABELS[t.category]} · {t.author} · {ago(t.last_activity_at)}</div>
              </div>
              <div className="thread-meta">
                {t.answered && <span className="chip ok">Answered</span>}
                <span className="muted sm">{t.replies} {t.replies === 1 ? 'reply' : 'replies'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {data && data.pages > 1 && (
        <div className="row-gap" style={{ marginTop: '1rem' }}>
          <button className="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted sm">Page {data.page} of {data.pages}</span>
          <button className="btn ghost small" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
