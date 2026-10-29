const OFFSET = Number(process.env.TZ_OFFSET_MINUTES ?? 60); // Lagos = UTC+1
export const httpError = (status, msg) => Object.assign(new Error(msg), { status });
export const must = ({ data, error }) => { if (error) throw httpError(400, error.message); return data; };
export const pick = (o = {}, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const local = (d = new Date()) => new Date(d.getTime() + OFFSET * 60000);
export const todayStr = () => local().toISOString().slice(0, 10);
export const minutesOfDay = (d = new Date()) => { const l = local(d); return l.getUTCHours() * 60 + l.getUTCMinutes(); };
export const timeToMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };
export const shiftHours = (s, e) => { let d = timeToMin(e) - timeToMin(s); if (d <= 0) d += 1440; return d / 60; };
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
