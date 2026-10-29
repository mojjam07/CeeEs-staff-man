import { supabase } from '../supabase.js';

// Email via Resend, SMS via Termii. Without API keys the message is logged instead, so dev works offline.
const FROM = process.env.EMAIL_FROM || 'Staff Manager <onboarding@resend.dev>';
const SENDER = process.env.TERMII_SENDER_ID || 'StaffMgr';

export async function sendEmail(to, subject, text) {
  if (!to) return;
  if (!process.env.RESEND_API_KEY) return console.log('[notify] email (no RESEND_API_KEY):', to, '|', subject);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!r.ok) console.error('[notify] email failed', r.status, await r.text());
}

export const ngPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('234')) return d;
  if (d.startsWith('0')) return '234' + d.slice(1);
  return d.length === 10 ? '234' + d : d;
};

export async function sendSms(to, text) {
  const n = ngPhone(to);
  if (!n) return;
  if (!process.env.TERMII_API_KEY) return console.log('[notify] sms (no TERMII_API_KEY):', n, '|', text);
  const r = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: n, from: SENDER, sms: text, type: 'plain', channel: process.env.TERMII_CHANNEL || 'generic', api_key: process.env.TERMII_API_KEY }),
  });
  if (!r.ok) console.error('[notify] sms failed', r.status, await r.text());
}

const safe = (p) => p.catch((e) => console.error('[notify] error:', e.message)); // never break the request
const managers = () => (process.env.MANAGER_EMAILS || '').split(',').map((x) => x.trim()).filter(Boolean);
const toStaff = (s, subject, text, sms) => Promise.all([sendEmail(s.email, subject, text), sms && s.phone ? sendSms(s.phone, text) : null]);
const getStaff = async (id) => (await supabase.from('staff').select('full_name,email,phone').eq('id', id).single()).data;

export const notifyLeaveRequested = (lr) => safe((async () => {
  const s = await getStaff(lr.staff_id);
  const text = `${s?.full_name} requested ${lr.type} leave: ${lr.start_date} to ${lr.end_date}.${lr.reason ? ' Reason: ' + lr.reason : ''}`;
  await Promise.all(managers().map((m) => sendEmail(m, 'New leave request', text)));
})());

export const notifyLeaveReviewed = (lr) => safe((async () => {
  const s = await getStaff(lr.staff_id);
  if (!s) return;
  const text = `Your ${lr.type} leave (${lr.start_date} to ${lr.end_date}) was ${lr.status}.${lr.review_note ? ' Note: ' + lr.review_note : ''}`;
  await toStaff(s, `Leave ${lr.status}`, text, true);
})());

// status: 'approved' (payslips ready) | 'paid'
export const notifyRun = (runId, status) => safe((async () => {
  const run = (await supabase.from('payroll_runs').select('period_start,period_end').eq('id', runId).single()).data;
  const slips = (await supabase.from('payslips').select('staff(full_name,email,phone)').eq('run_id', runId)).data || [];
  const period = `${run.period_start} to ${run.period_end}`;
  for (const { staff: s } of slips) {
    if (status === 'approved') await toStaff(s, 'Your payslip is ready', `Hi ${s.full_name}, your payslip for ${period} is ready. Sign in to view or download it.`, false);
    else if (status === 'paid') await toStaff(s, 'Salary paid', `Hi ${s.full_name}, your salary for ${period} has been paid.`, true);
  }
})());
