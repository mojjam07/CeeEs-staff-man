# Deployment guide

Architecture: **Supabase** (Postgres + login) ← **Render** (Express API) ← **Vercel** (React app).
Do the steps in this order; each one produces a value the next needs.

## 0. Before you start
- Put the project in a GitHub repo (the `client/` and `server/` folders stay as they are).
- Accounts: Supabase, Render, Vercel. Optional: Resend (email), Termii (SMS), Paystack (payouts).

## 1. Supabase
1. Create a project (pick a region close to your users). Save the database password somewhere safe.
2. **SQL Editor** → run, in order: `schema.sql`, `migration-002.sql`, `migration-003.sql`, `migration-004.sql`.
3. **Project Settings → API**: copy the **Project URL**, the **anon** key (goes to Vercel) and the **service_role** key (goes to Render only; never in the client or in git).
4. **Authentication → Providers → Email**: turn **off** "Allow new users to sign up". Accounts are created by an admin in the app, so open sign-up should stay off.
5. **Authentication → Users → Add user**: create yourself (tick auto-confirm). Copy the user's UUID, then in the SQL Editor:
   `insert into profiles (id, role) values ('<uuid>', 'admin');`
6. **Authentication → URL Configuration**: you'll set the Site URL and redirect URLs in step 4 below, once Vercel gives you a URL.
7. Password-reset emails: Supabase's built-in email sender is rate-limited and meant for testing. Before go-live, set **Authentication → SMTP Settings** to a real provider (Resend's SMTP works).

## 2. Render (API)
1. **New → Blueprint** and select the repo (it reads `render.yaml`), or **New → Web Service** manually: Root Directory `server`, Build `npm install`, Start `npm start`, Health Check Path `/health`.
2. Environment variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `CORS_ORIGIN` | Vercel URL(s), comma-separated, no trailing slash (set after step 3) |
| `TZ_OFFSET_MINUTES` | `60` for Lagos |
| `COMPANY_NAME` | Printed on payslips |
| `OVERTIME_MULTIPLIER`, `LATE_PENALTY_PER_MINUTE`, `PAYROLL_PERIODS_PER_YEAR`, `MINIMUM_WAGE` | Payroll rules (defaults in `.env.example`) |
| `MANAGER_EMAILS` | Who is emailed about new leave requests |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email (optional; verify your sending domain in Resend first) |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | SMS (optional; the sender ID must be approved by Termii) |
| `PAYSTACK_SECRET_KEY` | Payouts (optional; start with the **test** key) |

3. Deploy, then open `https://<your-service>.onrender.com/health`. You should see `{"ok":true}`. Note the URL.
4. Free instances sleep after inactivity, so the first request can take about a minute, which is a poor fit for clock-in at shift start. Use the paid plan, or ping `/health` every 5 minutes with an uptime monitor (e.g. UptimeRobot).

## 3. Vercel (React app)
1. **Add New → Project**, import the repo, set **Root Directory** to `client`. Framework preset: Vite (build `vite build`, output `dist`).
2. Environment variables:
   - `VITE_SUPABASE_URL`: Project URL
   - `VITE_SUPABASE_ANON_KEY`: anon key
   - `VITE_API_URL`: `https://<your-service>.onrender.com/api`
3. Deploy. `client/vercel.json` already rewrites all paths to `index.html`, so page refreshes work.
4. Env changes in Vercel need a **redeploy** to take effect (they are baked in at build time).

## 4. Connect the pieces
1. Render → `CORS_ORIGIN` = your Vercel URL (e.g. `https://staff.example.com`). Redeploy the API.
2. Supabase → **Authentication → URL Configuration**: Site URL = your Vercel URL; add it under **Redirect URLs** too. Password-reset links return users to this URL.
3. Custom domain (optional): add it in Vercel, then update `CORS_ORIGIN` and the Supabase URLs to match.

## 5. Smoke test (10 minutes)
1. Sign in as the admin. **Staff**: add yourself with a login and a pay rate; add a test employee.
2. **Roster**: create a shift, assign it for today.
3. **Dashboard**: clock in and out as the test employee (or for them as admin); check **Attendance**.
4. **Leave**: request leave as the employee, approve it as admin; check the balance card and that an email arrives (or the Render logs show `[notify]` lines if no keys are set).
5. **Payroll**: generate a draft for this month, add a bonus, approve, download a payslip PDF and the bank CSV.
6. **Audit log**: your actions appear.
7. **Forgot password** on the login page: the email arrives and the link opens "Set a new password".
8. Staff role: sign in as the employee and confirm they cannot see Staff, Payroll or Audit pages, nor other people's pay.

## 5b. Optional: demo data
On a **test** Supabase project you can fill the app with sample data: copy `server/.env.example` to `server/.env` (with that project's URL and service-role key) and run `npm run seed` from `server/`. Remove it with `npm run seed:reset`. Do not seed your production database; the script refuses to run against a database with real staff unless forced.

## 6. Going live
- **Paystack:** test with the test key and a few staff first. Switch to the live key only after the payout CSV matches what you expect. Transfers need a funded balance and may require OTP approval or IP whitelisting on your Paystack account.
- **Money paths:** have an accountant verify one full payroll run (PAYE, pension) against your own calculation before paying anyone.
- **Backups:** check your Supabase plan's backup coverage. Regardless of plan, schedule an occasional `pg_dump` (Project Settings → Database has the connection string) and store it off-platform.
- **Secrets:** the service-role key bypasses all database rules. Keep it only in Render; rotate it (Supabase → API) if it's ever pasted somewhere it shouldn't be.
- **Monitoring:** uptime check on `/health`; review Render logs after the first payroll run.
- **Housekeeping:** set each employee's `hired_on` (needed for leave carry-over), bank details, rent and pensionable pay before the first real payroll.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Browser console: CORS error | `CORS_ORIGIN` doesn't exactly match the Vercel URL (check `https`, no trailing slash); redeploy the API |
| Login works but app says "No profile for this account" | The user has no row in `profiles`; insert one (see 1.5) |
| Everything is 401 | Wrong `VITE_SUPABASE_*` values, or the API's `SUPABASE_URL` points at a different project |
| First load very slow | Free Render instance waking up |
| Reset link lands on the wrong site or errors | Site URL / Redirect URLs not set in Supabase |
| No emails | Missing `RESEND_API_KEY`, unverified sending domain, or `staff.email` empty; the Render log shows `[notify]` lines |
| Paystack "recipient"/"bank code" errors | Wrong bank code or account number on the staff record |
