import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';

let statusCache = null;
const loadStatus = (force) => {
  if (!statusCache || force) statusCache = api.get('/api/ai/status').catch(() => ({ configured: false }));
  return statusCache;
};

/**
 * "AI help" strip: explain, fix an error, hint, review. Renders nothing when the server has no API key.
 * `context` says where the learner is ({kind:'challenge', slug} ...) so the server can add the task text,
 * and so it can keep reference solutions out of the answer.
 */
export default function AiAssist({ code, output = '', context, exercise = false }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');

  useEffect(() => { let on = true; loadStatus().then((s) => on && setStatus(s)); return () => { on = false; }; }, []);
  if (!status?.configured) return null;

  const left = Math.max(0, status.dailyLimit - status.usedToday);
  const hasError = /error|traceback|exception|failed|did not finish/i.test(output);

  const ask = async (mode) => {
    setBusy(mode); setError(''); setAnswer(null);
    try {
      const r = await api.post('/api/ai/assist', { mode, code, output: output || undefined, question: question.trim() || undefined, context });
      setAnswer({ mode, ...r });
      setStatus((s) => ({ ...s, usedToday: r.usedToday }));
      statusCache = Promise.resolve({ ...status, usedToday: r.usedToday });
    } catch (e) {
      setError(e.message);
      if (e.status === 403) loadStatus(true).then(setStatus);
    } finally { setBusy(''); }
  };

  const btn = (mode, label, disabled) => (
    <button className="btn small" disabled={!!busy || disabled || status.paused || left === 0} onClick={() => ask(mode)}>{busy === mode ? 'Thinking…' : label}</button>
  );

  return (
    <section className="card ai-assist" aria-label="AI help">
      <div className="row-between">
        <strong>✨ AI help</strong>
        <span className="muted sm">{status.paused ? 'Paused during an assessment' : `${left} of ${status.dailyLimit} left today`}</span>
      </div>
      <div className="row-gap" style={{ margin: '.6rem 0' }}>
        {btn('explain', 'Explain my code', !code.trim())}
        {btn('debug', 'Help me fix this', !code.trim() || !hasError)}
        {btn('hint', exercise ? 'Give me a hint' : 'Suggest next step', !code.trim())}
        {btn('review', 'Review my code', !code.trim())}
      </div>
      <input placeholder="Optional: ask something specific (max 400 characters)" maxLength={400} value={question} onChange={(e) => setQuestion(e.target.value)} />
      {error && <div className="alert err" style={{ marginTop: '.6rem' }}>{error}</div>}
      {answer && (
        <div className={`ai-answer ${answer.withheld ? 'withheld' : ''}`}>
          <div className="prose"><ReactMarkdown>{answer.answer}</ReactMarkdown></div>
          <p className="muted sm">AI can make mistakes. Check important details against the lesson and the PyTorch docs.</p>
        </div>
      )}
      {exercise && !answer && <p className="muted sm" style={{ marginBottom: 0 }}>On exercises the assistant guides you but will not write the full solution.</p>}
    </section>
  );
}
