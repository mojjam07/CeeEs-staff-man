import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireRole } from '../middleware/auth.js';
import { must, pick, httpError } from '../util.js';

const r = Router();
const FIELDS = ['full_name', 'email', 'phone', 'position', 'department', 'pay_type', 'pay_rate', 'status', 'hired_on', 'bank_name', 'bank_code', 'account_number', 'account_name', 'annual_rent', 'pensionable_pay', 'pension_enabled'];
const PUBLIC_COLS = 'id,full_name,email,phone,position,department,status,hired_on';
const cols = (u) => (u.role === 'admin' ? '*' : PUBLIC_COLS); // pay details are admin-only

r.get('/', requireRole('admin', 'manager'), async (req, res) => {
  let q = supabase.from('staff').select(cols(req.user)).order('full_name');
  if (req.query.status) q = q.eq('status', req.query.status);
  if (req.query.q) q = q.ilike('full_name', `%${req.query.q}%`);
  res.json(must(await q));
});

r.get('/:id', async (req, res) => {
  if (req.user.role === 'staff' && req.user.staffId !== req.params.id) throw httpError(403, 'Not allowed');
  res.json(must(await supabase.from('staff').select(cols(req.user)).eq('id', req.params.id).single()));
});

// Create staff. Optionally create a login: { email, password, role: 'staff'|'manager'|'admin' }
r.post('/', requireRole('admin'), async (req, res) => {
  if (!req.body.full_name) throw httpError(400, 'full_name is required');
  const member = must(await supabase.from('staff').insert(pick(req.body, FIELDS)).select().single());
  if (req.body.password && req.body.email) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: req.body.email, password: req.body.password, email_confirm: true,
    });
    if (error) throw httpError(400, 'Staff saved, but login failed: ' + error.message);
    must(await supabase.from('profiles').insert({ id: data.user.id, role: req.body.role || 'staff', staff_id: member.id }));
  }
  res.status(201).json(member);
});

r.patch('/:id', requireRole('admin'), async (req, res) => {
  res.json(must(await supabase.from('staff').update(pick(req.body, FIELDS)).eq('id', req.params.id).select().single()));
});

// Soft delete keeps attendance and payroll history intact
r.delete('/:id', requireRole('admin'), async (req, res) => {
  must(await supabase.from('staff').update({ status: 'inactive' }).eq('id', req.params.id));
  res.status(204).end();
});

export default r;
