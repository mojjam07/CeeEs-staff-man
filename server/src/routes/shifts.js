import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireRole } from '../middleware/auth.js';
import { must, pick, httpError } from '../util.js';

const r = Router();
const W = requireRole('admin', 'manager');
const F = ['name', 'start_time', 'end_time', 'grace_minutes'];

r.get('/', async (req, res) => res.json(must(await supabase.from('shifts').select('*').order('start_time'))));
r.post('/', W, async (req, res) => res.status(201).json(must(await supabase.from('shifts').insert(pick(req.body, F)).select().single())));

// Roster: ?from=YYYY-MM-DD&to=YYYY-MM-DD&staff_id=
r.get('/assignments', async (req, res) => {
  let q = supabase.from('shift_assignments').select('*, shifts(name,start_time,end_time), staff(full_name)').order('work_date');
  const sid = req.user.role === 'staff' ? req.user.staffId : req.query.staff_id;
  if (sid) q = q.eq('staff_id', sid);
  if (req.query.from) q = q.gte('work_date', req.query.from);
  if (req.query.to) q = q.lte('work_date', req.query.to);
  res.json(must(await q));
});

// Bulk assign: { staff_ids: [], shift_id, dates: ['2026-11-02', ...] } (re-assigning a date replaces it)
r.post('/assignments', W, async (req, res) => {
  const { staff_ids, shift_id, dates } = req.body;
  if (!staff_ids?.length || !shift_id || !dates?.length) throw httpError(400, 'staff_ids, shift_id and dates are required');
  const rows = staff_ids.flatMap((staff_id) => dates.map((work_date) => ({ staff_id, shift_id, work_date })));
  res.status(201).json(must(await supabase.from('shift_assignments').upsert(rows, { onConflict: 'staff_id,work_date' }).select()));
});

r.delete('/assignments/:id', W, async (req, res) => {
  must(await supabase.from('shift_assignments').delete().eq('id', req.params.id));
  res.status(204).end();
});

r.patch('/:id', W, async (req, res) =>
  res.json(must(await supabase.from('shifts').update(pick(req.body, F)).eq('id', req.params.id).select().single())));
r.delete('/:id', W, async (req, res) => {
  must(await supabase.from('shifts').delete().eq('id', req.params.id));
  res.status(204).end();
});

export default r;
