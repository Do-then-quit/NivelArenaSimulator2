# Online Multiplayer (Room Code) MVP

## Overview

This project now supports remote PvP with a room-code flow:

1. Host creates a room and receives a 6-digit code.
2. Guest joins using the code.
3. Both players submit a deck in the lobby and press `Ready`.
4. When both are ready, the match starts.
5. After match end, both return to the same room lobby with ready states reset.

Current MVP model is **host-authoritative client sync**:

- Relay server handles room/session/event forwarding only.
- Host client validates/applies game actions.
- Full game state exists on both clients (UI still hides hidden info).

## Local Run

### 1) Start relay server

```bash
npm run relay:dev
```

Default port is `8787`.

### 2) Start web client

```bash
npm run dev
```

By default, client connects to `ws://localhost:8787`.

## Environment Variables

Client uses `VITE_ONLINE_WS_URL`:

```bash
VITE_ONLINE_WS_URL=ws://localhost:8787 npm run dev
```

Relay server uses `PORT`:

```bash
PORT=8787 npm run relay:start
```

## Internet Deployment Notes

1. Deploy relay server and static frontend separately.
2. Expose relay with a public `wss://` endpoint behind reverse proxy (TLS).
3. Set frontend env `VITE_ONLINE_WS_URL` to that public `wss://` URL.
4. Keep sticky logs on relay for incident replay:
   - room code
   - event type
   - match session id
   - action seq

## Recommended Setup: Vercel + Render Free

This repository is ready for the split deployment below:

- Frontend: Vercel
- Relay server: Render Free (`npm start` -> `server/index.ts`)

### Render relay deploy

1. Create a new **Web Service** on Render from this repository.
2. Use these commands:
   - Build Command: `npm ci`
   - Start Command: `npm start`
3. Keep instance count at 1 (room state is in-memory).
4. After deploy, copy the public URL and convert to `wss://...`.

Example:

- Render URL: `https://nivelarena-relay.onrender.com`
- WebSocket URL to use in frontend: `wss://nivelarena-relay.onrender.com`

### Vercel frontend env

Set `VITE_ONLINE_WS_URL` in Vercel project settings, then redeploy:

```text
VITE_ONLINE_WS_URL=wss://<your-render-domain>
```

### Post-deploy smoke test

1. Open frontend in two browsers/devices.
2. Host creates room and shares 6-digit code.
3. Guest joins.
4. Both submit valid deck and press Ready.
5. Verify match start and action sync on both clients.

## MVP Limitations

- No account/authentication (anonymous player names only).
- Room state is in-memory (lost on relay restart).
- No spectator mode.
- No reconnect/host migration.
- Anti-cheat resistance is low by design for this phase.
