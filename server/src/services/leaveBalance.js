import { supabase } from '../supabase.js';
import { must, httpError } from '../util.js';

// Leave is counted in weekdays (Mon–Fri), clipped to the calendar year.
const weekdaysIn = (from, to) => {
  let n = 0;
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) if (![0, 6].includes(d.getUTCDay())) n++;
  return n;
};
const clip = (from, to, y) => {
  const a = from > `${y}-01-01` ? from : `${y}-01-01`, b = to < `${y}-12-31` ? to : `${y}-12-31`;
  return a <= b ? weekdaysIn(a, b) : 0;
};

export async function getEntitlements() {
  return Object.fromEntries(must(await supabase.from('leave_entitlements').select('*')).map((r) => [r.type, r]));
}

async function usage(staffId, year) {
  const rows = must(await supabase.from('leave_requests').select('id,type,start_date,end_date,status')
    .eq('staff_id', staffId).in('status', ['approved', 'pending']).lte('start_date', `${year}-12-31`).gte('end_date', `${year}-01-01`));
  return rows.map((r) => ({ ...r, days: clip(r.start_date, r.end_date, year) }));
}

// Carry-over: unused part of LAST year's entitlement (prorated for a mid-year hire), capped at carry_over_days.
// Needs staff.hired_on; without it nothing is carried. One year back only (no chains).
async function carriedIn(staffId, ent, type, year) {
  if (!ent?.carry_over_days || ent.days_per_year == null) return 0;
  const { hired_on } = must(await supabase.from('staff').select('hired_on').eq('id', staffId).single());
  if (!hired_on || hired_on > `${year - 1}-12-31`) return 0;
  const months = hired_on < `${year - 1}-01-01` ? 12 : 13 - Number(hired_on.slice(5, 7));
  const prevEnt = Math.round((ent.days_per_year * months) / 12);
  const prevUsed = (await usage(staffId, year - 1)).filter((r) => r.type === type && r.status === 'approved').reduce((t, r) => t + r.days, 0);
  return Math.min(ent.carry_over_days, Math.max(0, prevEnt - prevUsed));
}

export async function balances(staffId, year) {
  const ent = await getEntitlements(), rows = await usage(staffId, year);
  const sum = (type, status) => rows.filter((r) => r.type === type && r.status === status).reduce((t, r) => t + r.days, 0);
  return Promise.all(['annual', 'sick', 'casual', 'unpaid'].map(async (type) => {
    const e = ent[type], base = e?.days_per_year ?? null, used = sum(type, 'approved'), pending = sum(type, 'pending');
    const carried = await carriedIn(staffId, e, type, year);
    return { type, entitlement: base, carried, used, pending, remaining: base === null ? null : Math.max(0, base + carried - used - pending) };
  }));
}

export async function assertBalance({ staffId, type, start, end, excludeId, countPending = true }) {
  if (type === 'unpaid') return;
  const e = (await getEntitlements())[type];
  if (!e || e.days_per_year === null) return;
  for (let y = +start.slice(0, 4); y <= +end.slice(0, 4); y++) {
    const need = clip(start, end, y);
    if (!need) continue;
    const allowed = e.days_per_year + (await carriedIn(staffId, e, type, y));
    const taken = (await usage(staffId, y)).filter((r) => r.type === type && r.id !== excludeId && (countPending || r.status === 'approved')).reduce((t, r) => t + r.days, 0);
    if (taken + need > allowed) throw httpError(409, `Not enough ${type} leave for ${y}: ${Math.max(0, allowed - taken)} day(s) left, ${need} requested`);
  }
}
