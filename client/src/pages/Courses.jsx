import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Courses() {
  const [courses, setCourses] = useState(null);
  useEffect(() => {
    api.get('/api/courses').then((d) => setCourses(d.courses));
  }, []);
  if (!courses) return <div className="muted">Loading…</div>;
  return (
    <>
      <h1>Learn</h1>
      <div className="grid2">
        {courses.map((c) => (
          <Link key={c.slug} to={`/learn/${c.slug}`} className="card course-card">
            <span className="chip">{c.level}</span>
            <h3>{c.title}</h3>
            <p className="muted">{c.description}</p>
            <div className="bar"><div style={{ width: `${c.total ? (c.completed / c.total) * 100 : 0}%` }} /></div>
            <small className="muted">{c.completed}/{c.total} lessons</small>
          </Link>
        ))}
      </div>
    </>
  );
}
