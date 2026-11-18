import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const mono = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '.85rem' };
const fmtH = (s) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`);

function Area({ label, value, onChange, rows = 6, code, hint }) {
  return (
    <label>
      {label}
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={!code} style={code ? mono : undefined} />
      {hint && <span className="muted sm">{hint}</span>}
    </label>
  );
}
function Text({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} {...rest} />
    </label>
  );
}
function Pick({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
const Msg = ({ m }) => (m ? <div className={`alert ${m.ok ? 'ok' : 'err'}`}>{m.text}</div> : null);

/* ------------------------------------------------------------------ overview */
function Bars({ data, title }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div>
      <h3>{title}</h3>
      <div className="week-bars" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((d) => (
          <div className="week-col" key={d.day} title={`${d.day}: ${d.n}`}>
            <div className="week-bar"><div style={{ height: `${(d.n / max) * 100}%` }} /></div>
            <span className="muted sm">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/api/admin/stats').then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="alert err">{err}</div>;
  if (!s) return <div className="muted">Loading…</div>;
  const t = s.totals;
  const tiles = [
    ['Learners', t.users], ['Active today', t.active_today], ['Active (7 days)', t.active7], ['Lessons completed', t.lessons_done],
    ['Challenge submissions', `${t.submissions_passed}/${t.submissions}`], ['Assessment attempts', t.attempts], ['Certificates', t.certificates],
    ['Forum threads', t.threads], ['Code runs', t.runs], ['Learning time', fmtH(t.learning_seconds)],
  ];
  return (
    <div>
      <div className="stats">{tiles.map(([k, v]) => <div className="card stat" key={k}><div className="stat-num">{v}</div><div className="muted sm">{k}</div></div>)}</div>
      <div className="grid2">
        <div className="card"><Bars data={s.signups} title="New learners, last 14 days" /></div>
        <div className="card"><Bars data={s.activity} title="Active learners per day" /></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Hardest challenges</h3>
          <p className="muted sm">Lowest share of learners who solved it, among those who tried.</p>
          {s.hardest.length === 0 ? <p className="muted">No attempts yet.</p> : (
            <table className="lb-table"><thead><tr><th>Challenge</th><th className="num">Tried</th><th className="num">Solved</th><th className="num">Attempts</th></tr></thead>
              <tbody>{s.hardest.map((c) => <tr key={c.slug}><td><Link to={`/practice/${c.slug}`}>{c.title}</Link> <span className="muted sm">{c.difficulty}</span></td><td className="num">{c.learners}</td><td className="num">{c.solved}</td><td className="num">{c.attempts}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card">
          <h3>Code runner, last 7 days</h3>
          <p>{s.runner.runs} runs, {s.runner.failed} not successful, average {s.runner.avg_ms} ms.</p>
          <h3>Where learners stop</h3>
          {s.dropoff.length === 0 ? <p className="muted">No lesson activity yet.</p> : (
            <table className="lb-table"><thead><tr><th>Lesson</th><th className="num">Started</th><th className="num">Done</th></tr></thead>
              <tbody>{s.dropoff.slice(0, 12).map((r, i) => <tr key={i}><td>{r.lesson} <span className="muted sm">{r.course}</span></td><td className="num">{r.started}</td><td className="num">{r.completed}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ users */
function Users({ meId }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api.get(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then(setD).catch((e) => setMsg({ text: e.message })), [q, page]);
  useEffect(() => { load(); }, [load]);
  const setRole = async (u, role) => {
    setMsg(null);
    try { await api.patch(`/api/admin/users/${u.id}/role`, { role }); setMsg({ ok: true, text: `${u.name} is now ${role}.` }); load(); }
    catch (e) { setMsg({ text: e.message }); }
  };
  return (
    <div className="card">
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Search</button>
      </form>
      <Msg m={msg} />
      {!d ? <div className="muted">Loading…</div> : (
        <>
          <table className="lb-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th className="num">XP</th><th>Last active</th></tr></thead>
            <tbody>{d.users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}{u.google && <span className="chip soft" style={{ marginLeft: 6 }}>Google</span>}</td>
                <td className="muted">{u.email}</td>
                <td>{u.id === meId ? <span className="chip ok">{u.role} (you)</span> : (
                  <select value={u.role} onChange={(e) => setRole(u, e.target.value)} style={{ width: 'auto' }}>
                    <option>student</option><option>instructor</option><option>admin</option>
                  </select>)}</td>
                <td className="num">{u.xp}</td>
                <td className="muted">{u.last_active ? String(u.last_active).slice(0, 10) : '—'}</td>
              </tr>))}</tbody>
          </table>
          <div className="row-between" style={{ marginTop: '.8rem' }}>
            <span className="muted sm">{d.total} accounts</span>
            <span className="row-gap">
              <button className="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="muted sm">Page {d.page} of {d.pages}</span>
              <button className="btn ghost small" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Next</button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ lessons */
const blankQuiz = () => ({ q: '', options: ['', ''], answer: 0, explain: '' });

function QuizEditor({ quiz, onChange }) {
  const set = (i, patch) => onChange(quiz.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div>
      <h3>Quiz</h3>
      {quiz.map((q, i) => (
        <div className="card" key={i} style={{ marginBottom: '.8rem' }}>
          <div className="row-between"><strong>Question {i + 1}</strong><button type="button" className="btn ghost small" onClick={() => onChange(quiz.filter((_, j) => j !== i))}>Remove</button></div>
          <Text label="Question" value={q.q} onChange={(v) => set(i, { q: v })} />
          <Area label="Options (one per line)" rows={4} value={q.options.join('\n')} onChange={(v) => set(i, { options: v.split('\n') })} />
          <label>Correct option
            <select value={q.answer} onChange={(e) => set(i, { answer: Number(e.target.value) })}>
              {q.options.map((o, k) => <option key={k} value={k}>{k + 1}. {o.slice(0, 60) || '(empty)'}</option>)}
            </select>
          </label>
          <Text label="Explanation (shown after answering)" value={q.explain || ''} onChange={(v) => set(i, { explain: v })} />
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={() => onChange([...quiz, blankQuiz()])}>Add a quiz question</button>
    </div>
  );
}

function LessonEditor({ id, courseId, onDone }) {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (id) api.get(`/api/admin/lessons/${id}`).then((d) => setF({ ...d.lesson, quiz: d.lesson.quiz || [] })).catch((e) => setMsg({ text: e.message }));
    else setF({ title: '', xp: 20, content_md: '', starter_code: '', quiz: [] });
  }, [id]);
  if (!f) return <Msg m={msg} />;
  const up = (patch) => setF({ ...f, ...patch });
  const save = async (e) => {
    e.preventDefault(); setMsg(null);
    const body = { title: f.title, xp: Number(f.xp), content_md: f.content_md, starter_code: f.starter_code, quiz: f.quiz.map((q) => ({ ...q, options: q.options.map((o) => o.trim()).filter(Boolean) })) };
    try { if (id) await api.put(`/api/admin/lessons/${id}`, body); else await api.post(`/api/admin/courses/${courseId}/lessons`, body); setMsg({ ok: true, text: 'Saved.' }); onDone(); }
    catch (er) { setMsg({ text: er.message }); }
  };
  return (
    <form className="card" onSubmit={save}>
      <div className="row-between"><h3>{id ? 'Edit lesson' : 'New lesson'}</h3><button type="button" className="btn ghost small" onClick={onDone}>Close</button></div>
      <div className="grid2"><Text label="Title" value={f.title} onChange={(v) => up({ title: v })} /><Text label="XP" type="number" value={f.xp} onChange={(v) => up({ xp: v })} /></div>
      <Area label="Lesson text (Markdown)" rows={14} value={f.content_md} onChange={(v) => up({ content_md: v })} />
      <Area label="Starter code for the playground" rows={6} code value={f.starter_code} onChange={(v) => up({ starter_code: v })} />
      <QuizEditor quiz={f.quiz} onChange={(quiz) => up({ quiz })} />
      <Msg m={msg} />
      <div style={{ marginTop: '1rem' }}><button className="btn primary">Save lesson</button></div>
    </form>
  );
}

function Lessons() {
  const [courses, setCourses] = useState(null);
  const [edit, setEdit] = useState(null); // {id} or {courseId}
  const [nc, setNc] = useState({ title: '', description: '', level: 'Beginner' });
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api.get('/api/admin/courses').then((d) => setCourses(d.courses)).catch((e) => setMsg({ text: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const addCourse = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await api.post('/api/admin/courses', nc); setNc({ title: '', description: '', level: 'Beginner' }); load(); setMsg({ ok: true, text: 'Course created. Add its first lesson below.' }); }
    catch (er) { setMsg({ text: er.message }); }
  };
  if (edit) return <LessonEditor key={edit.id || `c${edit.courseId}`} id={edit.id} courseId={edit.courseId} onDone={() => { setEdit(null); load(); }} />;
  return (
    <div>
      <p className="muted">Lessons you edit here are kept: restarting the server never overwrites them with the files in <code>server/content</code>.</p>
      <Msg m={msg} />
      {!courses ? <div className="muted">Loading…</div> : courses.map((c) => (
        <div className="card" key={c.id} style={{ marginBottom: '1rem' }}>
          <div className="row-between"><h3 style={{ margin: 0 }}>{c.title} <span className="chip soft">{c.level}</span>{c.source === 'admin' && <span className="chip ok" style={{ marginLeft: 6 }}>edited</span>}</h3>
            <button className="btn ghost small" onClick={() => setEdit({ courseId: c.id })}>Add lesson</button></div>
          <table className="lb-table"><tbody>{c.lessons.map((l) => (
            <tr key={l.id}><td className="muted" style={{ width: 30 }}>{l.position}</td><td>{l.title}{l.source === 'admin' && <span className="chip ok" style={{ marginLeft: 6 }}>edited</span>}</td><td className="num">{l.xp} XP</td>
              <td className="num"><button className="btn ghost small" onClick={() => setEdit({ id: l.id })}>Edit</button></td></tr>))}</tbody></table>
        </div>
      ))}
      <form className="card" onSubmit={addCourse}>
        <h3>New course</h3>
        <div className="grid2"><Text label="Title" value={nc.title} onChange={(v) => setNc({ ...nc, title: v })} /><Pick label="Level" value={nc.level} onChange={(v) => setNc({ ...nc, level: v })} options={['Beginner', 'Intermediate', 'Advanced']} /></div>
        <Text label="Short description" value={nc.description} onChange={(v) => setNc({ ...nc, description: v })} />
        <button className="btn">Create course</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ challenges */
const blankChallenge = {
  title: '', difficulty: 'easy', category: '', description_md: '', published: true, hints: [],
  starter_code: 'def solve(x):\n    # TODO\n    pass\n',
  solution_code: 'def solve(x):\n    return x\n',
  tests: 'def test_basic():\n    assert solve(1) == 1\n\ndef hidden_other():\n    assert solve(2) == 2\n',
};

function ChallengeEditor({ id, onDone }) {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (id) api.get(`/api/admin/challenges/${id}`).then((d) => setF(d.challenge)).catch((e) => setMsg({ text: e.message }));
    else setF(blankChallenge);
  }, [id]);
  if (!f) return <Msg m={msg} />;
  const up = (patch) => setF({ ...f, ...patch });
  const body = () => ({ title: f.title, difficulty: f.difficulty, category: f.category, description_md: f.description_md, starter_code: f.starter_code,
    solution_code: f.solution_code, hints: (f.hints || []).filter((h) => h.trim()), tests: f.tests, published: f.published });
  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setMsg({ ok: true, text: okText(r) }); return true; }
    catch (er) { setMsg({ text: er.message }); return false; }
    finally { setBusy(false); }
  };
  const check = () => run(() => api.post('/api/admin/challenges/check', body()), (r) => `Looks good: the reference solution passes all ${r.tests} tests (${r.hidden} hidden) and the starter does not.`);
  const save = async (e) => {
    e.preventDefault();
    const done = await run(() => (id ? api.put(`/api/admin/challenges/${id}`, body()) : api.post('/api/admin/challenges', body())), () => 'Saved.');
    if (done) onDone();
  };
  return (
    <form className="card" onSubmit={save}>
      <div className="row-between"><h3>{id ? 'Edit challenge' : 'New challenge'}</h3><button type="button" className="btn ghost small" onClick={onDone}>Close</button></div>
      <div className="grid2"><Text label="Title" value={f.title} onChange={(v) => up({ title: v })} /><Text label="Category" value={f.category} onChange={(v) => up({ category: v })} /></div>
      <div className="grid2">
        <Pick label="Difficulty (sets the XP: 10 / 25 / 50 / 100)" value={f.difficulty} onChange={(v) => up({ difficulty: v })} options={['easy', 'medium', 'hard', 'expert']} />
        <label>Visible to learners <input type="checkbox" checked={f.published} onChange={(e) => up({ published: e.target.checked })} style={{ width: 'auto', display: 'inline-block' }} /></label>
      </div>
      <Area label="Description (Markdown)" rows={7} value={f.description_md} onChange={(v) => up({ description_md: v })} />
      <div className="grid2">
        <Area label="Starter code" rows={9} code value={f.starter_code} onChange={(v) => up({ starter_code: v })} />
        <Area label="Reference solution (never shown until solved)" rows={9} code value={f.solution_code} onChange={(v) => up({ solution_code: v })} />
      </div>
      <Area label="Tests" rows={12} code value={f.tests} onChange={(v) => up({ tests: v })} hint="Functions named test_… are shown to learners; hidden_… are graded but only counted." />
      <Area label="Hints (one per paragraph, separated by a blank line; up to 6)" rows={4} value={(f.hints || []).join('\n\n')} onChange={(v) => up({ hints: v.split(/\n\s*\n/) })} />
      <Msg m={msg} />
      <div className="row-gap" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn ghost" disabled={busy} onClick={check}>{busy ? 'Running…' : 'Check with the runner'}</button>
        <button className="btn primary" disabled={busy}>Save (runs the check first if tests or code changed)</button>
      </div>
    </form>
  );
}

function Challenges() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api.get('/api/admin/challenges').then((d) => setList(d.challenges)).catch((e) => setMsg({ text: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (c) => {
    try { await api.patch(`/api/admin/challenges/${c.id}/published`, { published: !c.published }); } catch (e) { setMsg({ text: e.message }); }
    load();
  };
  if (edit) return <ChallengeEditor key={edit.id || 'new'} id={edit.id} onDone={() => { setEdit(null); load(); }} />;
  return (
    <div className="card">
      <div className="row-between"><p className="muted">Every new or changed exercise is run in the sandbox first: the reference solution must pass, the starter must not.</p><button className="btn" onClick={() => setEdit({})}>New challenge</button></div>
      <Msg m={msg} />
      {!list ? <div className="muted">Loading…</div> : (
        <table className="lb-table"><thead><tr><th>Title</th><th>Difficulty</th><th className="num">Solved</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id}><td>{c.title}{c.source === 'admin' && <span className="chip ok" style={{ marginLeft: 6 }}>edited</span>}</td><td>{c.difficulty}</td>
              <td className="num">{c.solved}/{c.attempts}</td><td>{c.published ? 'Visible' : <span className="muted">Hidden</span>}</td>
              <td className="num"><span className="row-gap"><button className="btn ghost small" onClick={() => toggle(c)}>{c.published ? 'Hide' : 'Show'}</button><button className="btn ghost small" onClick={() => setEdit({ id: c.id })}>Edit</button></span></td></tr>))}</tbody></table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ question bank */
const blankQuestion = { qid: '', section: 'theory', type: 'mcq', tags: [], published: true, data: { prompt: '', options: ['', ''], answer: 0, answers: [], explain: '', points: 1, title: '', starter: '', solution: '', tests: '' } };

function QuestionEditor({ qid, onDone }) {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (qid) api.get(`/api/admin/questions/${encodeURIComponent(qid)}`).then((d) => setF({ ...blankQuestion, ...d.question, data: { ...blankQuestion.data, ...d.question.data } })).catch((e) => setMsg({ text: e.message }));
    else setF(blankQuestion);
  }, [qid]);
  if (!f) return <Msg m={msg} />;
  const up = (patch) => setF({ ...f, ...patch });
  const upd = (patch) => setF({ ...f, data: { ...f.data, ...patch } });
  const setType = (type) => up({ type, section: type === 'code' ? (f.section === 'theory' ? 'coding' : f.section) : 'theory' });
  const d = f.data;
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    let data;
    if (f.type === 'code') data = { title: d.title, prompt: d.prompt, starter: d.starter, solution: d.solution, tests: d.tests, explain: d.explain, points: Number(d.points) };
    else {
      const options = d.options.map((o) => o.trim()).filter(Boolean);
      data = f.type === 'mcq' ? { prompt: d.prompt, options, answer: d.answer, explain: d.explain, points: Number(d.points) }
        : { prompt: d.prompt, options, answers: d.answers, explain: d.explain, points: Number(d.points) };
    }
    const body = { qid: f.qid, section: f.section, type: f.type, tags: f.tags, published: f.published, data };
    try { if (qid) await api.put(`/api/admin/questions/${encodeURIComponent(qid)}`, body); else await api.post('/api/admin/questions', body); onDone(); }
    catch (er) { setMsg({ text: er.message }); setBusy(false); }
  };
  const toggleMulti = (k) => upd({ answers: d.answers.includes(k) ? d.answers.filter((x) => x !== k) : [...d.answers, k] });
  return (
    <form className="card" onSubmit={save}>
      <div className="row-between"><h3>{qid ? `Edit ${qid}` : 'New question'}</h3><button type="button" className="btn ghost small" onClick={onDone}>Close</button></div>
      <div className="grid2">
        <Text label="ID (letters, numbers, dashes)" value={f.qid} onChange={(v) => up({ qid: v })} disabled={!!qid} placeholder="t-tensors-20" />
        <Pick label="Type" value={f.type} onChange={setType} options={['mcq', 'multi', 'code']} />
      </div>
      <div className="grid2">
        <Pick label="Section" value={f.section} onChange={(v) => up({ section: v })} options={f.type === 'code' ? ['coding', 'practical'] : ['theory']} />
        <Text label="Tags (comma separated)" value={(f.tags || []).join(', ')} onChange={(v) => up({ tags: v.split(',').map((t) => t.trim()).filter(Boolean) })} />
      </div>
      {f.type === 'code' && <Text label="Title" value={d.title} onChange={(v) => upd({ title: v })} />}
      <Area label="Question (Markdown)" rows={4} value={d.prompt} onChange={(v) => upd({ prompt: v })} />
      {f.type !== 'code' ? (
        <>
          <Area label="Options (one per line)" rows={5} value={d.options.join('\n')} onChange={(v) => upd({ options: v.split('\n') })} />
          {f.type === 'mcq' ? (
            <label>Correct option<select value={d.answer} onChange={(e) => upd({ answer: Number(e.target.value) })}>{d.options.map((o, k) => <option key={k} value={k}>{k + 1}. {o.slice(0, 60) || '(empty)'}</option>)}</select></label>
          ) : (
            <div><strong>Correct options</strong>{d.options.map((o, k) => <label key={k} style={{ fontWeight: 400, margin: '.2rem 0' }}><input type="checkbox" style={{ display: 'inline-block', width: 'auto', marginRight: 8 }} checked={d.answers.includes(k)} onChange={() => toggleMulti(k)} />{o || '(empty)'}</label>)}</div>
          )}
        </>
      ) : (
        <>
          <div className="grid2"><Area label="Starter code" rows={8} code value={d.starter} onChange={(v) => upd({ starter: v })} /><Area label="Reference solution" rows={8} code value={d.solution} onChange={(v) => upd({ solution: v })} /></div>
          <Area label="Tests (test_… visible, hidden_… counted only)" rows={10} code value={d.tests} onChange={(v) => upd({ tests: v })} />
        </>
      )}
      <div className="grid2"><Text label="Explanation (shown in the review)" value={d.explain || ''} onChange={(v) => upd({ explain: v })} /><Text label="Points" type="number" value={d.points} onChange={(v) => upd({ points: v })} /></div>
      <label><input type="checkbox" style={{ display: 'inline-block', width: 'auto', marginRight: 8 }} checked={f.published} onChange={(e) => up({ published: e.target.checked })} />Available in assessments</label>
      <Msg m={msg} />
      <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save question'}</button>
    </form>
  );
}

function Questions() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [section, setSection] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api.get(`/api/admin/questions?section=${section}&q=${encodeURIComponent(q)}`).then((d) => setList(d.questions)).catch((e) => setMsg({ text: e.message })), [section, q]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (x) => {
    try { await api.patch(`/api/admin/questions/${encodeURIComponent(x.qid)}/published`, { published: !x.published }); } catch (e) { setMsg({ text: e.message }); }
    load();
  };
  if (edit) return <QuestionEditor key={edit.qid || 'new'} qid={edit.qid} onDone={() => { setEdit(null); load(); }} />;
  return (
    <div className="card">
      <div className="inline-form">
        <input placeholder="Search questions" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={section} onChange={(e) => setSection(e.target.value)} style={{ width: 'auto' }}><option value="">All sections</option><option>theory</option><option>coding</option><option>practical</option></select>
        <button className="btn" onClick={() => setEdit({})}>New question</button>
      </div>
      <Msg m={msg} />
      {!list ? <div className="muted">Loading…</div> : (
        <table className="lb-table"><thead><tr><th>ID</th><th>Question</th><th>Type</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((x) => (
            <tr key={x.qid}><td style={mono}>{x.qid}{x.source === 'admin' && <span className="chip ok" style={{ marginLeft: 6 }}>edited</span>}</td><td>{x.prompt}</td><td>{x.type}</td><td>{x.published ? 'Live' : <span className="muted">Off</span>}</td>
              <td className="num"><span className="row-gap"><button className="btn ghost small" onClick={() => toggle(x)}>{x.published ? 'Turn off' : 'Turn on'}</button><button className="btn ghost small" onClick={() => setEdit({ qid: x.qid })}>Edit</button></span></td></tr>))}</tbody></table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ page */
export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const tabs = [['overview', 'Overview'], ...(isAdmin ? [['users', 'Users']] : []), ['lessons', 'Lessons'], ['challenges', 'Challenges'], ['questions', 'Assessment questions']];
  const [tab, setTab] = useState('overview');
  if (user.role !== 'admin' && user.role !== 'instructor') return <div className="alert err">This area is for instructors and admins.</div>;
  return (
    <div>
      <h1>Admin</h1>
      <p className="muted">Signed in as {user.role}. {isAdmin ? 'You can manage users and all content.' : 'You can edit content; only admins manage users.'}</p>
      <div className="seg" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        {tabs.map(([k, label]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users meId={user.id} />}
      {tab === 'lessons' && <Lessons />}
      {tab === 'challenges' && <Challenges />}
      {tab === 'questions' && <Questions />}
    </div>
  );
}
