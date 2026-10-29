import { useState } from 'react';
import { useAuth } from '../auth.jsx';

// Used both for "change my password" (signed in) and for the password-reset email link (recovery=true)
export default function Account({ recovery = false }) {
  const { changePassword } = useAuth();
  const [pw, setPw] = useState({ a: '', b: '' });
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (pw.a.length < 8) return setMsg({ err: 'Use at least 8 characters.', ok: '' });
    if (pw.a !== pw.b) return setMsg({ err: 'Passwords do not match.', ok: '' });
    try { await changePassword(pw.a); setPw({ a: '', b: '' }); setMsg({ ok: 'Password updated.', err: '' }); }
    catch (x) { setMsg({ err: x.message, ok: '' }); }
  };
  return (
    <form className={'card' + (recovery ? ' login' : '')} onSubmit={submit} style={recovery ? undefined : { maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2>{recovery ? 'Set a new password' : 'Change password'}</h2>
      <input type="password" placeholder="New password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
      <input type="password" placeholder="Confirm new password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
      {msg.err && <p className="err">{msg.err}</p>}
      {msg.ok && <p>{msg.ok}</p>}
      <button>Update password</button>
    </form>
  );
}
