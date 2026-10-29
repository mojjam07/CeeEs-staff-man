import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { signIn, forgot } = useAuth();
  const [f, setF] = useState({ email: '', password: '' });
  const [mode, setMode] = useState('signin');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo('');
    try {
      if (mode === 'signin') await signIn(f.email, f.password);
      else { await forgot(f.email); setInfo('If that email has an account, a reset link is on its way.'); }
    } catch (x) { setErr(x.message); }
  };
  return (
    <form className="card login" onSubmit={submit}>
      <h2>Staff & Attendance</h2>
      <input type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      {mode === 'signin' && <input type="password" placeholder="Password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
      {err && <p className="err">{err}</p>}
      {info && <p>{info}</p>}
      <button>{mode === 'signin' ? 'Sign in' : 'Send reset link'}</button>
      <button type="button" className="ghost" onClick={() => { setMode(mode === 'signin' ? 'forgot' : 'signin'); setErr(''); setInfo(''); }}>
        {mode === 'signin' ? 'Forgot password?' : 'Back to sign in'}
      </button>
    </form>
  );
}
