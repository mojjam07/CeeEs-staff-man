import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, useApi } from '../lib/api';
import { ymd } from '../lib/util';

export default function Leave() {
  const { me } = useAuth();
  const mgr = me.role !== 'staff';
  const [filter, setFilter] = useState(mgr ? 'pending' : '');
  const { data, error, reload } = useApi('/leave' + (filter ? '?status=' + filter : ''));
  const staff = useApi(mgr ? '/staff?status=active' : null);
  const [f, setF] = useState({ staff_id: '', type: 'annual', start_date: ymd(), end_date: ymd(), reason: '' });
  const [err, setErr] = useState('');
  const bal = useApi(`/leave/balances?staff_id=${f.staff_id}`);
  const ent = useApi(me.role === 'admin' ? '/leave/entitlements' : null);
  const run = async (fn) => { try { await fn(); setErr(''); reload(); bal.reload(); } catch (e) { setErr(e.message); } };
  const review = (id, status) => {
    const note = window.prompt(status === 'approved' ? 'Note (optional)' : 'Reason for rejecting (optional)') ?? null;
    if (note === null) return;
    run(() => api(`/leave/${id}/review`, { method: 'PATCH', body: { status, note } }));
  };
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;

  return (
    <>
      <h1>Leave</h1>
      <div className="stats">{bal.data?.filter((b) => b.type !== 'unpaid').map((b) => (
        <div className="card" key={b.type}><b>{b.remaining ?? '∞'}</b>{b.type} days left<br /><small>{b.used}/{b.entitlement === null ? '∞' : b.entitlement + b.carried} used{b.carried ? ` · incl. ${b.carried} carried over` : ''}{b.pending ? ` · ${b.pending} pending` : ''}</small></div>
      ))}</div>
      {me.role === 'admin' && ent.data && (
        <details className="card"><summary>Yearly entitlements (working days)</summary><div className="grid">
          {ent.data.filter((e) => e.type !== 'unpaid').map((e) => (
            <form key={e.type} onSubmit={(ev) => { ev.preventDefault(); const d = new FormData(ev.target); run(() => api('/leave/entitlements', { method: 'PUT', body: [{ type: e.type, days_per_year: d.get('days'), carry_over_days: d.get('carry') }] }).then(ent.reload)); }}>
              <b>{e.type}</b> <input name="days" className="num" type="number" min="0" defaultValue={e.days_per_year} /> days · carry over up to <input name="carry" className="num" type="number" min="0" defaultValue={e.carry_over_days} /> <button className="ghost">Save</button>
            </form>
          ))}
        </div></details>
      )}
      <form className="card grid" onSubmit={(e) => { e.preventDefault(); run(() => api('/leave', { method: 'POST', body: { ...f, staff_id: f.staff_id || undefined } })); }}>
        {mgr && <select value={f.staff_id} onChange={(e) => setF({ ...f, staff_id: e.target.value })}><option value="">Myself</option>{staff.data?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>}
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['annual', 'sick', 'casual', 'unpaid'].map((t) => <option key={t}>{t}</option>)}</select>
        <input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        <input type="date" value={f.end_date} min={f.start_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
        <input placeholder="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <button>{mgr ? 'Submit request' : 'Request leave'}</button>
      </form>
      {(error || err) && <p className="err">{error || err}</p>}
      <p>Show <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All</option><option>pending</option><option>approved</option><option>rejected</option></select></p>
      <div className="scroll"><table>
        <thead><tr><th>Staff</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th /></tr></thead>
        <tbody>{data?.map((l) => (
          <tr key={l.id}><td>{l.staff?.full_name}</td><td>{l.type}</td><td>{l.start_date} → {l.end_date} ({days(l.start_date, l.end_date)}d)</td>
            <td>{l.reason}{l.review_note && <small> · {l.review_note}</small>}</td><td><span className={'tag ' + (l.status === 'rejected' ? 'absent' : l.status === 'approved' ? 'present' : 'late')}>{l.status}</span></td>
            <td>{l.status === 'pending' && <>
              {mgr && <><button onClick={() => review(l.id, 'approved')}>Approve</button> <button className="ghost" onClick={() => review(l.id, 'rejected')}>Reject</button> </>}
              <button className="ghost" onClick={() => run(() => api('/leave/' + l.id, { method: 'DELETE' }))}>Withdraw</button>
            </>}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
