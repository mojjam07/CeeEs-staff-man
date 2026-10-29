import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireRole } from '../middleware/auth.js';
import { must, httpError } from '../util.js';
import { buildPayslipPdf } from '../services/payslipPdf.js';

const r = Router();

// Payslip PDF: admin any time; the staff member only after the run is approved/paid
r.get('/payslips/:id/pdf', async (req, res) => {
  const p = must(await supabase.from('payslips').select('*, staff(full_name,position,department), payroll_runs(period_start,period_end,status)').eq('id', req.params.id).single());
  const owner = req.user.staffId && req.user.staffId === p.staff_id && p.payroll_runs.status !== 'draft';
  if (req.user.role !== 'admin' && !owner) throw httpError(403, 'Not allowed');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${p.staff.full_name.replace(/\W+/g, '-')}-${p.payroll_runs.period_end}.pdf"`);
  const doc = buildPayslipPdf(p);
  doc.pipe(res);
  doc.end();
});

const load = async (id) => {
  const run = must(await supabase.from('payroll_runs').select('*').eq('id', id).single());
  const slips = must(await supabase.from('payslips').select('*, staff(*)').eq('run_id', id));
  return { run, slips: slips.filter((s) => Number(s.net_pay) > 0) };
};
const hasBank = (s) => s.account_number && s.bank_code;

// Bank bulk-upload CSV (approved or paid runs)
r.get('/runs/:id/export.csv', requireRole('admin'), async (req, res) => {
  const { run, slips } = await load(req.params.id);
  if (run.status === 'draft') throw httpError(409, 'Approve the run before exporting payouts');
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Name', 'Bank', 'Bank Code', 'Account Number', 'Account Name', 'Amount (NGN)', 'Narration'].join(',')];
  for (const s of slips) {
    lines.push([s.staff.full_name, s.staff.bank_name, s.staff.bank_code, s.staff.account_number, s.staff.account_name || s.staff.full_name, Number(s.net_pay).toFixed(2), `Salary ${run.period_start} to ${run.period_end}`].map(q).join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="payouts-${run.period_end}.csv"`);
  res.send(lines.join('\n'));
});

// Paystack bulk transfer. Needs PAYSTACK_SECRET_KEY; try with a test key first.
const ps = async (path, body) => {
  const resp = await fetch('https://api.paystack.co' + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await resp.json().catch(() => ({}));
  if (!j.status) throw httpError(502, 'Paystack: ' + (j.message || resp.statusText));
  return j.data;
};

r.post('/runs/:id/paystack', requireRole('admin'), async (req, res) => {
  if (!process.env.PAYSTACK_SECRET_KEY) throw httpError(400, 'PAYSTACK_SECRET_KEY is not set on the server');
  const { run, slips } = await load(req.params.id);
  if (run.status !== 'approved') throw httpError(409, 'Run must be approved (and not yet paid)');

  const todo = slips.filter((s) => s.payout_status !== 'queued');
  const skipped = todo.filter((s) => !hasBank(s.staff)).map((s) => s.staff.full_name);
  const transfers = [];
  for (const s of todo.filter((s) => hasBank(s.staff))) {
    let code = s.staff.paystack_recipient;
    if (!code) {
      const rec = await ps('/transferrecipient', { type: 'nuban', name: s.staff.account_name || s.staff.full_name, account_number: s.staff.account_number, bank_code: s.staff.bank_code, currency: 'NGN' });
      code = rec.recipient_code;
      must(await supabase.from('staff').update({ paystack_recipient: code }).eq('id', s.staff_id));
    }
    transfers.push({ amount: Math.round(Number(s.net_pay) * 100), recipient: code, reference: s.id, reason: `Salary ${run.period_start} to ${run.period_end}` });
  }
  if (!transfers.length) throw httpError(400, 'Nothing to send' + (skipped.length ? `; missing bank details: ${skipped.join(', ')}` : ''));

  await ps('/transfer/bulk', { currency: 'NGN', source: 'balance', transfers });
  must(await supabase.from('payslips').update({ payout_status: 'queued' }).in('id', transfers.map((t) => t.reference)));
  res.json({ queued: transfers.length, skipped }); // confirm in Paystack, then use "Mark paid"
});

// Remittance schedule for PFAs and the state tax authority
r.get('/runs/:id/statutory.csv', requireRole('admin'), async (req, res) => {
  const run = must(await supabase.from('payroll_runs').select('*').eq('id', req.params.id).single());
  if (run.status === 'draft') throw httpError(409, 'Approve the run first');
  const slips = must(await supabase.from('payslips').select('*, staff(full_name)').eq('run_id', req.params.id));
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Name', 'Employee Pension', 'Employer Pension', 'Total Pension', 'PAYE'].join(',')];
  for (const s of slips) lines.push([s.staff.full_name, s.pension_employee, s.pension_employer, (+s.pension_employee + +s.pension_employer).toFixed(2), s.paye_tax].map(q).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="statutory-${run.period_end}.csv"`);
  res.send(lines.join('\n'));
});

export default r;
