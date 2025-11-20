import { Suspense, lazy, useEffect, useRef, useState } from "react";
import "./App.css";
import WelcomeScreen from "./components/WelcomeScreen";
import type { SessionUser, StoredGuestProfile, StoredPlayerProfile } from "./types/user";
import { loadPlayerStatsAWS } from "./store/awsProfiles";
import { useGameStore } from "./store/store";

const GameCanvas = lazy(() => import("./components/GameCanvas"));
const BYPASS_AUTH = (import.meta.env.VITE_BYPASS_AUTH ?? "false") === "true";

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [hasPendingToken, setHasPendingToken] = useState(false);
  const setProfileStats = useGameStore((state) => state.setProfileStats);
  const killsLoaded = useGameStore((state) => state.killsLoaded);
  const resetProfileStats = useGameStore((state) => state.resetProfileStats);

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
          firstName: storedPlayer.firstName,
          lastName: storedPlayer.lastName,
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
        firstName: "Dev",
        lastName: "Tester",
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

  const lastValidatedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const guestToken =
      searchParams.get("clownhunt_guest_token") || localStorage.getItem("clownhunt_guest_token");
    const playerToken =
      searchParams.get("clownhunt_token") || localStorage.getItem("clownhunt_token");
    const activeToken = guestToken || playerToken;
    const tokenExists = Boolean(activeToken);
    if (hasPendingToken !== tokenExists) {
      setHasPendingToken(tokenExists);
    }
    if (!activeToken) return;
    const restBaseParam = searchParams.get("clownhunt_rest_base");
    const restBase =
      restBaseParam ||
      localStorage.getItem("clownhunt_rest_base") ||
      (window as { CLTDTheme?: { clownhuntRestBase?: string } }).CLTDTheme?.clownhuntRestBase;
    if (!restBase) {
      console.warn("❌ Missing clownhunt_rest_base; cannot validate token.");
      setHasPendingToken(false);
      return;
    }
    if (restBaseParam) {
      localStorage.setItem("clownhunt_rest_base", restBaseParam);
    }

    if (lastValidatedTokenRef.current === activeToken) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const normalizedBase = restBase.replace(/\/$/, "");
        const response = await fetch(
          `${normalizedBase}/validate_token?token=${encodeURIComponent(activeToken)}`,
          { method: "GET" },
        );
        if (!response.ok) {
          throw new Error(`Token validation failed with ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;
        if (data?.status === "success") {
          const isGuest = Boolean(data.is_guest);
          const resolvedId = isGuest ? data.guest_id ?? data.user_id : data.user_id;
          if (!resolvedId) {
            throw new Error("Token validation response missing user identifier");
          }

          const firstNameRaw =
            typeof data.first_name === "string" && data.first_name.trim() ? data.first_name.trim() : undefined;
          const lastNameRaw =
            typeof data.last_name === "string" && data.last_name.trim() ? data.last_name.trim() : undefined;
          const fullNameFallback = data.full_name && data.full_name.trim() ? data.full_name.trim() : "Player";
          const fullName = (isGuest ? firstNameRaw : `${firstNameRaw ?? ""} ${lastNameRaw ?? ""}`.trim()) || fullNameFallback;

          setUser({
            id: String(resolvedId),
            fullName,
            email: data.email,
            isGuest,
            firstName: firstNameRaw,
            lastName: lastNameRaw,
          });

          if (!isGuest) {
            const storedProfile: StoredPlayerProfile = {
              id: String(resolvedId),
              email: data.email ?? undefined,
              firstName: firstNameRaw,
              lastName: lastNameRaw,
            };
            localStorage.setItem("playerProfile", JSON.stringify(storedProfile));
          } else {
            const storedGuest: StoredGuestProfile = {
              id: String(resolvedId),
              email: data.email ?? undefined,
              fullName,
              kills: typeof data.kills === "number" ? data.kills : undefined,
              rank: typeof data.rank === "number" ? data.rank : undefined,
            };
            localStorage.setItem("guestProfile", JSON.stringify(storedGuest));
          }
          lastValidatedTokenRef.current = activeToken;
          setHasPendingToken(false);
          return;
        }
        throw new Error("Token validation response missing user data");
      } catch (error) {
        console.warn("❌ Token validation failed:", error);
        localStorage.removeItem("clownhunt_token");
        localStorage.removeItem("clownhunt_guest_token");
        setHasPendingToken(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPendingToken, setHasPendingToken, user]);

  const lastProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = user?.id ?? null;
    if (currentId !== lastProfileIdRef.current) {
      resetProfileStats();
      lastProfileIdRef.current = currentId;
    }
  }, [resetProfileStats, user?.id]);

  useEffect(() => {
    if (!user) return;
    if (gameStarted) return;
    if (killsLoaded) return;

    if (user.isGuest) {
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
  }, [gameStarted, killsLoaded, setProfileStats, user]);

  if (loading) {
    return <div className="app__loading">Preparing session…</div>;
  }

  if (!user) {
    if (BYPASS_AUTH) {
      return <div className="app__loading">Preparing dev session…</div>;
    }
    if (hasPendingToken) {
      return <div className="app__loading">Validating access…</div>;
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
          <GameCanvas user={user} />
        </Suspense>
      )}
    </>
  );
}

export default App;
