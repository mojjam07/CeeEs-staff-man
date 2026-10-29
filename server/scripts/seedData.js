// Pure data generation for the seed script (no database access, so it can be tested offline).
export const SEED_DOMAIN = '@seed.example'; // reserved TLD: nothing can be delivered to these addresses

export const SHIFTS = [
  { name: 'Morning', start_time: '08:00', end_time: '17:00', grace_minutes: 10 },
  { name: 'Night', start_time: '20:00', end_time: '06:00', grace_minutes: 10 }, // overnight, to exercise that path
];

// No phones or bank details on purpose, so seeded people can never be texted or paid by accident.
export const STAFF = [
  { key: 'adaeze', full_name: 'Adaeze Okafor', position: 'Store Manager', department: 'Operations', pay_type: 'monthly', pay_rate: 450000, annual_rent: 1200000, hired_on: '2024-02-01', login: 'manager' },
  { key: 'tunde', full_name: 'Tunde Bakare', position: 'Cashier', department: 'Sales', pay_type: 'monthly', pay_rate: 180000, annual_rent: 600000, hired_on: '2025-06-15', login: 'staff' },
  { key: 'ngozi', full_name: 'Ngozi Eze', position: 'Cashier', department: 'Sales', pay_type: 'monthly', pay_rate: 175000, annual_rent: 0, hired_on: '2024-09-01', login: 'staff' },
  { key: 'emeka', full_name: 'Emeka Nwosu', position: 'Security', department: 'Operations', pay_type: 'monthly', pay_rate: 120000, annual_rent: 0, hired_on: '2023-05-10', shift: 'Night' },
  { key: 'fatima', full_name: 'Fatima Bello', position: 'Sales Assistant', department: 'Sales', pay_type: 'hourly', pay_rate: 1500, annual_rent: 0, hired_on: '2025-11-03' },
  { key: 'chinedu', full_name: 'Chinedu Obi', position: 'Stock Clerk', department: 'Warehouse', pay_type: 'hourly', pay_rate: 1400, annual_rent: 0, hired_on: '2024-01-15' },
  { key: 'blessing', full_name: 'Blessing Adeyemi', position: 'Cleaner', department: 'Operations', pay_type: 'monthly', pay_rate: 70000, annual_rent: 0, hired_on: '2025-01-06' }, // at minimum wage -> no PAYE
  { key: 'ibrahim', full_name: 'Ibrahim Musa', position: 'Driver', department: 'Logistics', pay_type: 'monthly', pay_rate: 140000, annual_rent: 300000, hired_on: '2023-08-21' },
].map((s) => ({ ...s, email: s.key + SEED_DOMAIN, status: 'active' }));

// deterministic PRNG so every run produces the same data
const prng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));

export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const isWeekday = (s) => ![0, 6].includes(new Date(s + 'T00:00:00Z').getUTCDay());
export const localToday = (offsetMin) => new Date(Date.now() + offsetMin * 60000).toISOString().slice(0, 10);
const mins = (hm) => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);
const shiftMinutes = (s) => ((mins(s.end_time) - mins(s.start_time) + 1440) % 1440) || 1440;
const base = (date, hm, offsetMin) => Date.parse(`${date}T${hm}:00Z`) - offsetMin * 60000; // local time -> UTC ms

// Weekday roster from `from` to `to` inclusive
export function makeAssignments(staffRows, shiftIds, from, to) {
  const rows = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isWeekday(d)) continue;
    for (const s of staffRows) rows.push({ staff_id: s.id, shift_id: shiftIds[s.shift || 'Morning'], work_date: d });
  }
  return rows;
}

// Attendance for every assigned day before `today`, except days in `skip` ("staffId|date")
export function makeAttendance(assignments, shiftById, today, offsetMin, skip = new Set()) {
  const r = prng(20261029);
  const out = [];
  for (const a of assignments) {
    if (a.work_date >= today || skip.has(`${a.staff_id}|${a.work_date}`)) continue;
    const shift = shiftById[a.shift_id];
    const t0 = base(a.work_date, shift.start_time, offsetMin);
    const roll = r();
    if (roll < 0.05) { out.push({ staff_id: a.staff_id, work_date: a.work_date, status: 'absent', late_minutes: 0, hours_worked: 0, note: 'Seeded absence' }); continue; }
    const late = roll < 0.15 ? int(r, 5, 45) : 0;
    const minIn = late ? shift.grace_minutes + late : int(r, -10, shift.grace_minutes);
    const extra = r() < 0.2 ? int(r, 30, 120) : int(r, -5, 10);
    const tin = t0 + minIn * 60000, tout = t0 + (shiftMinutes(shift) + extra) * 60000;
    out.push({
      staff_id: a.staff_id, work_date: a.work_date, clock_in: new Date(tin).toISOString(), clock_out: new Date(tout).toISOString(),
      status: late ? 'late' : 'present', late_minutes: late, hours_worked: Math.round(((tout - tin) / 3600000) * 100) / 100,
    });
  }
  return out;
}
