import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

/**
 * "Continue with Google" using Google Identity Services.
 * The server tells us the client id (GET /api/auth/config), so there is a single place to configure it.
 */
export default function GoogleButton({ onCredential }) {
  const [clientId, setClientId] = useState(undefined); // undefined = loading, null = not configured
  const holder = useRef(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;

  useEffect(() => {
    api.get('/api/auth/config').then((d) => setClientId(d.googleClientId)).catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !holder.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => handler.current(r.credential),
      });
      window.google.accounts.id.renderButton(holder.current, {
        theme: 'outline', size: 'large', width: 320, text: 'continue_with', shape: 'rectangular',
      });
    };
    if (window.google?.accounts?.id) {
      init();
    } else {
      let s = document.querySelector('script[data-gsi]');
      if (!s) {
        s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.dataset.gsi = '1';
        document.head.appendChild(s);
      }
      s.addEventListener('load', init);
    }
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (clientId === undefined) return null;
  if (!clientId) return <p className="muted center small">Google sign-in is not set up on this server yet.</p>;
  return (
    <>
      <div className="divider"><span>or</span></div>
      <div ref={holder} className="google-holder" />
    </>
  );
}
