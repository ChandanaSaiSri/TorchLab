import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LevelBar } from './Dashboard.jsx';

const fmtHours = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

/** GitHub-style grid: 53 week columns x 7 day rows, darker = more activity that day. */
function Heatmap({ data }) {
  const byDay = new Map(data.map((d) => [d.day, d.count]));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 52 * 7 - today.getDay());       // a Sunday, 52 weeks back
  const cells = [];
  for (let i = 0; i < 53 * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > today) { cells.push(null); continue; }
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const n = byDay.get(key) || 0;
    cells.push({ key, n, level: n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4 });
  }
  return (
    <div className="heatmap" role="img" aria-label="Learning activity over the last year">
      {cells.map((c, i) => (c ? <span key={i} className={`hm l${c.level}`} title={`${c.key}: ${c.n} activit${c.n === 1 ? 'y' : 'ies'}`} /> : <span key={i} className="hm none" />))}
    </div>
  );
}

function PasswordCard({ hasPassword }) {
  const { refresh } = useAuth();
  const [f, setF] = useState({ current: '', password: '', again: '' });
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    if (f.password !== f.again) return setMsg({ text: 'The two new passwords do not match' });
    try { await api.post('/api/auth/change-password', { current: f.current || undefined, password: f.password }); setF({ current: '', password: '', again: '' }); setMsg({ ok: true, text: 'Password changed.' }); refresh(); }
    catch (er) { setMsg({ text: er.message }); }
  };
  return (
    <form className="card" onSubmit={submit}>
      <h3>{hasPassword ? 'Change password' : 'Set a password'}</h3>
      {!hasPassword && <p className="muted small-note">You signed up with Google. Add a password if you also want to log in with your email.</p>}
      {hasPassword && <label>Current password<input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required autoComplete="current-password" /></label>}
      <label>New password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
      <label>Repeat new password<input type="password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <button className="btn primary">{hasPassword ? 'Change password' : 'Set password'}</button>
    </form>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [sum, setSum] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/api/profile/summary').then(setSum).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put('/api/auth/me', { name, bio });
      await refresh();
      setMsg('Profile saved');
    } catch (err) {
      setMsg(err.message);
    }
  };

  const maxDay = sum ? Math.max(60, ...sum.hours.week.map((d) => d.seconds)) : 60;
  const activeDays = sum ? sum.heatmap.length : 0;

  return (
    <>
      <h1>Profile</h1>
      {sum && <LevelBar level={sum.level} />}

      {sum && (
        <div className="stats">
          <div className="card"><div className="muted">Total XP</div><div className="stat-n">{sum.xp}</div></div>
          <div className="card"><div className="muted">Streak</div><div className="stat-n">{sum.streak.current}<span className="muted"> {sum.streak.current === 1 ? "day" : "days"}</span></div></div>
          <div className="card"><div className="muted">Learning time</div><div className="stat-n">{fmtHours(sum.hours.totalSeconds)}</div></div>
          <div className="card"><div className="muted">Lessons / challenges / projects</div><div className="stat-n">{sum.counts.lessons} / {sum.counts.challenges} / {sum.counts.projects}</div></div>
        </div>
      )}

      <div className="grid2">
        <form className="card" onSubmit={save}>
          <h3>About you</h3>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
          <label>Email<input value={user.email} disabled /><small className={user.emailVerified ? 'muted' : ''}>{user.emailVerified ? '✓ Confirmed' : 'Not confirmed yet. Use the banner at the top to resend the link.'}</small></label>
          <label>Bio<textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} /></label>
          <div className="row-gap"><button className="btn primary">Save</button><span className="muted">{msg}</span></div>
          <p className="muted small-note">
            <span className="chip">{user.role}</span> Member since {new Date(user.created_at).toLocaleDateString()} · <Link to="/portfolio">My portfolio</Link>
          </p>
        </form>

        <PasswordCard hasPassword={user.hasPassword} />

        {sum && (
          <section className="card">
            <h3>This week</h3>
            <p className="muted small-note">{fmtHours(sum.hours.weekSeconds)} of learning time. Counted while TorchLab is open and you are active.</p>
            <div className="week-bars">
              {sum.hours.week.map((d) => (
                <div key={d.day} className="week-col" title={`${d.day}: ${fmtHours(d.seconds)}`}>
                  <div className="week-bar"><div style={{ height: `${Math.round((d.seconds / maxDay) * 100)}%` }} /></div>
                  <span className="muted small-note">{new Date(d.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {sum && (
        <>
          <section className="card">
            <h3>Activity <span className="muted small-note">· {activeDays} active day{activeDays === 1 ? '' : 's'} in the last year</span></h3>
            <div className="heatmap-wrap"><Heatmap data={sum.heatmap} /></div>
          </section>

          <div className="grid2">
            <section className="card">
              <h3>Badges</h3>
              {sum.badges.length === 0 ? <p className="muted">None yet. <Link to="/achievements">See what you can earn</Link>.</p> : (
                <div className="row-gap">{sum.badges.map((b) => <span key={b.code} className="chip" title={b.name}>{b.icon} {b.name}</span>)}</div>
              )}
              <p><Link to="/achievements">All achievements →</Link></p>
            </section>
            <section className="card">
              <h3>Certificates</h3>
              {sum.certificates.length === 0 ? <p className="muted">Finish a course or project to earn one.</p> : (
                <ul className="plain">
                  {sum.certificates.map((c) => <li key={c.code}><Link to={`/verify/${c.code}`}>{c.title}</Link> <span className="muted">· {new Date(c.issued_at).toLocaleDateString()}</span></li>)}
                </ul>
              )}
            </section>
          </div>

          {sum.assessments.length > 0 && (
            <section className="card">
              <h3>Assessment history</h3>
              <ul className="plain">
                {sum.assessments.map((a) => (
                  <li key={a.slug}><Link to={`/assessments/${a.slug}`}>{a.title}</Link> <span className={a.passed ? 'chip ok' : 'chip'}>best {Math.round(a.best)}%</span> <span className="muted">· {a.attempts} attempt{a.attempts === 1 ? '' : 's'}</span></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
