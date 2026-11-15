import { supabase } from "../supabase.js";
import { httpError } from "../util.js";

async function ensureProfileForUser(user) {
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("role, staff_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) throw httpError(500, existingError.message);
  if (existing) return existing;

  const email = (user.email || "").trim().toLowerCase();
  if (!email) throw httpError(403, "No profile for this account");

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (staffError) throw httpError(500, staffError.message);

  const profile = {
    id: user.id,
    role: "staff",
    staff_id: staff?.id ?? null,
  };

  if (staff) {
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(profile, { onConflict: "id" });
    if (upsertError) throw httpError(500, upsertError.message);
    return profile;
  }

  // If there is no matching staff record, do not silently grant access.
  throw httpError(403, `No profile for this account: ${user.email}`);
}

export async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) throw httpError(401, "Missing token");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw httpError(401, "Invalid or expired token");

  const profile = await ensureProfileForUser(data.user);
  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role,
    staffId: profile.staff_id,
  };
  next();
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : next(httpError(403, "Not allowed"));
