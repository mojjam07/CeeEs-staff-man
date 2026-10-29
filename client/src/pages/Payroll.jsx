import { useState } from 'react';
import { api, download, useApi } from '../lib/api';
import { naira, ymd } from '../lib/util';

export default function Payroll() {
  const runs = useApi('/payroll/runs');
  const [openId, setOpenId] = useState(null);
  const run = useApi(openId ? '/payroll/runs/' + openId : null);
  const [p, setP] = useState({ period_start: ymd().slice(0, 8) + '01', period_end: ymd() });
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const go = async (fn) => { try { await fn(); setErr(''); runs.reload(); run.reload(); } catch (e) { setErr(e.message); } };
  const r = run.data;
  const draft = r?.status === 'draft';
  const paystack = () => {
    if (!window.confirm(`Send ${naira(r.total_net)} to staff via Paystack?`)) return;
    go(async () => {
      const x = await api(`/payroll/runs/${r.id}/paystack`, { method: 'POST' });
      setInfo(`Queued ${x.queued} transfer(s) on Paystack.` + (x.skipped.length ? ` Skipped (no bank details): ${x.skipped.join(', ')}.` : '') + ' Confirm in Paystack, then Mark paid.');
    });
  };
  const adjust = (id, field, v) => go(() => api('/payroll/payslips/' + id, { method: 'PATCH', body: { [field]: Number(v || 0) } }));

  return (
    <>
      <h1>Payroll</h1>
      {err && <p className="err">{err}</p>}
      {info && <p>{info}</p>}
      <form className="card grid" onSubmit={(e) => { e.preventDefault(); go(async () => setOpenId((await api('/payroll/runs', { method: 'POST', body: p })).id)); }}>
        <input type="date" value={p.period_start} onChange={(e) => setP({ ...p, period_start: e.target.value })} />
        <input type="date" value={p.period_end} onChange={(e) => setP({ ...p, period_end: e.target.value })} />
        <button>Generate draft run</button>
      </form>
      <div className="scroll"><table>
        <thead><tr><th>Period</th><th>Status</th><th /></tr></thead>
        <tbody>{runs.data?.map((x) => <tr key={x.id}><td>{x.period_start} → {x.period_end}</td><td><span className={'tag ' + x.status}>{x.status}</span></td><td><button className="ghost" onClick={() => setOpenId(x.id)}>Open</button></td></tr>)}</tbody>
      </table></div>

      {r && (
        <section className="print-area">
          <h2>{r.period_start} → {r.period_end} <span className={'tag ' + r.status}>{r.status}</span></h2>
          <div className="scroll"><table>
            <thead><tr><th>Staff</th><th>Days</th><th>Hrs</th><th>Base</th><th>OT</th><th>Bonus</th><th>Absence</th><th>Late</th><th>Other ded.</th><th>Pension</th><th>PAYE</th><th>Net</th><th /></tr></thead>
            <tbody>{r.payslips.map((s) => (
              <tr key={s.id}><td>{s.staff.full_name}</td><td>{s.days_present}/{s.days_scheduled}{s.days_leave ? ` +${s.days_leave}L` : ''}</td><td>{s.hours_worked}</td>
                <td>{naira(s.base_pay)}</td><td>{naira(s.overtime_pay)}</td>
                <td>{draft ? <input className="num" type="number" defaultValue={s.bonus} onBlur={(e) => +e.target.value !== +s.bonus && adjust(s.id, 'bonus', e.target.value)} /> : naira(s.bonus)}</td>
                <td>{naira(s.absence_deduction)}</td><td>{naira(s.late_deduction)}</td>
                <td>{draft ? <input className="num" type="number" defaultValue={s.other_deduction} onBlur={(e) => +e.target.value !== +s.other_deduction && adjust(s.id, 'other_deduction', e.target.value)} /> : naira(s.other_deduction)}</td>
                <td>{naira(s.pension_employee)}</td><td>{naira(s.paye_tax)}</td>
                <td><b>{naira(s.net_pay)}</b> {s.payout_status && <span className="tag leave">{s.payout_status}</span>}</td>
                <td className="noprint"><button className="ghost" onClick={() => go(() => download(`/payroll/payslips/${s.id}/pdf`, `payslip-${s.staff.full_name}.pdf`))}>PDF</button></td></tr>
            ))}</tbody>
            <tfoot><tr><td colSpan="11">Total net</td><td><b>{naira(r.total_net)}</b></td><td /></tr></tfoot>
          </table></div>
          <p className="noprint">
            {draft && <button onClick={() => go(() => api(`/payroll/runs/${r.id}/approve`, { method: 'POST' }))}>Approve</button>}{' '}
            {r.status === 'approved' && <button onClick={() => go(() => api(`/payroll/runs/${r.id}/pay`, { method: 'POST' }))}>Mark paid</button>}{' '}
            {draft && <button className="ghost" onClick={() => go(async () => { await api('/payroll/runs/' + r.id, { method: 'DELETE' }); setOpenId(null); })}>Delete draft</button>}{' '}
            {r.status !== 'draft' && <button className="ghost" onClick={() => go(() => download(`/payroll/runs/${r.id}/export.csv`, `payouts-${r.period_end}.csv`))}>Bank CSV</button>}{' '}
            {r.status === 'approved' && <button className="ghost" onClick={paystack}>Pay via Paystack</button>}{' '}
            {r.status !== 'draft' && <button className="ghost" onClick={() => go(() => download(`/payroll/runs/${r.id}/statutory.csv`, `statutory-${r.period_end}.csv`))}>Pension/PAYE CSV</button>}{' '}
            <button className="ghost" onClick={() => window.print()}>Print</button>
          </p>
        </section>
      )}
    </>
  );
}
