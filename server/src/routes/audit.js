import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireRole } from '../middleware/auth.js';
import { must } from '../util.js';

const r = Router();
// ?entity=&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=
r.get('/', requireRole('admin'), async (req, res) => {
  let q = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(Math.min(Number(req.query.limit) || 200, 1000));
  if (req.query.entity) q = q.eq('entity', req.query.entity);
  if (req.query.from) q = q.gte('at', req.query.from);
  if (req.query.to) q = q.lt('at', req.query.to + 'T23:59:59.999Z');
  res.json(must(await q));
});
export default r;
