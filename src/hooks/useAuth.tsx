import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { requireSupabase, supabase } from "../lib/supabase";

interface Credentials {
  email: string;
  password: string;
}

interface SignUpCredentials extends Credentials {
  metadata?: Record<string, string>;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  emailVerified: boolean;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signIn: (credentials: Credentials) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSafeAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (error instanceof TypeError && lower.includes("failed to fetch")) {
    return new Error("Unable to connect to AthleteOS services. Please check your connection and try again.");
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return new Error("Registration service is temporarily unavailable. Please try again.");
  }
  if (lower.includes("invalid login credentials")) {
    return new Error("The email or password is incorrect.");
  }
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return new Error("An account with this email may already exist. Try logging in or resetting your password.");
  }
  if (lower.includes("expired") || lower.includes("one-time token")) {
    return new Error("This verification link has expired. Request a new verification email.");
  }
  if (lower.includes("rate limit") || lower.includes("only request this after")) {
    return new Error("Please wait a moment before requesting another email.");
  }
  if (lower.includes("password")) {
    return new Error("Your email or password could not be accepted. Please check the requirements and try again.");
  }

  return new Error(message || fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: Boolean(supabase),
    emailVerified: Boolean(session?.user.email_confirmed_at),
    async signUp({ email, password, metadata }) {
      try {
        const { error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: {
            data: metadata,
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
      } catch (error) {
        throw toSafeAuthError(error, "Registration could not be completed. Please try again.");
      }
    },
    async signIn({ email, password }) {
      try {
        const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      } catch (error) {
        throw toSafeAuthError(error, "Login could not be completed. Please try again.");
      }
    },
    async resetPassword(email) {
      try {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) throw error;
      } catch (error) {
        throw toSafeAuthError(error, "Password reset could not be started. Please try again.");
      }
    },
    async resendVerification(email) {
      try {
        const { error } = await requireSupabase().auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
      } catch (error) {
        throw toSafeAuthError(error, "Verification email could not be resent. Please try again.");
      }
    },
    async updatePassword(password) {
      try {
        const { error } = await requireSupabase().auth.updateUser({ password });
        if (error) throw error;
      } catch (error) {
        throw toSafeAuthError(error, "Password could not be updated. Please try again.");
      }
    },
    async signOut() {
      const { error } = await requireSupabase().auth.signOut();
      if (error) throw error;
    }
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
