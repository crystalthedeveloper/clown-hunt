import { lazy, Suspense, useEffect, useState } from "react";
import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import type { AuthSuccessPayload, StoredGuestProfile, StoredPlayerProfile } from "./types/user";
import "./App.css";

interface User {
  id: string;
  fullName: string;
  email?: string;
  isGuest?: boolean;
  kills?: number;
}

const GameCanvas = lazy(() => import("./components/GameCanvas"));

function App() {

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    function fetchUser() {
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
    }

    fetchUser();
  }, []);

  // ✅ Prevent zooming (touch devices)
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

  const handleLoginSuccess = (payload: AuthSuccessPayload) => {
    if (payload?.isGuest) {
      setUser({
        id: payload.id,
        fullName: payload.fullName || "Player",
        email: payload.email,
        isGuest: true,
        kills: payload.kills ?? 0,
      });
      return;
    }

    localStorage.removeItem("guestProfile");
    setUser({
      id: payload.id,
      fullName: payload.fullName || "Player",
      email: payload.email,
      isGuest: false,
      kills: payload.kills ?? 0,
    });
  };

  const handleSignOut = async () => {
    if (user?.isGuest) {
      localStorage.removeItem("guestProfile");
      setUser(null);
      setGameStarted(false);
      return;
    }

    localStorage.removeItem("playerProfile");
    setUser(null);
    setGameStarted(false);
  };

  if (loading) return null;

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      {!gameStarted ? (
        <WelcomeScreen
          userName={user.fullName}
          isGuest={user.isGuest}
          onStart={() => setGameStarted(true)}
          onSignOut={handleSignOut}
        />
      ) : (
        <Suspense fallback={<div className="app__loading">Launching arena...</div>}>
          <GameCanvas />
        </Suspense>
      )}
    </>
  );
}

export default App;
