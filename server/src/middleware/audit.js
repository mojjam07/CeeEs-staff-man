import { supabase } from '../supabase.js';

const SECRET = ['password', 'token'];
const redact = (b) => {
  if (!b || typeof b !== 'object') return b;
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [
    k,
    SECRET.includes(k) ? '[redacted]' : k === 'account_number' && v ? '***' + String(v).slice(-4) : v,
  ]));
};

// Records every successful write (POST/PATCH/PUT/DELETE) with who did it. Mount after auth.
export function audit(req, res, next) {
  if (req.method === 'GET') return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const path = req.originalUrl.split('?')[0];
    const [, , entity, id] = path.split('/'); // ['', 'api', entity, id]
    supabase.from('audit_log').insert({
      actor_id: req.user.id, actor_email: req.user.email, action: `${req.method} ${path}`,
      entity, entity_id: id && /^[0-9a-f-]{36}$/.test(id) ? id : null, status: res.statusCode, details: redact(req.body),
    }).then(({ error }) => error && console.error('audit failed:', error.message));
  });
  next();
}
