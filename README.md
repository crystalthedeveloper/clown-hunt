# Clown Hunt FPS

Wave-based arena shooter where you battle an endless parade of murderous clowns, collect weapon upgrades, and climb the leaderboard. Built with React, Vite, and the React Three Fiber ecosystem.

---

## Key Features

- **Futuristic arena** – Reflective black floor, space HDR lighting, and moody fog for a cinematic feel.
- **Procedural terrain** – Heightfield-aware physics keeps movement smooth across rolling hills.
- **Wave system** – Increasingly aggressive clowns spawn every round with escalating health and speed.
- **Power logos** – Collect logos each wave to unlock higher-tier weapons and damage bonuses.
- **Reactive HUD** – In-game notifications, scoreboard, and minimal UI that responds to events.
- **Leaderboards & profiles** – AWS Lambda + DynamoDB endpoints persist WordPress player and guest progress plus the global leaderboard.
- **Token-only authentication** – WordPress issues temporary player/guest tokens; the game auto-logs users in with no on-screen forms.
- **Cross-device controls** – Desktop and touch-friendly virtual trackpad with accessible keyboard support.

---

## Gameplay Controls

| Action        | Touch / Trackpad                                              |
| ------------- | ------------------------------------------------------------- |
| Move / Rotate | Drag on the virtual trackpad (bottom-left)                    |
| Shoot         | Tap the bullet icon button                                    |
| Collect logos | Run over glowing logos to grab fresh weapon upgrades each wave|
| Menu actions  | Use on-screen buttons after defeat or from the pause overlay  |

> Tip: logos reposition and scale tiers every wave, so don’t leave any behind.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **3D & Physics:** @react-three/fiber, drei, cannon-es via @react-three/cannon
- **State Management:** Zustand
- **Backend:** AWS Lambda + DynamoDB (profiles, guests, top 8 leaderboard)
- **Tooling:** ESLint, npm scripts, Vite build pipeline

---

## Project Structure

```
├── public/                     # Static assets (HDR, GLBs, audio)
├── src/
│   ├── components/             # R3F scene objects, UI overlays, gameplay entities
│   ├── config/                 # Gameplay tuning constants, weapon data
│   ├── css/                    # Component-scoped stylesheets
│   ├── store/                  # Zustand game store + AWS helpers
│   └── main.tsx                # App bootstrap
├── .env                        # Environment variables (AWS Lambda URLs, etc.)
├── vite.config.ts              # Vite + bundler configuration
└── README.md
```

---

## Requirements

- Node.js ≥ 18.0
- npm ≥ 9 (bundled with Node 18+)
- WordPress REST endpoints that issue 5-minute JSON tokens:
  - `POST /wp-json/clownhunt/v1/validate_token`
  - `POST /wp-json/clownhunt/v1/validate_guest_token`
- AWS API Gateway / Lambda endpoints wired to DynamoDB tables:
  - `save_player_profile` (POST)
  - `load_player_profile` (POST)
  - `save_guest_profile` (POST)
  - `load_guest_profile` (POST)
  - `leaderboard` (GET returning the global top 8)

---

## Getting Started

1. **Clone & install**
   ```bash
   git clone https://github.com/your-org/clown-hunt.git
   cd clown-hunt
   npm install
   ```

2. **Configure environment**

   Create a `.env` file at the project root (or copy from `.env.example`) that defines the Lambda endpoints:
   ```ini
   VITE_AWS_SAVE_PLAYER_PROFILE_URL=https://your-api/save_player_profile
   VITE_AWS_LOAD_PLAYER_PROFILE_URL=https://your-api/load_player_profile
   VITE_AWS_SAVE_GUEST_PROFILE_URL=https://your-api/save_guest_profile
   VITE_AWS_LOAD_GUEST_PROFILE_URL=https://your-api/load_guest_profile
   VITE_AWS_LEADERBOARD_URL=https://your-api/leaderboard
   ```

3. **Run the dev server**
   ```bash
   npm run dev
   ```
   The app is available at http://localhost:5173 by default.

---

## Useful Scripts

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start Vite dev server with hot reload       |
| `npm run build`     | Type-check and build production bundle      |
| `npm run preview`   | Serve the production build locally          |
| `npm run lint`      | Run ESLint (type-aware rules)               |

---

## AWS Lambda Contracts

The frontend calls five Lambda-backed HTTP endpoints (API Gateway, CloudFront, etc.). Each one speaks JSON and should respond with `{ status: "success", ... }` when things go well.

- **save_player_profile** (`POST`)<br/>
  Request body: `{ user_id, email, first_name, last_name, kills, rank }`.<br/>
  Persists WordPress player stats to the `player_profiles` table (PK: `user_id`).

- **load_player_profile** (`POST`)<br/>
  Request body: `{ user_id }`.<br/>
  Response: `{ status, profile: { user_id, email, first_name, last_name, kills, rank } }`.

- **save_guest_profile** (`POST`)<br/>
  Request body: `{ guest_id, email, first_name, kills, rank }`.<br/>
  Persists guest progress in the `guest_profiles` table (PK: `guest_id`).

- **load_guest_profile** (`POST`)<br/>
  Request body: `{ guest_id }`.<br/>
  Response: `{ status, profile: { guest_id, email, first_name, kills, rank } }`.

- **leaderboard** (`GET`)<br/>
  Response: `{ status: "success", leaderboard: [ { id, type, first_name, kills, rank } ] }`. The list should already be sorted + limited to 8 results; the client renders them as-is.

If an endpoint returns a non-2xx status or `status !== "success"`, the client logs the failure and falls back gracefully so gameplay can continue.

---

## Authentication Flow

The standalone build never renders a username/password form. Instead, the WordPress site launches the game with one of two URL parameters:

- `clownhunt_token` – identifies a logged-in WordPress user.
- `clownhunt_guest_token` – identifies a guest session.

On load the game:

1. Calls the matching WordPress validation endpoint listed above.
2. Uses the returned `user_id`/`guest_id` to fetch the latest stats from AWS.
3. Stores the combined profile in `localStorage`, auto-logging the player.

If no token is present, the game shows a message instructing the user to launch it from the main site.

---

## Asset Licenses

- `/public/clown.glb`, `/logos.glb` – in-house models (replace with your own if distributing).
- `/public/kloofendal_48d_partly_cloudy_puresky_4k.hdr` – from Poly Haven (CC0).
- Audio clips (`logo.mp3`, `single-shot.mp3`, `die.mp3`) – replace or credit according to original license.

Be sure you have the right to redistribute any assets you ship with the project.

---

## Contributing

Issues and pull requests are welcome! Please open an issue describing the bug/feature before submitting major changes. Run `npm run lint` and `npm run build` before pushing.

---

## License

License information is currently pending. All rights reserved unless otherwise noted. Asset licenses may differ – check the **Asset Licenses** section above.

Enjoy the hunt. 🎪🔫
