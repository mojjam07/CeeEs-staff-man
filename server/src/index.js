import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { auth } from "./middleware/auth.js";
import staff from "./routes/staff.js";
import shifts from "./routes/shifts.js";
import attendance from "./routes/attendance.js";
import payouts from "./routes/payouts.js";
import leave from "./routes/leave.js";
import auditRoutes from "./routes/audit.js";
import { audit } from "./middleware/audit.js";
import payroll from "./routes/payroll.js";

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(","),
  }),
);
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/api", (_, res) =>
  res.json({ ok: true, service: "staff-attendance-api" }),
); // public check; every other /api route needs a token
app.use("/api", auth);
app.use("/api", audit);
app.get("/api/me", (req, res) => res.json(req.user));
app.use("/api/staff", staff);
app.use("/api/shifts", shifts);
app.use("/api/attendance", attendance);
app.use("/api/payroll", payouts); // before payroll: its admin-only gate must not block owners' PDFs
app.use("/api/payroll", payroll);
app.use("/api/leave", leave);
app.use("/api/audit", auditRoutes);

app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

if (!process.env.VERCEL)
  app.listen(process.env.PORT || 4000, () =>
    console.log("API running on :" + (process.env.PORT || 4000)),
  );
export default app; // lets Vercel run the API as a serverless function
