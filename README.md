# The Ayushi Invitational 🎾

A one-night Americano-style padel tournament web app for Ayushi's birthday.
Built with Next.js (App Router), Firebase (Auth + Firestore + Storage), Tailwind CSS v4, framer-motion, and way too much love.

## Features

- **Phone OTP login** — no passwords, no spam.
- **Onboarding** — name + selfie with Ayushi becomes your player badge.
- **Americano tournament engine** — schedule generator rotates partners round-to-round based on live standings; rest rotation is fair; scores flow into live player stats.
- **Mobile-first UI** — padel court palette (deep teal + turf green) with baby pink accents, large thumb-friendly targets, bottom nav, haptic-ish micro-animations.
- **Live leaderboard** with podium animation.
- **Memory Wall** — anyone can post photos + captions during the night; reactions with emojis.
- **For Ayushi** — a private feed of birthday messages from the group.
- **Predictions** — guess the champion, MVP, Ayushi's placement before tip-off.
- **Awards / Superlatives** — admin-created silly awards, plus auto "Most MVP votes".
- **Big screen mode** (`/bigscreen`) — gorgeous TV/projector view with live scores, leaderboard, rotating messages and memory strip.
- **Admin cockpit** — initialize tournament, generate each round, enter scores, promote admins, mark the birthday girl, reset, nuke.
- **Confetti** — on wins and key moments.

## Quick setup

### 1. Install

```bash
npm install
```

### 2. Firebase project

1. Create a Firebase project at <https://console.firebase.google.com>.
2. Enable **Authentication → Phone** sign-in method. Add your own number as a test number if you want to bypass SMS costs for dev.
3. Create a **Cloud Firestore** database (production mode is fine).
4. Create a **Storage** bucket (default).
5. In Project Settings → General → Your apps, add a **Web app** and copy the config.

### 3. Env vars

```bash
cp .env.local.example .env.local
# fill in your Firebase keys
```

Optional: override the countdown target with `NEXT_PUBLIC_EVENT_START_ISO`.

### 4. Security rules (optional during dev)

Firestore and Storage ship in **test mode** by default — fully open for ~30 days. That's fine for setup and the night of the event. Deploy the stricter rules before expiry (or before going public):

```bash
npm i -g firebase-tools
firebase login
firebase use --add   # pick the ayushi-invitational project, alias "default"
firebase deploy --only firestore:rules,storage
```

The hardened rules live in `firestore.rules` and `storage.rules` and use `firebase.json` at the repo root.

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, login with your phone, finish onboarding, then:

### 6. Make yourself admin

After you log in once, go to Firestore → `players/<your uid>` and set `isAdmin: true`.
From then on you can promote others from the in-app Admin panel (`/admin`).

## Running the night of

1. Everyone logs in via phone, adds name + selfie, writes a birthday message.
2. Admin goes to `/admin` → **Initialize tournament** → confirm courts (3), race-to points (24), total rounds (e.g. 7).
3. Admin taps **Generate round 1** → **Start round** once players are on court.
4. After each match, admin (or a trusted scorekeeper — anyone with `isAdmin`) enters scores from the **Score** tab (`/admin`). Non-admins can follow along live on `/schedule`.
5. Once all matches in a round are completed, admin hits **Generate next round** → algorithm produces balanced Americano pairings based on current standings.
6. When the last round finishes, admin hits **Finish tournament** → confetti storm.

## Tournament logic

The Americano algorithm is in `src/lib/americano.ts`:

- Each round, the 2 players with the fewest rests so far sit out. Ties are broken by preferring high-scorers to rest (gives the pack chances to catch up).
- Round 1 is randomized; every round after orders players by points and distributes them across courts in a round-robin, so each court has a spread of skill.
- Inside each 4-player court, teams are chosen from 3 permutations by preferring the one with fewest repeat partnerships so far.
- Points are individual — both teammates earn the team score.
- Rankings sort by points, then point differential.

## Project structure

```
src/
  app/                      routes (App Router)
    page.tsx                home / dashboard
    login/                  phone OTP
    onboarding/             name + selfie
    tournament/             live matches + score entry
    leaderboard/            podium + ranked list
    memories/               photo wall
    messages/               birthday messages for Ayushi
    predictions/            pre-tournament guesses
    awards/                 superlatives + MVP tally
    players/                roster & profiles
    schedule/               full schedule by round
    admin/                  admin cockpit
    bigscreen/              TV/projector view
  components/               shared UI (TopBar, BottomNav, Avatar, etc.)
  lib/
    firebase/               client, live query hooks, tournament actions
    americano.ts            scheduling algorithm
    hooks/useAuth.tsx       auth context
    eventConfig.ts          event-wide constants
    types.ts                shared types
    utils.ts                misc helpers
```

## Deployment (Vercel)

```bash
npm i -g vercel
vercel
```

Add the same env vars from `.env.local` to the Vercel project settings. Also:

1. In Firebase Authentication → Settings → **Authorized domains**, add your Vercel URL(s).
2. (Optional) Enable Firebase App Check with reCAPTCHA v3 for stronger abuse protection.

## Customization

- Colors live as CSS variables in `src/app/globals.css`. Swap `--pink-*`, `--turf-*`, `--court-*` to retheme without touching components.
- Event name, start time, max players, courts, default race-to points are in `src/lib/eventConfig.ts`.
- Fonts (Plus Jakarta Sans + Fraunces) live in `src/app/layout.tsx`.

Have the best night. 🎾✨
