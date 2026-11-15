import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function decodeJwtRole(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload?.role ?? null;
  } catch {
    return null;
  }
}

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the client .env file.",
  );
}

const role = decodeJwtRole(anonKey);
if (role === "service_role") {
  throw new Error(
    "VITE_SUPABASE_ANON_KEY is set to the Supabase service_role key. Use the anon key from Supabase → Project Settings → API instead.",
  );
}

export const supabase = createClient(url, anonKey);
