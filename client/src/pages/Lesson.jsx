import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';
import CodeRunner from '../components/CodeRunner.jsx';

export default function Lesson() {
  const { course, lesson: slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setData(null);
    setResult(null);
    setError('');
    api
      .get(`/api/courses/${course}/lessons/${slug}`)
      .then((d) => {
        setData(d);
        setCode(d.lesson.starter_code);
        setAnswers(new Array(d.lesson.quiz.length).fill(-1));
      })
      .catch((e) => setError(e.message));
    window.scrollTo(0, 0);
  }, [course, slug]);

  if (error) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;
  const { lesson, progress, prev, next } = data;
  const done = progress.status === 'completed' || result?.passed;

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.post(`/api/courses/${course}/lessons/${slug}/complete`, { answers });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="lesson">
      <p className="muted"><Link to={`/learn/${course}`}>← {lesson.course.title}</Link></p>
      <h1>{lesson.title} {done && <span className="chip ok">Completed</span>}</h1>

      <div className="prose"><ReactMarkdown>{lesson.content_md}</ReactMarkdown></div>

      <h2>Try it yourself</h2>
      <CodeRunner
        code={code}
        onChange={setCode}
        height={360}
        aiContext={{ kind: 'lesson', slug: lesson.slug, course }}
        extraActions={<button className="btn ghost" onClick={() => setCode(lesson.starter_code)}>Reset</button>}
      />

      {lesson.quiz.length > 0 && (
        <section className="card quiz">
          <h2>Knowledge check</h2>
          {lesson.quiz.map((q, i) => (
            <fieldset key={i} disabled={!!result?.passed}>
              <legend>{i + 1}. {q.q}</legend>
              {q.options.map((o, j) => {
                const r = result?.results[i];
                const cls = r ? (j === r.answer ? 'right' : answers[i] === j ? 'wrong' : '') : '';
                return (
                  <label key={j} className={`opt ${cls}`}>
                    <input type="radio" name={`q${i}`} checked={answers[i] === j}
                      onChange={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))} />
                    {o}
                  </label>
                );
              })}
              {result && <p className="muted explain">{result.results[i].explain}</p>}
            </fieldset>
          ))}

          {result && (
            <div className={`alert ${result.passed ? 'ok' : 'err'}`}>
              {result.passed
                ? `Nice! ${result.score}/${result.total} correct.${result.xpAwarded ? ` +${result.xpAwarded} XP earned 🎉` : ' (XP already earned)'}`
                : `${result.score}/${result.total} correct. You need at least 60% to complete the lesson. Review the explanations and try again.`}
            </div>
          )}
          {!result?.passed && (
            <button className="btn primary" onClick={submit} disabled={submitting || answers.includes(-1)}>
              {result ? 'Check again' : 'Submit answers'}
            </button>
          )}
          {!result?.passed && answers.includes(-1) && <small className="muted"> Answer every question to submit.</small>}
        </section>
      )}

      <div className="row-between lesson-nav">
        {prev ? <Link className="btn" to={`/learn/${course}/${prev.slug}`}>← {prev.title}</Link> : <span />}
        {next ? <Link className={`btn ${done ? 'primary' : ''}`} to={`/learn/${course}/${next.slug}`}>{next.title} →</Link> : <Link className="btn primary" to="/">Finish · back to dashboard</Link>}
      </div>
    </article>
  );
}
