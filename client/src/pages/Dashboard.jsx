import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, useApi } from '../lib/api';
import { time, ymd } from '../lib/util';

export default function Dashboard() {
  const { me } = useAuth();
  const today = ymd();
  const { data: rows, reload } = useApi(`/attendance?from=${today}&to=${today}`);
  const [msg, setMsg] = useState('');
  const mine = rows?.find((r) => r.staff_id === me.staffId);
  const act = async (p) => {
    try { await api('/attendance/' + p, { method: 'POST', body: {} }); setMsg(''); reload(); } catch (e) { setMsg(e.message); }
  };
  const count = (s) => rows?.filter((r) => r.status === s).length ?? 0;

  return (
    <>
      <h1>Today · {today}</h1>
      {me.staffId && (
        <div className="card">
          <p>{!mine ? 'You have not clocked in yet.' : `Clocked in ${time(mine.clock_in)}${mine.status === 'late' ? ` (late ${mine.late_minutes} min)` : ''}${mine.clock_out ? ` · out ${time(mine.clock_out)}` : ''}`}</p>
          <button disabled={!!mine?.clock_in} onClick={() => act('clock-in')}>Clock in</button>{' '}
          <button disabled={!mine?.clock_in || !!mine?.clock_out} onClick={() => act('clock-out')}>Clock out</button>
          {msg && <p className="err">{msg}</p>}
        </div>
      )}
      {me.role !== 'staff' && (
        <>
          <div className="stats">
            <div className="card"><b>{count('present')}</b>On time</div>
            <div className="card"><b>{count('late')}</b>Late</div>
            <div className="card"><b>{count('leave')}</b>On leave</div>
            <div className="card"><b>{count('absent')}</b>Absent</div>
          </div>
          <div className="scroll"><table>
            <thead><tr><th>Staff</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
            <tbody>{rows?.map((r) => <tr key={r.id}><td>{r.staff?.full_name}</td><td>{time(r.clock_in)}</td><td>{time(r.clock_out)}</td><td><span className={'tag ' + r.status}>{r.status}</span></td></tr>)}</tbody>
          </table></div>
        </>
      )}
    </>
  );
}
