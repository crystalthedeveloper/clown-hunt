import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";
import App from "./App.tsx";

const params = new URLSearchParams(window.location.search);
const token = params.get("clownhunt_token");

if (token) {
  localStorage.setItem("clownhunt_token", token);
  if (window.location.search.includes("clownhunt_token")) {
    const newUrl = window.location.pathname;
    setTimeout(() => history.replaceState({}, "", newUrl), 500);
  }
}

const savedToken =
  new URLSearchParams(window.location.search).get("clownhunt_token") ||
  localStorage.getItem("clownhunt_token");

if (savedToken) {
  (window as Window & { __CLOWNHUNT_TOKEN__?: string }).__CLOWNHUNT_TOKEN__ = savedToken;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
