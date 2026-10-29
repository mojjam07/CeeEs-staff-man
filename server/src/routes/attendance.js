import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireRole } from '../middleware/auth.js';
import { must, pick, httpError, todayStr, minutesOfDay, timeToMin, round2 } from '../util.js';

const r = Router();
const W = requireRole('admin', 'manager');
// Staff clock themselves; managers/admins may clock someone in/out via body.staff_id
const target = (req) => (req.user.role === 'staff' ? req.user.staffId : req.body.staff_id || req.user.staffId);

r.get('/', async (req, res) => {
  let q = supabase.from('attendance').select('*, staff(full_name)').order('work_date', { ascending: false });
  const sid = req.user.role === 'staff' ? req.user.staffId : req.query.staff_id;
  if (sid) q = q.eq('staff_id', sid);
  if (req.query.from) q = q.gte('work_date', req.query.from);
  if (req.query.to) q = q.lte('work_date', req.query.to);
  res.json(must(await q));
});

r.post('/clock-in', async (req, res) => {
  const staffId = target(req);
  if (!staffId) throw httpError(400, 'No staff record linked to this account');
  const work_date = todayStr();
  const { data: existing } = await supabase.from('attendance').select('id,clock_in').eq('staff_id', staffId).eq('work_date', work_date).maybeSingle();
  if (existing?.clock_in) throw httpError(409, 'Already clocked in today');

  const { data: a } = await supabase.from('shift_assignments').select('shifts(start_time,grace_minutes)').eq('staff_id', staffId).eq('work_date', work_date).maybeSingle();
  let late = 0;
  if (a?.shifts) late = Math.max(0, minutesOfDay() - (timeToMin(a.shifts.start_time) + a.shifts.grace_minutes));
  const row = { staff_id: staffId, work_date, clock_in: new Date().toISOString(), status: late ? 'late' : 'present', late_minutes: late };
  res.status(201).json(must(await supabase.from('attendance').upsert(row, { onConflict: 'staff_id,work_date' }).select().single()));
});

r.post('/clock-out', async (req, res) => {
  const staffId = target(req);
  // latest open record (also handles overnight shifts that cross midnight)
  const { data: open } = await supabase.from('attendance').select('*').eq('staff_id', staffId).not('clock_in', 'is', null).is('clock_out', null).order('clock_in', { ascending: false }).limit(1).maybeSingle();
  if (!open) throw httpError(409, 'No open clock-in found');
  const now = new Date();
  const hours = round2((now - new Date(open.clock_in)) / 3600000);
  res.json(must(await supabase.from('attendance').update({ clock_out: now.toISOString(), hours_worked: hours }).eq('id', open.id).select().single()));
});

// Mark absent / leave (or create a missed record): { staff_id, work_date, status, note }
r.post('/manual', W, async (req, res) => {
  const row = pick(req.body, ['staff_id', 'work_date', 'status', 'note', 'clock_in', 'clock_out']);
  if (!row.staff_id || !row.work_date || !row.status) throw httpError(400, 'staff_id, work_date and status are required');
  if (row.clock_in && row.clock_out) row.hours_worked = round2((new Date(row.clock_out) - new Date(row.clock_in)) / 3600000);
  res.status(201).json(must(await supabase.from('attendance').upsert(row, { onConflict: 'staff_id,work_date' }).select().single()));
});

// Correct a record
r.patch('/:id', W, async (req, res) => {
  const patch = pick(req.body, ['clock_in', 'clock_out', 'status', 'late_minutes', 'note']);
  const cur = must(await supabase.from('attendance').select('clock_in,clock_out').eq('id', req.params.id).single());
  const ci = patch.clock_in ?? cur.clock_in, co = patch.clock_out ?? cur.clock_out;
  if (ci && co) patch.hours_worked = round2((new Date(co) - new Date(ci)) / 3600000);
  res.json(must(await supabase.from('attendance').update(patch).eq('id', req.params.id).select().single()));
});

export default r;
