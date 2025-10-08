# Clown Hunt FPS

Wave-based arena shooter where you battle an endless parade of murderous clowns, collect weapon upgrades, and climb the leaderboard. Built with React, Vite, and the React Three Fiber ecosystem.

---

## Key Features

- **Futuristic arena** – Reflective black floor, space HDR lighting, and moody fog for a cinematic feel.
- **Procedural terrain** – Heightfield-aware physics keeps movement smooth across rolling hills.
- **Wave system** – Increasingly aggressive clowns spawn every round with escalating health and speed.
- **Power logos** – Collect logos each wave to unlock higher-tier weapons and damage bonuses.
- **Reactive HUD** – In-game notifications, scoreboard, and minimal UI that responds to events.
- **Leaderboards & profiles** – Supabase-backed authentication supports players and guests, tracking kills and ranking.
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
- **Backend:** Supabase (auth, profiles, leaderboards)
- **Tooling:** ESLint, npm scripts, Vite build pipeline

---

## Project Structure

```
├── public/                     # Static assets (HDR, GLBs, audio)
├── src/
│   ├── components/             # R3F scene objects, UI overlays, gameplay entities
│   ├── config/                 # Gameplay tuning constants, weapon data
│   ├── css/                    # Component-scoped stylesheets
│   ├── store/                  # Zustand game store + Supabase helpers
│   └── main.tsx                # App bootstrap
├── .env                        # Environment variables (Supabase keys, etc.)
├── vite.config.ts              # Vite + bundler configuration
└── README.md
```

---

## Requirements

- Node.js ≥ 18.0
- npm ≥ 9 (bundled with Node 18+)
- Supabase project with:
  - `player_stats` table
  - `guest_profiles` table
  - RLS configured to allow anon access via the anon key used by the app

---

## Getting Started

1. **Clone & install**
   ```bash
   git clone https://github.com/your-org/clown-hunt.git
   cd clown-hunt
   npm install
   ```

2. **Configure environment**

   Create a `.env` file at the project root (or copy from `.env.example`) with your Supabase project keys:
   ```ini
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
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

## Supabase Tables (Expected Shape)

`player_stats`
```sql
user_id uuid,
first_name text,
last_name text,
kills int,
player_rank int,
created_at timestamptz
```

`guest_profiles`
```sql
id uuid,
email text,
display_name text,
kills int,
player_rank int
```

See `src/store/SupabasePlayerStats.ts`, `SupabaseGuestProfiles.ts`, and `SupabaseLeaderboard.ts` for exact queries and update flows.

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
