import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireRole } from '../middleware/auth.js';
import { must, pick, httpError } from '../util.js';
import { assertBalance, balances } from '../services/leaveBalance.js';
import { notifyLeaveRequested, notifyLeaveReviewed } from '../services/notify.js';

const r = Router();
const W = requireRole('admin', 'manager');
const eachDate = (from, to) => {
  const out = [];
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};

r.get('/', async (req, res) => {
  let q = supabase.from('leave_requests').select('*, staff(full_name)').order('created_at', { ascending: false });
  if (req.user.role === 'staff') q = q.eq('staff_id', req.user.staffId);
  else if (req.query.staff_id) q = q.eq('staff_id', req.query.staff_id);
  if (req.query.status) q = q.eq('status', req.query.status);
  res.json(must(await q));
});

// ?staff_id= (managers) &year= — remaining days per leave type; counts weekdays
r.get('/balances', async (req, res) => {
  const sid = req.user.role === 'staff' ? req.user.staffId : req.query.staff_id || req.user.staffId;
  if (!sid) throw httpError(400, 'No staff record linked to this account');
  res.json(await balances(sid, Number(req.query.year) || new Date().getFullYear()));
});
r.get('/entitlements', async (req, res) => res.json(must(await supabase.from('leave_entitlements').select('*').order('type'))));
r.put('/entitlements', requireRole('admin'), async (req, res) => {
  const rows = (req.body || []).filter((x) => ['annual', 'sick', 'casual'].includes(x.type) && Number(x.days_per_year) >= 0).map((x) => ({ type: x.type, days_per_year: Math.floor(Number(x.days_per_year)), carry_over_days: Math.max(0, Math.floor(Number(x.carry_over_days || 0))) }));
  res.json(must(await supabase.from('leave_entitlements').upsert(rows, { onConflict: 'type' }).select()));
});

// Staff request for themselves; managers may file on behalf via staff_id
r.post('/', async (req, res) => {
  const row = pick(req.body, ['type', 'start_date', 'end_date', 'reason']);
  row.staff_id = req.user.role === 'staff' ? req.user.staffId : req.body.staff_id || req.user.staffId;
  if (!row.staff_id) throw httpError(400, 'No staff record linked to this account');
  if (!row.start_date || !row.end_date || row.end_date < row.start_date) throw httpError(400, 'Valid start_date and end_date required');
  if (eachDate(row.start_date, row.end_date).length > 62) throw httpError(400, 'Leave cannot exceed 62 days');
  await assertBalance({ staffId: row.staff_id, type: row.type || 'annual', start: row.start_date, end: row.end_date });
  const created = must(await supabase.from('leave_requests').insert(row).select().single());
  notifyLeaveRequested(created);
  res.status(201).json(created);
});

r.patch('/:id/review', W, async (req, res) => {
  const { status, note } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw httpError(400, 'status must be approved or rejected');
  const lr = must(await supabase.from('leave_requests').select('*').eq('id', req.params.id).single());
  if (lr.status !== 'pending') throw httpError(409, 'Already reviewed');
  if (status === 'approved') await assertBalance({ staffId: lr.staff_id, type: lr.type, start: lr.start_date, end: lr.end_date, excludeId: lr.id, countPending: false });

  if (status === 'approved') {
    // Mark scheduled days (or weekdays if no roster) in the range; never overwrite days already worked.
    const [asg, worked] = await Promise.all([
      supabase.from('shift_assignments').select('work_date').eq('staff_id', lr.staff_id).gte('work_date', lr.start_date).lte('work_date', lr.end_date),
      supabase.from('attendance').select('work_date').eq('staff_id', lr.staff_id).gte('work_date', lr.start_date).lte('work_date', lr.end_date).not('clock_in', 'is', null),
    ]);
    const scheduled = must(asg).map((a) => a.work_date);
    const skip = new Set(must(worked).map((a) => a.work_date));
    const days = (scheduled.length ? scheduled : eachDate(lr.start_date, lr.end_date).filter((d) => ![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay())))
      .filter((d) => !skip.has(d));
    const unpaid = lr.type === 'unpaid'; // unpaid leave counts as absence in payroll
    if (days.length) must(await supabase.from('attendance').upsert(
      days.map((work_date) => ({ staff_id: lr.staff_id, work_date, status: unpaid ? 'absent' : 'leave', note: `${unpaid ? 'Unpaid' : 'Approved'} ${lr.type} leave` })),
      { onConflict: 'staff_id,work_date' }));
  }
  const out = must(await supabase.from('leave_requests').update({ status, review_note: note || null, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() }).eq('id', req.params.id).select().single());
  notifyLeaveReviewed(out);
  res.json(out);
});

// Withdraw own pending request (managers can remove any pending one)
r.delete('/:id', async (req, res) => {
  const lr = must(await supabase.from('leave_requests').select('staff_id,status').eq('id', req.params.id).single());
  if (lr.status !== 'pending') throw httpError(409, 'Only pending requests can be withdrawn');
  if (req.user.role === 'staff' && lr.staff_id !== req.user.staffId) throw httpError(403, 'Not allowed');
  must(await supabase.from('leave_requests').delete().eq('id', req.params.id));
  res.status(204).end();
});

export default r;
