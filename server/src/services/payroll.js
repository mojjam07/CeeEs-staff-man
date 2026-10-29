import { supabase } from '../supabase.js';
import { statutory } from './tax.js';
import { must, shiftHours, round2 } from '../util.js';

const OT = Number(process.env.OVERTIME_MULTIPLIER ?? 1.5);
const LATE_RATE = Number(process.env.LATE_PENALTY_PER_MINUTE ?? 0);

const weekdays = (from, to) => {
  let n = 0;
  for (let d = new Date(from); d <= new Date(to); d.setUTCDate(d.getUTCDate() + 1)) if (![0, 6].includes(d.getUTCDay())) n++;
  return n;
};

export function computePayslip(s, att, assigns, from, to) {
  const shiftLen = Object.fromEntries(assigns.map((a) => [a.work_date, shiftHours(a.shifts.start_time, a.shifts.end_time)]));
  const avgShift = assigns.length ? assigns.reduce((t, a) => t + shiftHours(a.shifts.start_time, a.shifts.end_time), 0) / assigns.length : 8;
  const scheduled = assigns.length || weekdays(from, to);

  const worked = att.filter((a) => ['present', 'late'].includes(a.status));
  const leave = att.filter((a) => a.status === 'leave').length;
  const hours = worked.reduce((t, a) => t + Number(a.hours_worked), 0);
  const lateMin = worked.reduce((t, a) => t + a.late_minutes, 0);
  const otHours = worked.reduce((t, a) => t + Math.max(0, Number(a.hours_worked) - (shiftLen[a.work_date] ?? avgShift)), 0);

  const rate = Number(s.pay_rate);
  const absent = Math.max(0, scheduled - worked.length - leave);
  const daily = s.pay_type === 'monthly' ? rate / (scheduled || 1) : 0;
  const hourlyEq = s.pay_type === 'monthly' ? daily / avgShift : rate;

  const base = s.pay_type === 'monthly' ? rate : hours * rate;
  const overtime = otHours * hourlyEq * (s.pay_type === 'hourly' ? OT - 1 : OT); // hourly base already pays 1x
  const absenceDed = daily * absent;
  const lateDed = lateMin * LATE_RATE;

  const earned = base + overtime - absenceDed - lateDed;
  const st = statutory({ earned, base, pensionable: s.pensionable_pay, annualRent: s.annual_rent, pensionEnabled: s.pension_enabled !== false });
  return {
    staff_id: s.id, days_scheduled: scheduled, days_present: worked.length, days_late: worked.filter((a) => a.status === 'late').length,
    days_leave: leave, hours_worked: round2(hours), overtime_hours: round2(otHours),
    base_pay: round2(base), overtime_pay: round2(overtime), bonus: 0,
    absence_deduction: round2(absenceDed), late_deduction: round2(lateDed), other_deduction: 0,
    pension_employee: st.pensionEmployee, pension_employer: st.pensionEmployer, paye_tax: st.paye,
    net_pay: round2(earned - st.pensionEmployee - st.paye),
  };
}

export async function generateRun(from, to, userId) {
  const run = must(await supabase.from('payroll_runs').insert({ period_start: from, period_end: to, created_by: userId }).select().single());
  const staff = must(await supabase.from('staff').select('*').eq('status', 'active'));
  const att = must(await supabase.from('attendance').select('*').gte('work_date', from).lte('work_date', to));
  const asg = must(await supabase.from('shift_assignments').select('staff_id,work_date,shifts(start_time,end_time)').gte('work_date', from).lte('work_date', to));
  const rows = staff.map((s) => ({
    run_id: run.id,
    ...computePayslip(s, att.filter((a) => a.staff_id === s.id), asg.filter((a) => a.staff_id === s.id), from, to),
  }));
  if (rows.length) must(await supabase.from('payslips').insert(rows));
  return run;
}
