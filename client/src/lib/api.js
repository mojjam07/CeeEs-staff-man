import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function api(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

// GET helper: const { data, error, reload } = useApi('/staff')  (pass null to skip)
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: '' });
  const reload = useCallback(() => {
    if (!path) return;
    api(path).then((data) => setState({ data, error: '' })).catch((e) => setState({ data: null, error: e.message }));
  }, [path]);
  useEffect(reload, [reload]);
  return { ...state, reload };
}

// Download a binary/CSV response with the auth header (plain links can't send the token)
export async function download(path, filename) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${session?.access_token}` } });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || res.statusText); }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
