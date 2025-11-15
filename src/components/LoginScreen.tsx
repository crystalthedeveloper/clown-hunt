// components/LoginScreen.tsx

import { useEffect, useState } from "react";
import { AuthSuccessPayload, StoredPlayerProfile } from "../types/user";
import {
  loadGuestStatsAWS,
  loadPlayerStatsAWS,
  saveGuestStatsAWS,
} from "../store/awsProfiles";
import "../css/LoginScreen.css";

interface LoginScreenProps {
  onLoginSuccess: (user: AuthSuccessPayload) => void;
}

interface PlayerTokenResult {
  status?: string;
  user_id?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  message?: string;
}

interface GuestTokenResult {
  status?: string;
  guest_id?: string;
  email?: string | null;
  first_name?: string | null;
  message?: string;
}

const normalizeString = (value?: string | null) => value?.trim() ?? "";
const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const WORDPRESS_API_BASE = (import.meta.env.VITE_WORDPRESS_API_BASE || "").replace(/\/$/, "");

function buildWordpressUrl(path: string) {
  const base = WORDPRESS_API_BASE;
  if (!base) {
    throw new Error("WordPress API base URL is not configured.");
  }
  return `${base}${path}`;
}

async function validatePlayerToken(token: string): Promise<PlayerTokenResult> {
  const response = await fetch(buildWordpressUrl("/wp-json/clownhunt/v1/validate_token"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(`Token validation failed (${response.status})`);
  }
  return response.json();
}

async function validateGuestToken(token: string): Promise<GuestTokenResult> {
  const response = await fetch(buildWordpressUrl("/wp-json/clownhunt/v1/validate_guest_token"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(`Guest token validation failed (${response.status})`);
  }
  return response.json();
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [statusMessage, setStatusMessage] = useState("Validating session…");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const syncPlayer = async (token: string) => {
      setStatusMessage("Validating WordPress token…");
      const validation = await validatePlayerToken(token);
      if (validation.status !== "success" || !validation.user_id) {
        throw new Error(validation.message || "Invalid player token.");
      }

      const awsProfile = await loadPlayerStatsAWS(validation.user_id);

      const firstName =
        normalizeString(validation.first_name) ||
        normalizeString(awsProfile?.first_name) ||
        "Player";
      const lastName = normalizeString(validation.last_name) || normalizeString(awsProfile?.last_name);
      const email =
        normalizeString(validation.email) ||
        normalizeString(awsProfile?.email) ||
        undefined;

      const kills = Number(awsProfile?.kills ?? 0);
      const rank = typeof awsProfile?.rank === "number" ? awsProfile.rank : null;

      const storedProfile: StoredPlayerProfile = {
        id: validation.user_id,
        email,
        firstName,
        lastName,
        kills,
        rank,
      };

      localStorage.setItem("playerProfile", JSON.stringify(storedProfile));
      localStorage.removeItem("guestProfile");

      onLoginSuccess({
        id: validation.user_id,
        email,
        fullName: [firstName, lastName].filter(Boolean).join(" ").trim() || firstName,
        kills,
        rank,
      });
    };

    const syncGuest = async (token: string) => {
      setStatusMessage("Validating guest token…");
      const validation = await validateGuestToken(token);
      if (validation.status !== "success" || !validation.guest_id) {
        throw new Error(validation.message || "Invalid guest token.");
      }

      const awsProfile = await loadGuestStatsAWS(validation.guest_id);

      const firstName =
        normalizeString(validation.first_name) ||
        normalizeString(awsProfile?.first_name) ||
        "Guest";
      const email =
        normalizeString(validation.email) ||
        normalizeString(awsProfile?.email) ||
        undefined;
      const kills = Number(awsProfile?.kills ?? 0);
      const rank = typeof awsProfile?.rank === "number" ? awsProfile.rank : null;

      await saveGuestStatsAWS({
        guest_id: validation.guest_id,
        email,
        first_name: firstName,
        kills,
        rank,
      });

      localStorage.setItem(
        "guestProfile",
        JSON.stringify({
          id: validation.guest_id,
          email,
          fullName: firstName,
          kills,
          rank,
        })
      );
      localStorage.removeItem("playerProfile");

      onLoginSuccess({
        id: validation.guest_id,
        email,
        fullName: firstName,
        isGuest: true,
        kills,
        rank,
      });
    };

    const processTokens = async () => {
      const params = new URLSearchParams(window.location.search);
      const playerToken = params.get("clownhunt_token");
      const guestToken = params.get("clownhunt_guest_token");
      if (!playerToken && !guestToken) {
        setStatusMessage("Please log in from the main website to play.");
        return;
      }

      try {
        if (playerToken) {
          await syncPlayer(playerToken);
          return;
        }
        if (guestToken) {
          await syncGuest(guestToken);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(`❌ ${message}`);
        setStatusMessage("Unable to authenticate.");
      }
    };

    processTokens();

    return () => {
      cancelled = true;
    };
  }, [onLoginSuccess]);

  return (
    <div className="login-screen fade-in">
      <div className="login-box">
        <h2 className="login-box-header">Authenticating</h2>
        <p className="status-text">{statusMessage}</p>
        {error && <p className="error">{error}</p>}

        <div className="button-group">
          <button
            className="back-button"
            onClick={() => (window.location.href = "https://www.crystalthedeveloper.ca")}
          >
            Back to Home
          </button>

          <button
            className="next-button"
            onClick={() => (window.location.href = "https://www.crystalthedeveloper.ca/sign-up")}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
