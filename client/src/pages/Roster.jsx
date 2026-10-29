import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, useApi } from '../lib/api';
import { addDays, hhmm, monday, ymd } from '../lib/util';

export default function Roster() {
  const { me } = useAuth();
  const mgr = me.role !== 'staff';
  const [start, setStart] = useState(monday(ymd()));
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  const shifts = useApi('/shifts');
  const asg = useApi(`/shifts/assignments?from=${days[0]}&to=${days[6]}`);
  const staff = useApi(mgr ? '/staff?status=active' : null);
  const [sh, setSh] = useState({ name: '', start_time: '08:00', end_time: '17:00', grace_minutes: 10 });
  const [as, setAs] = useState({ staff_ids: [], shift_id: '', from: days[0], to: days[4] });
  const [err, setErr] = useState('');
  const run = async (fn) => { try { await fn(); setErr(''); } catch (e) { setErr(e.message); } };

  const addShift = (e) => { e.preventDefault(); run(async () => { await api('/shifts', { method: 'POST', body: sh }); shifts.reload(); }); };
  const assign = (e) => {
    e.preventDefault();
    const dates = []; for (let d = as.from; d <= as.to; d = addDays(d, 1)) dates.push(d);
    run(async () => { await api('/shifts/assignments', { method: 'POST', body: { staff_ids: as.staff_ids, shift_id: as.shift_id, dates } }); asg.reload(); });
  };
  const remove = (id) => run(async () => { await api('/shifts/assignments/' + id, { method: 'DELETE' }); asg.reload(); });
  const rows = mgr ? staff.data || [] : [{ id: me.staffId, full_name: 'My shifts' }];

  return (
    <>
      <h1>Roster</h1>
      {err && <p className="err">{err}</p>}
      <p>Week starting <input type="date" value={start} onChange={(e) => setStart(monday(e.target.value))} />
        {' '}<button className="ghost" onClick={() => setStart(addDays(start, -7))}>‹ Prev</button>
        <button className="ghost" onClick={() => setStart(addDays(start, 7))}>Next ›</button></p>
      <div className="scroll"><table>
        <thead><tr><th>Staff</th>{days.map((d) => <th key={d}>{new Date(d + 'T00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</th>)}</tr></thead>
        <tbody>{rows.map((s) => (
          <tr key={s.id}><td>{s.full_name}</td>{days.map((d) => {
            const a = asg.data?.find((x) => x.staff_id === s.id && x.work_date === d);
            return <td key={d}>{a && <span className="tag shift">{a.shifts.name} {hhmm(a.shifts.start_time)}–{hhmm(a.shifts.end_time)}{mgr && <button className="x" onClick={() => remove(a.id)}>×</button>}</span>}</td>;
          })}</tr>
        ))}</tbody>
      </table></div>

      {mgr && (
        <div className="two">
          <form className="card" onSubmit={addShift}>
            <h3>New shift</h3>
            <input required placeholder="Name (e.g. Morning)" value={sh.name} onChange={(e) => setSh({ ...sh, name: e.target.value })} />
            <input type="time" value={sh.start_time} onChange={(e) => setSh({ ...sh, start_time: e.target.value })} />
            <input type="time" value={sh.end_time} onChange={(e) => setSh({ ...sh, end_time: e.target.value })} />
            <input type="number" min="0" title="Grace minutes" value={sh.grace_minutes} onChange={(e) => setSh({ ...sh, grace_minutes: +e.target.value })} />
            <button>Add shift</button>
          </form>
          <form className="card" onSubmit={assign}>
            <h3>Assign shift</h3>
            <select multiple required value={as.staff_ids} onChange={(e) => setAs({ ...as, staff_ids: [...e.target.selectedOptions].map((o) => o.value) })}>
              {staff.data?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <select required value={as.shift_id} onChange={(e) => setAs({ ...as, shift_id: e.target.value })}>
              <option value="">Select shift</option>{shifts.data?.map((s) => <option key={s.id} value={s.id}>{s.name} {hhmm(s.start_time)}–{hhmm(s.end_time)}</option>)}
            </select>
            <input type="date" value={as.from} onChange={(e) => setAs({ ...as, from: e.target.value })} />
            <input type="date" value={as.to} onChange={(e) => setAs({ ...as, to: e.target.value })} />
            <button>Assign</button>
          </form>
        </div>
      )}
    </>
  );
}
