import { lazy, Suspense, useEffect, useState } from "react";
import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import { SupabaseAuth } from "./store/SupabaseAuth";
import { getUserName } from "./store/supabaseHelpers";
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

  // ✅ Initial session check (on mount)
  useEffect(() => {
    async function fetchUser() {
      const storedGuest = localStorage.getItem("guestProfile");
      if (storedGuest) {
        try {
          const guest = JSON.parse(storedGuest);
          setUser({
            id: guest.id,
            fullName: guest.fullName || guest.display_name || "Player",
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

      const loggedInUser = await SupabaseAuth.getUser();
      if (loggedInUser) {
        const fullName = await getUserName();
        setUser({
          id: loggedInUser.id,
          fullName: fullName || "Player",
        });
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

  // ✅ After login, update user + skip reload
  interface AuthSuccessPayload {
    id: string;
    fullName?: string;
    email?: string;
    isGuest?: boolean;
    kills?: number;
  }

  const handleLoginSuccess = async (supabaseUser: AuthSuccessPayload) => {
    if (supabaseUser?.isGuest) {
      setUser({
        id: supabaseUser.id,
        fullName: supabaseUser.fullName || "Player",
        email: supabaseUser.email,
        isGuest: true,
        kills: supabaseUser.kills ?? 0,
      });
      return;
    }

    const fullName = await getUserName();
    localStorage.removeItem("guestProfile");
    setUser({
      id: supabaseUser.id,
      fullName: fullName || "Player",
    });
  };

  const handleSignOut = async () => {
    if (user?.isGuest) {
      localStorage.removeItem("guestProfile");
      setUser(null);
      setGameStarted(false);
      return;
    }

    await SupabaseAuth.signOut();
    localStorage.removeItem("guestProfile");
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
          <GameCanvas user={user} />
        </Suspense>
      )}
    </>
  );
}

export default App;
