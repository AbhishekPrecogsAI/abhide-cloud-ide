# abhide — abhishek's IDE, in your browser

A full-stack browser IDE powered by [WebContainers](https://webcontainers.io). Write code, run Node.js projects, see live previews, and use a real terminal — no VM, no server-side execution.

**Stack:** React + Vite · Express + Mongoose · MongoDB Atlas · JWT · @webcontainer/api · Monaco · xterm.js

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your MongoDB Atlas URI + JWT secret
npm run dev            # → http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev            # → http://localhost:5173
```

### 3. Use it

1. Register an account → create a project (React / Vanilla / Express / Empty)
2. The IDE opens — file tree on the left, Monaco editor in the middle, terminal below, preview on the right
3. Hit **▶ Run** — the terminal runs `npm install && npm run dev` inside the WebContainer
4. The preview iframe loads automatically when the dev server is ready
5. Edits auto-save (1.5s debounce) to MongoDB **and** to the WebContainer fs, so HMR just works

## Requirements & gotchas

- **Chromium browser** (Chrome / Edge / Brave) — WebContainer needs `SharedArrayBuffer`
- The page must be **cross-origin isolated** — `vite.config.js` already sets:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
- For production hosting, set the same headers (see `frontend/vercel.json`)
- MongoDB Atlas: whitelist your IP (or `0.0.0.0/0` for dev)

## Deployment (frontend → Vercel, backend → Render)

### 1. MongoDB Atlas (do this first)
1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Database Access → create a user · Network Access → allow `0.0.0.0/0`
3. Copy the connection string (`mongodb+srv://...`) — this is your `MONGODB_URI`

### 2. Backend on Render
1. Push this repo to GitHub
2. Render → **New → Web Service** → pick the repo
3. Settings: **Root Directory** `backend` · Build `npm install` · Start `node src/index.js`
4. Environment variables:
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas URI |
   | `JWT_SECRET` | long random string |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | your Vercel URL (add after step 3) |
   | `NODE_ENV` | `production` |
5. Deploy → note the URL, e.g. `https://abhide-backend.onrender.com`
   (Render supports WebSockets out of the box — collab/voice signaling work as-is.
   Alternatively, use the included `render.yaml` as a Blueprint.)

### 3. Frontend on Vercel
1. Vercel → **Add New → Project** → pick the repo
2. **Root Directory** `frontend` (framework auto-detects Vite)
3. Deploy. `vercel.json` already sets the **COOP/COEP headers** WebContainer needs
   and the SPA fallback — no extra config.
4. Go back to Render and set `CLIENT_URL` to your exact Vercel URL
   (e.g. `https://abhide.vercel.app`, no trailing slash) so CORS allows it.

### Gotchas
- **Render free tier sleeps** after ~15 min idle: first request takes ~30s and
  live WS connections drop on spin-down. Fine for demos.
- CORS errors → `CLIENT_URL` doesn't exactly match the browser origin.
- WebSockets upgrade to `wss://` automatically (derived from `VITE_API_URL`).
- Voice chat needs HTTPS — both platforms give you that for free.

## API

| Method | Route | Auth | Body |
|--------|-------|------|------|
| POST | `/api/auth/register` | — | `{ username, email, password }` |
| POST | `/api/auth/login` | — | `{ email, password }` |
| GET | `/api/auth/me` | ✓ | — |
| GET | `/api/projects` | ✓ | — |
| POST | `/api/projects` | ✓ | `{ name, description, template }` |
| GET | `/api/projects/:id` | ✓ | — |
| PUT | `/api/projects/:id` | ✓ | `{ name, description, isPublic, lastOpenedFile }` |
| DELETE | `/api/projects/:id` | ✓ | — |
| PUT | `/api/files/:projectId/save` | ✓ | `{ path, content }` |
| POST | `/api/files/:projectId` | ✓ | `{ name, type, path }` |
| DELETE | `/api/files/:projectId` | ✓ | `{ path }` |
