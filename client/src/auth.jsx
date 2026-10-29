import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { api } from './lib/api';

const Ctx = createContext();
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => { if (event === 'PASSWORD_RECOVERY') setRecovering(true); setSession(s); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) { setMe(null); return; }
    setError('');
    api('/me').then(setMe).catch((e) => setError(e.message));
  }, [ready, session?.user?.id]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signOut = () => supabase.auth.signOut();
  const forgot = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
  };
  const changePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovering(false);
  };

  return <Ctx.Provider value={{ ready, session, me, error, recovering, signIn, signOut, forgot, changePassword }}>{children}</Ctx.Provider>;
}
