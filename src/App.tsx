import { Suspense, lazy, useEffect, useState } from "react";
import "./App.css";
import WelcomeScreen from "./components/WelcomeScreen";
import type { StoredGuestProfile, StoredPlayerProfile } from "./types/user";
import { loadPlayerStatsAWS } from "./store/awsProfiles";
import { useGameStore } from "./store/store";

const GameCanvas = lazy(() => import("./components/GameCanvas"));
const BYPASS_AUTH = (import.meta.env.VITE_BYPASS_AUTH ?? "false") === "true";

interface User {
  id: string;
  fullName: string;
  email?: string;
  isGuest?: boolean;
  kills?: number;
}
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const setProfileStats = useGameStore((state) => state.setProfileStats);

  useEffect(() => {
    const storedPlayerRaw = localStorage.getItem("playerProfile");
    if (storedPlayerRaw) {
      try {
        const storedPlayer: StoredPlayerProfile = JSON.parse(storedPlayerRaw);
        setUser({
          id: storedPlayer.id,
          fullName: [storedPlayer.firstName, storedPlayer.lastName].filter(Boolean).join(" ").trim() || "Player",
          email: storedPlayer.email,
          isGuest: false,
          kills: storedPlayer.kills ?? 0,
        });
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem("playerProfile");
      }
    }

    const storedGuest = localStorage.getItem("guestProfile");
    if (storedGuest) {
      try {
        const guest: StoredGuestProfile = JSON.parse(storedGuest);
        setUser({
          id: guest.id,
          fullName: guest.fullName || "Player",
          email: guest.email,
          isGuest: true,
          kills: guest.kills ?? 0,
        });
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem("guestProfile");
      }
    }

    setLoading(false);

    if (BYPASS_AUTH) {
      setUser({
        id: "dev-tester",
        fullName: "Dev Tester",
        email: "tester@example.com",
        isGuest: false,
        kills: 0,
      });
    }
  }, []);

  useEffect(() => {
    const preventZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const preventGestureZoom = (event: Event) => event.preventDefault();

    document.addEventListener("touchstart", preventZoom, { passive: false });
    document.addEventListener("gesturestart", preventGestureZoom);
    document.addEventListener("gesturechange", preventGestureZoom);
    document.addEventListener("gestureend", preventGestureZoom);

    return () => {
      document.removeEventListener("touchstart", preventZoom);
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("gestureend", preventGestureZoom);
    };
  }, []);

  useEffect(() => {
    if (!user || user.isGuest) {
      setProfileStats(null, null);
      return;
    }
    let cancelled = false;
    (async () => {
      const stats = await loadPlayerStatsAWS(user.id);
      if (!cancelled) {
        setProfileStats(stats?.kills ?? null, stats?.rank ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setProfileStats, user]);

  useEffect(() => {
    if (user) return;
    const restBase: string | undefined = (window as { CLTDTheme?: { clownhuntRestBase?: string } }).CLTDTheme?.clownhuntRestBase;
    const token =
      new URLSearchParams(window.location.search).get("clownhunt_token") ||
      localStorage.getItem("clownhunt_token");
    if (!token || !restBase) return;

    let cancelled = false;
    (async () => {
      try {
        const normalizedBase = restBase.replace(/\/$/, "");
        const response = await fetch(
          `${normalizedBase}/validate_token?token=${encodeURIComponent(token)}`,
          { method: "GET" },
        );
        if (!response.ok) {
          throw new Error(`Token validation failed with ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;
        if (data?.status === "success" && data?.user_id) {
          setUser({
            id: String(data.user_id),
            fullName: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || data.full_name || "Player",
            email: data.email,
            isGuest: Boolean(data.is_guest),
            kills: data.kills ?? 0,
          });
          return;
        }
        throw new Error("Token validation response missing user data");
      } catch (error) {
        console.warn("❌ Token validation failed:", error);
        localStorage.removeItem("clownhunt_token");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return <div className="app__loading">Preparing session…</div>;
  }

  if (!user) {
    if (BYPASS_AUTH) {
      return <div className="app__loading">Preparing dev session…</div>;
    }
    return (
      <div className="welcome-screen auth-gate">
        <div className="welcome-box auth-box">
          <h1 className="welcome-box-header">Sign In</h1>
          <p className="auth-message">Please authenticate through WordPress to enter the arena.</p>
          <div className="welcome-actions">
            <button
              className="menu-button action-button"
              onClick={() => window.location.assign("https://www.crystalthedeveloper.ca/log-in")}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!gameStarted ? (
        <WelcomeScreen userName={user.fullName} isGuest={user.isGuest} onStart={() => setGameStarted(true)} />
      ) : (
        <Suspense fallback={<div className="app__loading">Launching arena...</div>}>
          <GameCanvas />
        </Suspense>
      )}
    </>
  );
}

export default App;
