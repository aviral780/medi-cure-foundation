import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  adminChecked: boolean;
  signOut: () => Promise<void>;
};

const ADMIN_CACHE_KEY = "medicure:isAdmin";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    // Register listener first, then hydrate current session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Hydrate cached admin flag on mount so a refresh does not momentarily
  // treat a known admin as a patient before the live check completes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(ADMIN_CACHE_KEY) === "1") setIsAdmin(true);
  }, []);

  // Re-check admin membership whenever the authenticated user changes so
  // admin session state stays correct across page refreshes / reloads.
  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setAdminChecked(true);
      if (typeof window !== "undefined") window.localStorage.removeItem(ADMIN_CACHE_KEY);
      return;
    }
    setAdminChecked(false);
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("admins")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          // Transient/RLS error: keep any previously cached value so a known
          // admin is not demoted to a patient on a flaky refresh.
          setAdminChecked(true);
          return;
        }
        const admin = Boolean(data);
        setIsAdmin(admin);
        setAdminChecked(true);
        if (typeof window !== "undefined") {
          if (admin) window.localStorage.setItem(ADMIN_CACHE_KEY, "1");
          else window.localStorage.removeItem(ADMIN_CACHE_KEY);
        }
      } catch {
        if (!cancelled) setAdminChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isAdmin,
      adminChecked,
      signOut: async () => {
        if (typeof window !== "undefined") window.localStorage.removeItem(ADMIN_CACHE_KEY);
        await supabase.auth.signOut();
      },
    }),
    [session, loading, isAdmin, adminChecked],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}