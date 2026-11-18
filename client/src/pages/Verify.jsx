import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

/** Public certificate page: anyone with the link can see it is genuine. No login needed. */
export default function Verify() {
  const { code } = useParams();
  const [cert, setCert] = useState(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    api.get(`/api/certificates/verify/${code}`).then((c) => { setCert(c); setState('ok'); }).catch(() => setState('invalid'));
  }, [code]);

  return (
    <div className="cert-page">
      <header className="cert-top"><Link to="/" className="brand"><span className="brand-mark">◆</span> TorchLab</Link></header>
      {state === 'loading' && <div className="muted center">Checking certificate…</div>}
      {state === 'invalid' && (
        <div className="card cert-invalid">
          <h2>Certificate not found</h2>
          <p className="muted">No certificate with the code <code>{code}</code> exists. Check the code for typos.</p>
        </div>
      )}
      {state === 'ok' && (
        <>
          <div className="certificate">
            <div className="cert-mark">◆</div>
            <div className="cert-kicker">Certificate of completion</div>
            <div className="cert-name">{cert.name}</div>
            <p>has successfully completed</p>
            <div className="cert-title">{cert.title}</div>
            <p className="muted">on {new Date(cert.issuedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <div className="cert-code">Verification code <strong>{cert.code}</strong></div>
          </div>
          <p className="center no-print"><span className="chip ok">✓ Verified by TorchLab</span> <button className="btn" onClick={() => window.print()}>Print / save as PDF</button></p>
        </>
      )}
    </div>
  );
}
