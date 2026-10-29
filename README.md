# Staff & Attendance Manager

Stages: Supabase schema + Express API (`server/`). Stage 2: Vite React frontend (`client/`).

## Setup
1. Supabase: run `supabase/schema.sql`, create a user under Authentication, then insert its admin profile (last lines of the schema).
2. `cd server && cp .env.example .env` (fill URL + service-role key), then `npm install && npm run dev`
3. Test: sign in via Supabase to get an access token, then `curl -H "Authorization: Bearer <token>" localhost:4000/api/me`

## API (all under /api, Bearer = Supabase access token)
| Area | Endpoints | Roles |
|---|---|---|
| Staff | GET/POST /staff, GET/PATCH/DELETE /staff/:id | admin writes; manager reads (no pay data) |
| Shifts | GET/POST/PATCH/DELETE /shifts, GET/POST /shifts/assignments, DELETE /shifts/assignments/:id | manager+ writes; staff read own roster |
| Attendance | POST /attendance/clock-in, /clock-out, /manual; PATCH /attendance/:id; GET /attendance | staff self-clock; manager+ corrects |
| Payroll | POST /payroll/runs, GET /payroll/runs(/:id), PATCH /payroll/payslips/:id, POST /payroll/runs/:id/approve, /pay | admin; staff GET /payroll/my-payslips |

## Frontend
`cd client && cp .env.example .env` (Supabase URL + **anon** key, API URL), then `npm install && npm run dev` (http://localhost:5173).
Set the server's `CORS_ORIGIN` to the frontend URL when deploying.

## Migrations
Run in order in the Supabase SQL editor: `schema.sql`, `migration-002.sql` (payouts, leave), `migration-003.sql` (PAYE/pension, leave entitlements), `migration-004.sql` (audit log, leave carry-over).

## Statutory payroll (Nigeria Tax Act 2025, effective 1 Jan 2026)
- PAYE: ₦800k nil band, then 15/18/21/23/25% (bands in `server/src/services/tax.js`); rent relief = 20% of declared annual rent, capped at ₦500k; employee pension (8%) is tax-deductible; earners at or below the ₦70,000 monthly minimum wage are exempt.
- Pension: employee 8% / employer 10% of monthly pensionable pay (set per staff; defaults to base pay).
- Not included: NHF, NSITF, ITF, and PAYE for staff with multiple employers. Have an accountant verify before first live run.

## Deploying
See [DEPLOYMENT.md](DEPLOYMENT.md) (Supabase + Render + Vercel; `render.yaml` and `client/vercel.json` included).

## Also included
Password reset and change-password, audit log (admin), email (Resend) and SMS (Termii) notifications for leave and payroll, and leave carry-over.

## Demo data (test databases only)
`cd server && npm run seed` creates 8 sample staff (monthly and hourly, one at minimum wage), a morning and an overnight shift, a roster from the start of the month to next week, attendance with some lateness, absences and overtime, an approved and a pending leave request, and a draft payroll run. It adds a manager and two staff logins (`adaeze@`, `tunde@`, `ngozi@seed.example`, password from `SEED_PASSWORD`, default `ChangeMe123!`).
`npm run seed:reset` removes it all. The script refuses to run if the database already holds non-seed staff unless you add `--force`. Seeded people have no phone or bank details, so nothing can be texted or paid.
# CeeEs-staff-man
