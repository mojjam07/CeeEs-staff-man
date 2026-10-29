import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, useApi } from '../lib/api';
import { naira } from '../lib/util';

const blank = { full_name: '', email: '', phone: '', position: '', department: '', pay_type: 'monthly', pay_rate: '', password: '', role: 'staff', bank_name: '', bank_code: '', account_number: '', account_name: '', annual_rent: '', pensionable_pay: '', pension_enabled: true };

export default function Staff() {
  const { me } = useAuth();
  const admin = me.role === 'admin';
  const [q, setQ] = useState('');
  const { data, error, reload } = useApi(`/staff?q=${encodeURIComponent(q)}`);
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    try {
      await api('/staff', { method: 'POST', body: { ...f, pay_rate: Number(f.pay_rate || 0), password: f.password || undefined, annual_rent: Number(f.annual_rent || 0), pensionable_pay: f.pensionable_pay === '' ? null : Number(f.pensionable_pay) } });
      setF(blank); setErr(''); reload();
    } catch (x) { setErr(x.message); }
  };
  const toggle = async (s) => {
    await api('/staff/' + s.id, admin && s.status === 'inactive' ? { method: 'PATCH', body: { status: 'active' } } : { method: 'DELETE' });
    reload();
  };

  return (
    <>
      <h1>Staff</h1>
      {admin && (
        <form className="card grid" onSubmit={add}>
          <input required placeholder="Full name" value={f.full_name} onChange={set('full_name')} />
          <input type="email" placeholder="Email" value={f.email} onChange={set('email')} />
          <input placeholder="Phone" value={f.phone} onChange={set('phone')} />
          <input placeholder="Position" value={f.position} onChange={set('position')} />
          <input placeholder="Department" value={f.department} onChange={set('department')} />
          <select value={f.pay_type} onChange={set('pay_type')}><option value="monthly">Monthly salary</option><option value="hourly">Hourly rate</option></select>
          <input type="number" min="0" placeholder="Pay rate (₦)" value={f.pay_rate} onChange={set('pay_rate')} />
          <input type="password" placeholder="Login password (optional)" value={f.password} onChange={set('password')} />
          <select value={f.role} onChange={set('role')}><option>staff</option><option>manager</option><option>admin</option></select>
          <input placeholder="Bank name" value={f.bank_name} onChange={set('bank_name')} />
          <input placeholder="Bank code (e.g. 058)" value={f.bank_code} onChange={set('bank_code')} />
          <input placeholder="Account number" inputMode="numeric" maxLength={10} value={f.account_number} onChange={set('account_number')} />
          <input placeholder="Account name" value={f.account_name} onChange={set('account_name')} />
          <input type="number" min="0" placeholder="Annual rent paid (₦, for rent relief)" value={f.annual_rent} onChange={set('annual_rent')} />
          <input type="number" min="0" placeholder="Monthly pensionable pay (blank = base pay)" value={f.pensionable_pay} onChange={set('pensionable_pay')} />
          <label><input type="checkbox" checked={f.pension_enabled} onChange={(e) => setF({ ...f, pension_enabled: e.target.checked })} /> Pension applies</label>
          <button>Add staff</button>
          {err && <p className="err">{err}</p>}
        </form>
      )}
      <input placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="err">{error}</p>}
      <div className="scroll"><table>
        <thead><tr><th>Name</th><th>Position</th><th>Contact</th>{admin && <th>Pay</th>}<th>Status</th>{admin && <th />}</tr></thead>
        <tbody>{data?.map((s) => (
          <tr key={s.id}>
            <td>{s.full_name}</td><td>{s.position} {s.department && `· ${s.department}`}</td><td>{s.email} {s.phone}</td>
            {admin && <td>{naira(s.pay_rate)}{s.pay_type === 'hourly' ? '/hr' : '/mo'}</td>}
            <td><span className={'tag ' + s.status}>{s.status}</span></td>
            {admin && <td><button className="ghost" onClick={() => toggle(s)}>{s.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></td>}
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
