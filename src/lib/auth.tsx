import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = { user: User | null; isAdmin: boolean; ready: boolean };
const AuthCtx = createContext<AuthState>({ user: null, isAdmin: false, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAdmin: false, ready: false });
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const load = async (user: User | null) => {
      let isAdmin = false;
      if (user) {
        const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        isAdmin = !!data;
      }
      setState({ user, isAdmin, ready: true });
    };
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void load(session?.user ?? null);
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
      else qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
