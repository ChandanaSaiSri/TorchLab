import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

const icon = { completed: '✅', in_progress: '◐', not_started: '○' };

export default function Course() {
  const { course } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/api/courses/${course}`).then(setData).catch((e) => setError(e.message));
  }, [course]);
  if (error) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;
  return (
    <>
      <p className="muted"><Link to="/learn">← All courses</Link></p>
      <h1>{data.course.title}</h1>
      <p className="muted">{data.course.description}</p>
      <ol className="lesson-list">
        {data.lessons.map((l) => (
          <li key={l.slug}>
            <Link to={`/learn/${course}/${l.slug}`} className="card lesson-row">
              <span className="lesson-icon">{icon[l.status]}</span>
              <span className="grow"><strong>{l.position}. {l.title}</strong></span>
              <span className="chip">+{l.xp} XP</span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
