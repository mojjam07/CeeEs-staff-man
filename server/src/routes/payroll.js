import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireRole } from '../middleware/auth.js';
import { must, pick, httpError, round2 } from '../util.js';
import { generateRun } from '../services/payroll.js';
import { statutory } from '../services/tax.js';
import { notifyRun } from '../services/notify.js';

const r = Router();

// Staff see only their own payslips, and only once a run is approved/paid
r.get('/my-payslips', async (req, res) => {
  res.json(must(await supabase.from('payslips').select('*, payroll_runs!inner(period_start,period_end,status)').eq('staff_id', req.user.staffId).in('payroll_runs.status', ['approved', 'paid'])));
});

r.use(requireRole('admin'));

r.get('/runs', async (req, res) => res.json(must(await supabase.from('payroll_runs').select('*').order('period_start', { ascending: false }))));

r.get('/runs/:id', async (req, res) => {
  const run = must(await supabase.from('payroll_runs').select('*').eq('id', req.params.id).single());
  const payslips = must(await supabase.from('payslips').select('*, staff(full_name,position)').eq('run_id', req.params.id));
  res.json({ ...run, payslips, total_net: round2(payslips.reduce((t, p) => t + Number(p.net_pay), 0)) });
});

// Generate a draft run from attendance: { period_start, period_end }
r.post('/runs', async (req, res) => {
  const { period_start, period_end } = req.body;
  if (!period_start || !period_end || period_end < period_start) throw httpError(400, 'Valid period_start and period_end required');
  res.status(201).json(await generateRun(period_start, period_end, req.user.id));
});

// Adjust bonus / other deduction while the run is still a draft
r.patch('/payslips/:id', async (req, res) => {
  const p = must(await supabase.from('payslips').select('*, payroll_runs(status), staff(*)').eq('id', req.params.id).single());
  if (p.payroll_runs.status !== 'draft') throw httpError(409, 'Run is locked');
  const adj = pick(req.body, ['bonus', 'other_deduction']);
  const m = { ...p, ...adj };
  const earned = +m.base_pay + +m.overtime_pay + +m.bonus - +m.absence_deduction - +m.late_deduction; // bonus is taxable
  const st = statutory({ earned, base: +m.base_pay, pensionable: p.staff.pensionable_pay, annualRent: p.staff.annual_rent, pensionEnabled: p.staff.pension_enabled !== false });
  Object.assign(adj, { pension_employee: st.pensionEmployee, pension_employer: st.pensionEmployer, paye_tax: st.paye });
  adj.net_pay = round2(earned - st.pensionEmployee - st.paye - +m.other_deduction);
  res.json(must(await supabase.from('payslips').update(adj).eq('id', req.params.id).select().single()));
});

const move = (from, to) => async (req, res) => {
  const run = must(await supabase.from('payroll_runs').select('status').eq('id', req.params.id).single());
  if (run.status !== from) throw httpError(409, `Run must be ${from}`);
  const out = must(await supabase.from('payroll_runs').update({ status: to }).eq('id', req.params.id).select().single());
  notifyRun(out.id, to);
  res.json(out);
};
r.post('/runs/:id/approve', move('draft', 'approved'));
r.post('/runs/:id/pay', move('approved', 'paid'));

r.delete('/runs/:id', async (req, res) => {
  const run = must(await supabase.from('payroll_runs').select('status').eq('id', req.params.id).single());
  if (run.status !== 'draft') throw httpError(409, 'Only draft runs can be deleted');
  must(await supabase.from('payroll_runs').delete().eq('id', req.params.id));
  res.status(204).end();
});

export default r;
