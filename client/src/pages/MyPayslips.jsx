import { download, useApi } from '../lib/api';
import { naira } from '../lib/util';

export default function MyPayslips() {
  const { data, error } = useApi('/payroll/my-payslips');
  const row = (l, v) => <tr><td>{l}</td><td>{naira(v)}</td></tr>;
  return (
    <>
      <h1>My payslips</h1>
      {error && <p className="err">{error}</p>}
      {data?.length === 0 && <p>No approved payslips yet.</p>}
      {data?.map((s) => (
        <div className="card print-area" key={s.id}>
          <h3>{s.payroll_runs.period_start} → {s.payroll_runs.period_end} <span className={'tag ' + s.payroll_runs.status}>{s.payroll_runs.status}</span></h3>
          <p>Days present {s.days_present}/{s.days_scheduled} · Hours {s.hours_worked} · Overtime {s.overtime_hours}h</p>
          <table><tbody>
            {row('Base pay', s.base_pay)}{row('Overtime', s.overtime_pay)}{row('Bonus', s.bonus)}
            {row('Absence deduction', -s.absence_deduction)}{row('Late deduction', -s.late_deduction)}{row('Other deductions', -s.other_deduction)}{row('Pension (8%)', -s.pension_employee)}{row('PAYE tax', -s.paye_tax)}
            <tr><td><b>Net pay</b></td><td><b>{naira(s.net_pay)}</b></td></tr>
          </tbody></table>
          <button className="ghost noprint" onClick={() => download(`/payroll/payslips/${s.id}/pdf`, `payslip-${s.payroll_runs.period_end}.pdf`).catch((e) => alert(e.message))}>Download PDF</button>
        </div>
      ))}
    </>
  );
}
