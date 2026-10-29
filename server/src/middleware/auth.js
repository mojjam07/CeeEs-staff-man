import { supabase } from '../supabase.js';
import { httpError } from '../util.js';

export async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) throw httpError(401, 'Missing token');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw httpError(401, 'Invalid or expired token');
  const { data: p } = await supabase.from('profiles').select('role, staff_id').eq('id', data.user.id).maybeSingle();
  if (!p) throw httpError(403, 'No profile for this account');
  req.user = { id: data.user.id, email: data.user.email, role: p.role, staffId: p.staff_id };
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(httpError(403, 'Not allowed'));
