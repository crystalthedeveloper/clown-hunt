// components/LoginScreen.tsx

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "../store/supabaseClient";
import { SupabaseGuestProfiles } from "../store/SupabaseGuestProfiles";
import "../css/LoginScreen.css";

interface GuestLoginPayload {
  id: string;
  email?: string;
  fullName: string;
  kills: number;
  isGuest: true;
}

type LoginSuccessPayload = SupabaseUser | GuestLoginPayload;

interface LoginScreenProps {
  onLoginSuccess: (user: LoginSuccessPayload) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          console.log("✅ Auto-login with session");
          onLoginSuccess(userData.user);
          return;
        }
      }
      setCheckingSession(false);
    };

    checkSession();

    // ✅ Listen for auth changes (auto-login after form submission)
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        console.log("🎉 Supabase SIGNED_IN event");
        onLoginSuccess(session.user);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [onLoginSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw new Error(error.message);

      // ❗️DO NOT call onLoginSuccess here directly
      // Let the auth listener above handle it
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`❌ Login failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setGuestLoading(true);

    try {
      const { profile } = await SupabaseGuestProfiles.upsertProfile(email, guestName);

      const guestUser: GuestLoginPayload = {
        id: profile.id,
        email: profile.email,
        fullName: profile.display_name || guestName || "Guest",
        kills: profile.kills ?? 0,
        isGuest: true,
      };

      localStorage.setItem("guestProfile", JSON.stringify(guestUser));
      onLoginSuccess(guestUser);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`❌ Guest access failed: ${message}`);
    } finally {
      setGuestLoading(false);
    }
  };

  if (checkingSession) return null; // or show a loading spinner

  return (
    <div className="login-screen fade-in">
      <div className="login-box">
        <h2 className="login-box-header">Login</h2>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            autoFocus
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Checking credentials..." : "Log In"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <div className="guest-section">
          <h3>Guest Access</h3>
          <p className="guest-hint">Enter your email and an optional display name to continue instantly.</p>
          <form onSubmit={handleGuestAccess}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
            />
            <input
              type="text"
              placeholder="Display name (optional)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <button type="submit" className="guest-button" disabled={guestLoading}>
              {guestLoading ? "Preparing session..." : "Continue as Guest"}
            </button>
          </form>
        </div>

        <div className="button-group">
          <button
            className="back-button"
            onClick={() => (window.location.href = "https://www.crystalthedeveloper.ca")}
          >
            Back to Home
          </button>

          <button
            className="next-button"
            onClick={() => (window.location.href = "https://www.crystalthedeveloper.ca/user-pages/signup")}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
