import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const PERIODS = [['weekly', 'This week'], ['monthly', 'This month'], ['all', 'All time']];

export default function Leaderboard() {
  const [period, setPeriod] = useState('weekly');
  const [scope, setScope] = useState('global');
  const [board, setBoard] = useState(null);
  const [team, setTeam] = useState(undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const loadBoard = useCallback(() => api.get(`/api/leaderboard?period=${period}&scope=${scope}`).then(setBoard).catch((e) => setError(e.message)), [period, scope]);
  const loadTeam = useCallback(() => api.get('/api/leaderboard/teams/mine').then((d) => setTeam(d.team)).catch((e) => setError(e.message)), []);
  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { loadTeam(); }, [loadTeam]);

  const act = async (fn) => {
    setNotice('');
    try { await fn(); await Promise.all([loadBoard(), loadTeam()]); }
    catch (e) { setNotice(e.message); }
  };
  const createTeam = (e) => { e.preventDefault(); act(async () => { await api.post('/api/leaderboard/teams', { name }); setName(''); }); };
  const joinTeam = (e) => { e.preventDefault(); act(async () => { await api.post('/api/leaderboard/teams/join', { code }); setCode(''); }); };
  const leave = () => window.confirm('Leave this team?') && act(() => api.post('/api/leaderboard/teams/leave'));
  const toggleVisible = () => act(() => api.put('/api/leaderboard/visibility', { visible: !board.me.visible }));

  if (error) return <div className="alert err">{error}</div>;
  if (!board || team === undefined) return <div className="muted">Loading…</div>;

  return (
    <div>
      <h1>Leaderboard</h1>
      <p className="muted">Ranked by XP earned in the period. XP comes from lessons, challenges, assessments, projects and badges.</p>

      <div className="row-gap">
        <div className="seg">
          {PERIODS.map(([k, label]) => <button key={k} className={period === k ? 'active' : ''} onClick={() => setPeriod(k)}>{label}</button>)}
        </div>
        <div className="seg">
          <button className={scope === 'global' ? 'active' : ''} onClick={() => setScope('global')}>Everyone</button>
          <button className={scope === 'team' ? 'active' : ''} onClick={() => setScope('team')}>My team</button>
        </div>
      </div>

      <div className="lb-layout">
        <section className="card">
          {board.noTeam ? (
            <p className="muted">You are not in a team yet. Create one or join with a code on the right.</p>
          ) : board.entries.length === 0 ? (
            <p className="muted">No XP earned in this period yet. Complete a lesson to get on the board!</p>
          ) : (
            <table className="lb-table">
              <thead><tr><th>#</th><th>Learner</th><th className="num">XP</th></tr></thead>
              <tbody>
                {board.entries.map((e) => (
                  <tr key={e.id} className={e.isMe ? 'me' : ''}>
                    <td>{e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</td>
                    <td>{e.name}{e.isMe && <span className="chip soft"> you</span>}</td>
                    <td className="num">{e.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!board.noTeam && (
            <p className="muted small-note">
              {board.me.rank ? <>Your rank: <strong>#{board.me.rank}</strong> with {board.me.xp} XP{!board.me.visible && ' (hidden from others)'}.</> : 'You have no XP in this period yet.'}
            </p>
          )}
          <label className="row-gap switch">
            <input type="checkbox" checked={board.me.visible} onChange={toggleVisible} />
            <span className="muted small-note">Show my name on the public leaderboard</span>
          </label>
        </section>

        <section>
          {notice && <div className="alert err">{notice}</div>}
          {team ? (
            <div className="card">
              <h3>{team.name}</h3>
              <p className="muted small-note">
                Share this join code with teammates: <code className="join-code">{team.joinCode}</code>{' '}
                <button className="btn small" onClick={() => navigator.clipboard?.writeText(team.joinCode)}>Copy</button>
              </p>
              <table className="lb-table">
                <thead><tr><th>Member</th><th className="num">Week</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {team.members.map((m) => <tr key={m.id}><td>{m.name}</td><td className="num">{m.weekly_xp}</td><td className="num">{m.xp}</td></tr>)}
                </tbody>
              </table>
              <p className="muted small-note">Team total: <strong>{team.totalXp} XP</strong> · {team.members.length} member{team.members.length === 1 ? '' : 's'}</p>
              <button className="btn ghost" onClick={leave}>Leave team</button>
            </div>
          ) : (
            <div className="card">
              <h3>Join a team</h3>
              <form onSubmit={joinTeam} className="inline-form">
                <input placeholder="6-character join code" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
                <button className="btn primary" type="submit">Join</button>
              </form>
              <h3>Or create one</h3>
              <form onSubmit={createTeam} className="inline-form">
                <input placeholder="Team name" value={name} minLength={2} maxLength={40} onChange={(e) => setName(e.target.value)} required />
                <button className="btn" type="submit">Create</button>
              </form>
              <p className="muted small-note">Teams are great for classes and study groups: you get a private board and a code to share.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
