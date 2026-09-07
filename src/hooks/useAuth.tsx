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
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const GOOGLE_OAUTH_TIMEOUT_MS = 15000;

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
  if (lower.includes("provider") || lower.includes("oauth")) {
    return new Error("Google sign-in is not available yet. Check the Supabase Google provider and redirect URL configuration.");
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

function addGoogleButtonBranding() {
  if (typeof document === "undefined") return undefined;
  const styleId = "athleteos-google-auth-branding";
  if (document.getElementById(styleId)) return undefined;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .oauth-btn { gap: 10px; }
    .oauth-btn::before {
      content: "";
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      background: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234285F4' d='M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42z'/%3E%3Cpath fill='%2334A853' d='M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5z'/%3E%3Cpath fill='%23FBBC05' d='M6.54 12.66A5.84 5.84 0 0 1 6.23 11c0-.58.11-1.14.31-1.66V6.81H3.3A9.74 9.74 0 0 0 2.25 11c0 1.57.38 3.05 1.05 4.19l3.24-2.53z'/%3E%3Cpath fill='%23EA4335' d='M12 5.31c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 2.43 14.63 1.5 12 1.5a9.74 9.74 0 0 0-8.7 5.31l3.24 2.53C7.31 7.03 9.46 5.31 12 5.31z'/%3E%3C/svg%3E");
    }
  `;
  document.head.appendChild(style);
  return () => style.remove();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const removeGoogleBranding = addGoogleButtonBranding();
    return () => removeGoogleBranding?.();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
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
    async signInWithGoogle() {
      try {
        const oauthPromise = requireSupabase().auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: "offline",
              prompt: "consent"
            }
          }
        });
        const timeoutPromise = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Google sign-in timed out. Please check your connection and try again.")), GOOGLE_OAUTH_TIMEOUT_MS);
        });
        const { error } = await Promise.race([oauthPromise, timeoutPromise]);
        if (error) throw error;
      } catch (error) {
        throw toSafeAuthError(error, "Google sign-in could not be started. Please try again.");
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
