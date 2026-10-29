import 'dotenv/config'; // must stay the first import so env vars exist before supabase.js loads
import { supabase } from '../src/supabase.js';
import { generateRun } from '../src/services/payroll.js';
import { SEED_DOMAIN, SHIFTS, STAFF, addDays, isWeekday, localToday, makeAssignments, makeAttendance } from './seedData.js';

const OFFSET = Number(process.env.TZ_OFFSET_MINUTES ?? 60);
const PASSWORD = process.env.SEED_PASSWORD || 'ChangeMe123!';
const args = new Set(process.argv.slice(2));
const ok = ({ data, error }) => { if (error) { console.error('\nSeed failed:', error.message); process.exit(1); } return data; };

async function allAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function reset() {
  const staff = ok(await supabase.from('staff').select('id,email')).filter((s) => s.email?.endsWith(SEED_DOMAIN));
  const ids = staff.map((s) => s.id);
  if (ids.length) {
    ok(await supabase.from('payslips').delete().in('staff_id', ids)); // payslips don't cascade from staff
    ok(await supabase.from('staff').delete().in('id', ids));         // cascades attendance, roster, leave
  }
  for (const u of (await allAuthUsers()).filter((u) => u.email?.endsWith(SEED_DOMAIN))) await supabase.auth.admin.deleteUser(u.id);
  for (const run of ok(await supabase.from('payroll_runs').select('id'))) {
    const { count } = await supabase.from('payslips').select('id', { count: 'exact', head: true }).eq('run_id', run.id);
    if (!count) await supabase.from('payroll_runs').delete().eq('id', run.id); // runs left empty by the reset
  }
  console.log(`Removed ${ids.length} seeded staff and their data.`);
}

async function seed() {
  const existing = ok(await supabase.from('staff').select('id,email'));
  if (existing.some((s) => s.email?.endsWith(SEED_DOMAIN))) { console.error('Seed data already exists. Run `npm run seed:reset` first.'); process.exit(1); }
  if (existing.length && !args.has('--force')) {
    console.error(`This database already has ${existing.length} staff record(s) that aren't seed data.\nRefusing to add demo data to what may be a real system. Re-run with --force if this is a test database.`);
    process.exit(1);
  }

  const today = localToday(OFFSET);
  const monthStart = today.slice(0, 8) + '01';

  const shifts = ok(await supabase.from('shifts').insert(SHIFTS).select());
  const shiftIds = Object.fromEntries(shifts.map((s) => [s.name, s.id]));
  const shiftById = Object.fromEntries(shifts.map((s) => [s.id, s]));

  const cols = ['full_name', 'email', 'position', 'department', 'pay_type', 'pay_rate', 'annual_rent', 'hired_on', 'status'];
  const inserted = ok(await supabase.from('staff').insert(STAFF.map((s) => Object.fromEntries(cols.map((c) => [c, s[c]])))).select());
  const staff = STAFF.map((s) => ({ ...s, id: inserted.find((i) => i.email === s.email).id }));
  const byKey = Object.fromEntries(staff.map((s) => [s.key, s]));

  // Logins: one manager, two staff (same password). Existing users are reused.
  const known = Object.fromEntries((await allAuthUsers()).map((u) => [u.email, u.id]));
  for (const s of staff.filter((s) => s.login)) {
    let id = known[s.email];
    if (!id) {
      const { data, error } = await supabase.auth.admin.createUser({ email: s.email, password: PASSWORD, email_confirm: true });
      if (error) { console.error('Could not create login for', s.email, error.message); process.exit(1); }
      id = data.user.id;
    }
    ok(await supabase.from('profiles').upsert({ id, role: s.login, staff_id: s.id }));
  }

  // Roster: start of month through next week
  const assignments = ok(await supabase.from('shift_assignments').insert(makeAssignments(staff, shiftIds, monthStart, addDays(today, 7))).select());

  // Leave: Ngozi had 2 approved days last week (attendance shows "leave"); Tunde has a pending request for next week
  const weekdaysBack = []; for (let d = addDays(today, -1); weekdaysBack.length < 2 && d >= monthStart; d = addDays(d, -1)) if (isWeekday(d)) weekdaysBack.push(d);
  const nextWeekdays = []; for (let d = addDays(today, 1); nextWeekdays.length < 2; d = addDays(d, 1)) if (isWeekday(d)) nextWeekdays.push(d);
  const skip = new Set(weekdaysBack.map((d) => `${byKey.ngozi.id}|${d}`));
  const leaveRows = [];
  if (weekdaysBack.length) {
    const [a, b] = [weekdaysBack[weekdaysBack.length - 1], weekdaysBack[0]];
    ok(await supabase.from('leave_requests').insert({ staff_id: byKey.ngozi.id, type: 'annual', start_date: a, end_date: b, reason: 'Family event (seed)', status: 'approved', review_note: 'Enjoy', reviewed_at: new Date().toISOString() }));
    leaveRows.push(...weekdaysBack.map((d) => ({ staff_id: byKey.ngozi.id, work_date: d, status: 'leave', note: 'Approved annual leave' })));
  }
  ok(await supabase.from('leave_requests').insert({ staff_id: byKey.tunde.id, type: 'annual', start_date: nextWeekdays[0], end_date: nextWeekdays[1], reason: 'Personal (seed)' }));

  // Attendance for all past roster days
  const attendance = [...makeAttendance(assignments, shiftById, today, OFFSET, skip), ...leaveRows];
  for (let i = 0; i < attendance.length; i += 500) ok(await supabase.from('attendance').upsert(attendance.slice(i, i + 500), { onConflict: 'staff_id,work_date' }));

  // A draft payroll run for the month so far (needs at least one past day)
  let run = null;
  if (today > monthStart) run = await generateRun(monthStart, addDays(today, -1), null);

  console.log(`\nSeeded: ${staff.length} staff, ${shifts.length} shifts, ${assignments.length} roster days, ${attendance.length} attendance rows, 2 leave requests${run ? ', 1 draft payroll run' : ''}.`);
  console.log(`\nLogins (password: ${PASSWORD})\n  manager  adaeze${SEED_DOMAIN}\n  staff    tunde${SEED_DOMAIN}  (has a pending leave request)\n  staff    ngozi${SEED_DOMAIN}  (has approved leave)\n  admin    the account you created yourself\n`);
  console.log('Remove it all with: npm run seed:reset');
}

(args.has('--reset') ? reset() : seed()).catch((e) => { console.error(e); process.exit(1); });
