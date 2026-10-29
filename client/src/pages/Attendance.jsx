import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, useApi } from '../lib/api';
import { time, ymd } from '../lib/util';

export default function Attendance() {
  const { me } = useAuth();
  const mgr = me.role !== 'staff';
  const [from, setFrom] = useState(ymd().slice(0, 8) + '01');
  const [to, setTo] = useState(ymd());
  const [sid, setSid] = useState('');
  const { data, error, reload } = useApi(`/attendance?from=${from}&to=${to}${sid ? '&staff_id=' + sid : ''}`);
  const staff = useApi(mgr ? '/staff?status=active' : null);
  const [m, setM] = useState({ staff_id: '', work_date: ymd(), status: 'absent', note: '' });
  const [err, setErr] = useState('');
  const run = async (fn) => { try { await fn(); setErr(''); reload(); } catch (e) { setErr(e.message); } };

  return (
    <>
      <h1>Attendance</h1>
      <p>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /> to <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />{' '}
        {mgr && <select value={sid} onChange={(e) => setSid(e.target.value)}><option value="">All staff</option>{staff.data?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>}
      </p>
      {(error || err) && <p className="err">{error || err}</p>}
      <div className="scroll"><table>
        <thead><tr><th>Date</th><th>Staff</th><th>In</th><th>Out</th><th>Hours</th><th>Late</th><th>Status</th><th>Note</th></tr></thead>
        <tbody>{data?.map((r) => (
          <tr key={r.id}><td>{r.work_date}</td><td>{r.staff?.full_name}</td><td>{time(r.clock_in)}</td><td>{time(r.clock_out)}</td><td>{r.hours_worked}</td><td>{r.late_minutes || ''}</td>
            <td>{mgr ? <select value={r.status} onChange={(e) => run(() => api('/attendance/' + r.id, { method: 'PATCH', body: { status: e.target.value } }))}>
              {['present', 'late', 'absent', 'leave'].map((s) => <option key={s}>{s}</option>)}</select> : <span className={'tag ' + r.status}>{r.status}</span>}</td>
            <td>{r.note}</td></tr>
        ))}</tbody>
      </table></div>
      {mgr && (
        <form className="card grid" onSubmit={(e) => { e.preventDefault(); run(() => api('/attendance/manual', { method: 'POST', body: m })); }}>
          <h3>Add / override a day</h3>
          <select required value={m.staff_id} onChange={(e) => setM({ ...m, staff_id: e.target.value })}><option value="">Staff</option>{staff.data?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
          <input type="date" value={m.work_date} onChange={(e) => setM({ ...m, work_date: e.target.value })} />
          <select value={m.status} onChange={(e) => setM({ ...m, status: e.target.value })}>{['absent', 'leave', 'present', 'late'].map((s) => <option key={s}>{s}</option>)}</select>
          <input placeholder="Note" value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} />
          <button>Save</button>
        </form>
      )}
    </>
  );
}
