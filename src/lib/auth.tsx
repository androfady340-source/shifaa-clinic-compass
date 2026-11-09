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
    let active = true;
    let requestVersion = 0;

    const load = async (user: User | null) => {
      const version = ++requestVersion;
      let isAdmin = false;
      try {
        if (user) {
          const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
          if (error) throw error;
          isAdmin = !!data;
        }
      } catch (error) {
        console.error("Unable to verify clinic administrator role", error);
      }
      if (active && version === requestVersion) {
        setState({ user, isAdmin, ready: true });
      }
    };

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error) throw error;
        return load(data.user);
      })
      .catch((error) => {
        console.error("Unable to restore clinic session", error);
        if (active) setState({ user: null, isAdmin: false, ready: true });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void load(session?.user ?? null);
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
      else qc.clear();
    });

    return () => {
      active = false;
      requestVersion++;
      sub.subscription.unsubscribe();
    };
  }, [router, qc]);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
