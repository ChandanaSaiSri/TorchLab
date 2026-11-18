import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';
import { CATEGORY_LABELS, ago } from './Community.jsx';

function VoteButton({ type, id, votes, voted, mine, onDone }) {
  const [err, setErr] = useState('');
  const go = async () => { setErr(''); try { await api.post('/api/forum/vote', { type, id }); onDone(); } catch (e) { setErr(e.message); } };
  return (
    <div className="vote-col">
      <button className={`vote-btn ${voted ? 'on' : ''}`} onClick={go} disabled={mine} title={mine ? 'You cannot vote for your own post' : voted ? 'Remove your vote' : 'Helpful'} aria-pressed={voted}>▲</button>
      <strong>{votes}</strong>
      {err && <span className="muted sm">{err}</span>}
    </div>
  );
}

function Editor({ initial, onSave, onCancel, label = 'Save' }) {
  const [text, setText] = useState(initial);
  const [err, setErr] = useState('');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await onSave(text); } catch (er) { setErr(er.message); } }}>
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} />
      {err && <div className="alert err">{err}</div>}
      <div className="row-gap" style={{ marginTop: '.5rem' }}>
        <button className="btn primary small">{label}</button>
        {onCancel && <button type="button" className="btn ghost small" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export default function Thread() {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(null); // 'thread' | post id
  const [reply, setReply] = useState('');
  const [replyErr, setReplyErr] = useState('');

  const load = useCallback(() => api.get(`/api/forum/threads/${id}`).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn, msg) => { setNote(''); try { const r = await fn(); if (msg) setNote(typeof msg === 'function' ? msg(r) : msg); await load(); } catch (e) { setNote(e.message); } };

  if (error) return <div><Link to="/community">← Community</Link><div className="alert err" style={{ marginTop: '1rem' }}>{error}</div></div>;
  if (!d) return <div className="muted">Loading…</div>;
  const { thread: t, posts, isMod } = d;
  const F = `/api/forum`;

  const postReply = async (e) => {
    e.preventDefault(); setReplyErr('');
    try { await api.post(`${F}/threads/${id}/posts`, { body_md: reply }); setReply(''); load(); }
    catch (er) { setReplyErr(er.message); }
  };

  return (
    <div>
      <Link to="/community">← Community</Link>
      <div className="card" style={{ marginTop: '.8rem' }}>
        <div className="post">
          <VoteButton type="thread" id={t.id} votes={t.votes} voted={t.voted} mine={t.mine} onDone={load} />
          <div className="post-main">
            <h1 style={{ marginTop: 0 }}>{t.pinned && '📌 '}{t.locked && '🔒 '}{t.title}</h1>
            <div className="muted sm" style={{ marginBottom: '.8rem' }}>
              <span className="chip soft">{CATEGORY_LABELS[t.category]}</span> {t.author} · {ago(t.created_at)}{t.deleted && <span className="chip" style={{ marginLeft: 6 }}>deleted</span>}
            </div>
            {editing === 'thread' ? (
              <EditThread t={t} onDone={() => { setEditing(null); load(); }} />
            ) : <div className="prose"><ReactMarkdown>{t.body_md}</ReactMarkdown></div>}
            <div className="row-gap post-actions">
              {(t.mine || isMod) && editing !== 'thread' && <button className="linklike" onClick={() => setEditing('thread')}>Edit</button>}
              {(t.mine || isMod) && !t.deleted && <button className="linklike" onClick={() => window.confirm('Delete this thread?') && act(async () => { await api.del(`${F}/threads/${t.id}`); nav('/community'); })}>Delete</button>}
              {isMod && (
                <>
                  <button className="linklike" onClick={() => act(() => api.patch(`${F}/threads/${t.id}/mod`, { pinned: !t.pinned }))}>{t.pinned ? 'Unpin' : 'Pin'}</button>
                  <button className="linklike" onClick={() => act(() => api.patch(`${F}/threads/${t.id}/mod`, { locked: !t.locked }))}>{t.locked ? 'Unlock' : 'Lock'}</button>
                  {t.deleted && <button className="linklike" onClick={() => act(() => api.patch(`${F}/threads/${t.id}/mod`, { deleted: false }))}>Restore</button>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {note && <div className="alert" style={{ marginTop: '1rem' }}>{note}</div>}
      <h2 style={{ marginTop: '1.5rem' }}>{posts.filter((p) => !p.deleted).length} {posts.filter((p) => !p.deleted).length === 1 ? 'reply' : 'replies'}</h2>

      {posts.map((p) => (
        <div className={`card post-card ${p.accepted ? 'accepted' : ''}`} key={p.id}>
          <div className="post">
            {p.deleted ? <div style={{ width: 40 }} /> : <VoteButton type="post" id={p.id} votes={p.votes} voted={p.voted} mine={p.mine} onDone={load} />}
            <div className="post-main">
              <div className="muted sm" style={{ marginBottom: '.5rem' }}>
                {p.author} · {ago(p.created_at)} {p.accepted && <span className="chip ok" style={{ marginLeft: 6 }}>✓ Accepted answer</span>}
              </div>
              {p.deleted && !p.body_md ? <em className="muted">This reply was removed.</em> : (
                <>
                  {p.deleted && <div className="alert err sm">Removed. Only moderators can see this.</div>}
                  {editing === p.id ? (
                    <Editor initial={p.body_md} onCancel={() => setEditing(null)} onSave={async (text) => { await api.put(`${F}/posts/${p.id}`, { body_md: text }); setEditing(null); load(); }} />
                  ) : <div className="prose"><ReactMarkdown>{p.body_md}</ReactMarkdown></div>}
                </>
              )}
              {!p.deleted && (
                <div className="row-gap post-actions">
                  {t.canAccept && !t.deleted && (p.accepted
                    ? <button className="linklike" onClick={() => act(() => api.post(`${F}/threads/${t.id}/accept`, { postId: null }))}>Unmark answer</button>
                    : <button className="linklike" onClick={() => act(() => api.post(`${F}/threads/${t.id}/accept`, { postId: p.id }), (r) => (r.xpAwarded ? `Marked as the answer. ${p.author} earned ${r.xpAwarded} XP.` : 'Marked as the answer.'))}>Mark as answer</button>)}
                  {(p.mine || isMod) && editing !== p.id && <button className="linklike" onClick={() => setEditing(p.id)}>Edit</button>}
                  {(p.mine || isMod) && <button className="linklike" onClick={() => window.confirm('Delete this reply?') && act(() => api.del(`${F}/posts/${p.id}`))}>Delete</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {t.deleted ? null : t.locked && !isMod ? (
        <div className="card muted">🔒 This thread is locked, so new replies are turned off.</div>
      ) : (
        <form className="card" onSubmit={postReply} style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Your reply</h3>
          <textarea rows={6} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={8000} placeholder="Share what worked for you. Markdown and ``` code blocks are supported." />
          {replyErr && <div className="alert err">{replyErr}</div>}
          <button className="btn primary" style={{ marginTop: '.6rem' }} disabled={!reply.trim()}>Post reply</button>
        </form>
      )}
    </div>
  );
}

function EditThread({ t, onDone }) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body_md);
  const [err, setErr] = useState('');
  const save = async (e) => { e.preventDefault(); setErr(''); try { await api.put(`/api/forum/threads/${t.id}`, { title, body_md: body }); onDone(); } catch (er) { setErr(er.message); } };
  return (
    <form onSubmit={save}>
      <input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
      <textarea rows={8} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} style={{ marginTop: '.5rem' }} />
      {err && <div className="alert err">{err}</div>}
      <button className="btn primary small" style={{ marginTop: '.5rem' }}>Save</button>
    </form>
  );
}
