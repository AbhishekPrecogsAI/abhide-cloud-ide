# AGENTS.md — WebIDE (WebContainer-based Online IDE)

## Project Overview

A full-stack browser-based IDE powered by WebContainers. Users can write code, run Node.js projects, see live previews, and use a real terminal — all inside the browser. No VM, no server-side code execution.

**Stack:** React + Vite (frontend) · Express + Mongoose (backend) · MongoDB Atlas (DB) · JWT auth · @webcontainer/api · Monaco Editor · xterm.js

---

## Repository Structure

```
webide/
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express server entry
│   │   ├── models/
│   │   │   ├── User.js           ← Mongoose user model
│   │   │   └── Project.js        ← Mongoose project model (nested files)
│   │   ├── routes/
│   │   │   ├── auth.js           ← /api/auth (register, login, me)
│   │   │   ├── projects.js       ← /api/projects CRUD
│   │   │   └── files.js          ← /api/files/:projectId (save, create, delete)
│   │   ├── middleware/
│   │   │   └── auth.js           ← JWT protect middleware
│   │   └── lib/
│   │       └── templates.js      ← Starter file templates (vanilla/react/express/empty)
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── index.html
    ├── vite.config.js            ← COOP/COEP headers (required for WebContainer)
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx               ← Routes (Login, Register, Dashboard, IDE)
        ├── index.css
        ├── store/
        │   ├── authStore.js      ← Zustand + persist (JWT + user)
        │   └── ideStore.js       ← Zustand (files, tabs, WC instance, preview URL)
        ├── lib/
        │   ├── api.js            ← Axios instance + JWT interceptor + 401 redirect
        │   └── webcontainer.js   ← Boot singleton + flat→tree converter
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── Dashboard.jsx     ← Project list + create modal
        │   └── IDE.jsx           ← Main IDE layout + WC init
        └── components/
            ├── Layout/
            │   └── TopBar.jsx    ← Project name, save status, Run button
            ├── FileTree/
            │   └── FileTree.jsx  ← File explorer with create/delete
            ├── Editor/
            │   └── EditorPanel.jsx ← Monaco + tabs + auto-save
            ├── Preview/
            │   └── Preview.jsx   ← iframe live preview
            └── Terminal/
                └── TerminalPanel.jsx ← xterm.js + WC shell
```

---

## Environment Setup

### Backend `.env`
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/webide?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### Frontend `.env`
```env
VITE_API_URL=http://localhost:5000/api
```

---

## Critical Requirement — Cross-Origin Isolation

`@webcontainer/api` REQUIRES these HTTP headers on the page that boots WebContainer:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

These are already set in `vite.config.js` for development. For production deployment (Vercel/Netlify), add them as custom headers.

**Without these headers, WebContainer will throw an error and refuse to boot.**

---

## API Reference

### Auth Routes (`/api/auth`)

| Method | Route | Body | Auth | Response |
|--------|-------|------|------|----------|
| POST | `/register` | `{ username, email, password }` | ❌ | `{ token, user }` |
| POST | `/login` | `{ email, password }` | ❌ | `{ token, user }` |
| GET | `/me` | — | ✅ | `{ user }` |

### Project Routes (`/api/projects`) — All Protected

| Method | Route | Body | Response |
|--------|-------|------|----------|
| GET | `/` | — | `{ projects }` (no file contents) |
| POST | `/` | `{ name, description, template }` | `{ project }` |
| GET | `/:id` | — | `{ project }` (with files) |
| PUT | `/:id` | `{ name, description, isPublic, lastOpenedFile }` | `{ project }` |
| DELETE | `/:id` | — | `{ message }` |

### File Routes (`/api/files`) — All Protected

| Method | Route | Body | Response |
|--------|-------|------|----------|
| PUT | `/:projectId/save` | `{ path, content }` | `{ message, path }` |
| POST | `/:projectId` | `{ name, type, path }` | `{ message, path }` |
| DELETE | `/:projectId` | `{ path }` | `{ message, path }` |

---

## Data Models

### User
```javascript
{
  username: String,      // unique, 3-30 chars
  email: String,         // unique, lowercase
  password: String,      // bcrypt hashed (pre-save hook)
  avatar: String,        // optional
  createdAt, updatedAt
}
```

### Project
```javascript
{
  name: String,
  description: String,
  owner: ObjectId,       // ref: User
  template: String,      // 'vanilla' | 'react' | 'express' | 'empty'
  files: [FileSchema],   // flat array — see below
  lastOpenedFile: String,
  isPublic: Boolean,
  createdAt, updatedAt
}
```

### FileSchema (embedded in Project)
```javascript
{
  name: String,          // 'App.jsx'
  type: String,          // 'file' | 'folder'
  content: String,       // file content (empty for folders)
  language: String,      // 'javascript' | 'css' | etc.
  path: String,          // '/src/App.jsx' — always starts with /
}
```

**Note:** Files stored as flat array in DB. Frontend builds tree structure for display. WebContainer needs nested tree — use `filesToWebContainerTree()`.

---

## WebContainer Flow

```
1. IDE.jsx mounts
       │
       ▼
2. Fetch project from backend (GET /api/projects/:id)
       │
       ▼
3. bootWebContainer() — singleton boot (only once per page)
       │
       ▼
4. filesToWebContainerTree(files) — convert flat DB array to WC format
       │
       ▼
5. wc.mount(tree) — load files into WC virtual filesystem
       │
       ▼
6. User clicks Run → spawn('npm', ['install']) → spawn('npm', ['run', 'dev'])
       │
       ▼
7. wc.on('server-ready', (port, url) => setPreviewUrl(url))
       │
       ▼
8. Preview iframe src = url
       │
       ▼
9. User edits file → Monaco onChange → debounce 1500ms
       │
       ▼
10. api.put('/files/:id/save') → save to MongoDB
    wc.fs.writeFile(path, content) → update WC filesystem (hot reload)
```

---

## State Management

### authStore (Zustand + persist)
```javascript
{
  user: null | UserObject,
  token: null | string,
  login(email, password),
  register(username, email, password),
  logout()
}
// Persisted to localStorage as 'webide-auth'
```

### ideStore (Zustand — not persisted)
```javascript
{
  project,              // current project object
  files,                // flat file array
  openTabs,             // array of open file paths
  activeTab,            // currently active file path
  webcontainerInstance, // WC singleton
  previewUrl,           // iframe src
  saveStatus,           // 'saved' | 'saving' | 'unsaved'

  // Actions
  openFile(path),
  closeTab(path),
  updateFileContent(path, content),
  getFile(path),
  setWebcontainer(wc),
  setPreviewUrl(url),
  setSaveStatus(status)
}
```

---

## File Tree Logic

Files stored flat in MongoDB:
```javascript
[
  { path: '/index.html', type: 'file', ... },
  { path: '/src', type: 'folder', ... },
  { path: '/src/main.jsx', type: 'file', ... },
  { path: '/src/App.jsx', type: 'file', ... },
]
```

`FileTree.jsx` builds nested tree for display using parent path matching:
- Parent path = everything before last `/`
- Root items have parent path `/`

WebContainer needs different nested format — `filesToWebContainerTree()` in `lib/webcontainer.js` handles conversion.

---

## Auto-Save Logic

- Monaco `onChange` fires on every keystroke
- `setSaveStatus('unsaved')` immediately
- Debounce timer (1500ms) resets on each change
- After 1500ms silence:
  1. `setSaveStatus('saving')`
  2. `api.put('/files/:id/save', { path, content })`
  3. `wc.fs.writeFile(path, content)` — updates WC so HMR triggers
  4. `setSaveStatus('saved')`

---

## Templates

Available in `backend/src/lib/templates.js`:

| Template | Files |
|----------|-------|
| `vanilla` | index.html, index.js, style.css |
| `react` | package.json, vite.config.js, index.html, src/main.jsx, src/App.jsx, src/index.css |
| `express` | package.json, index.js |
| `empty` | README.md |

---

## Design System

### Colors (Tailwind custom tokens)
```
surface-0: #0a0a0c  ← deepest bg, body
surface-1: #111114  ← sidebar, topbar
surface-2: #17171b  ← cards, panels
surface-3: #1e1e24  ← hover states
surface-4: #26262e  ← active states

accent: #6ee7b7     ← mint green, CTAs
border: #ffffff12   ← subtle borders
```

### Fonts
- UI: `DM Sans` (loaded from Google Fonts in index.html)
- Code/Mono: `JetBrains Mono` (editor, terminal, file names, paths)

### IDE Layout
```
┌────────────────────────────────────────────────────────┐
│  TopBar (40px) — logo / project name / save / run      │
├──────────┬─────────────────────────────┬───────────────┤
│          │                             │               │
│ FileTree │   Monaco Editor             │   Preview     │
│  (224px) │   (flex-1)                  │   (384px)     │
│          │                             │               │
│          ├─────────────────────────────┤               │
│          │   Terminal (208px)          │               │
└──────────┴─────────────────────────────┴───────────────┘
```

---

## Implementation Order for Claude Code

### Phase 1 — Backend

1. `cd backend && npm install`
2. Copy `.env.example` → `.env`, fill in MongoDB Atlas URI
3. Verify `src/index.js` starts correctly: `npm run dev`
4. Test auth routes with curl:
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"username":"abhi","email":"a@b.com","password":"123456"}'
   ```
5. Test project creation:
   ```bash
   curl -X POST http://localhost:5000/api/projects \
     -H 'Authorization: Bearer <token>' \
     -H 'Content-Type: application/json' \
     -d '{"name":"My App","template":"react"}'
   ```

### Phase 2 — Frontend Setup

1. `cd frontend && npm install`
2. Create `.env` with `VITE_API_URL=http://localhost:5000/api`
3. `npm run dev`
4. Verify Login → Register → Dashboard flow works

### Phase 3 — IDE Features

1. Verify WebContainer boots (check browser console — no COOP/COEP errors)
2. Create a React project from Dashboard
3. Open IDE — file tree should show React template files
4. Open `src/App.jsx` in editor
5. Click Run — terminal should show `npm install` then `vite` starting
6. Preview iframe should show React app
7. Edit code — verify auto-save works (save status indicator)

---

## Common Issues & Fixes

### WebContainer won't boot
- Check browser console for `SharedArrayBuffer` errors
- Verify vite.config.js has both COOP and COEP headers
- Only works in Chromium browsers (Chrome, Edge, Brave) — Firefox has issues

### Preview not loading
- WebContainer `server-ready` event fires after `npm run dev`
- Must run `npm install` first before `npm run dev`
- Check terminal for errors

### Files not persisting
- Verify MongoDB Atlas connection string is correct
- Check Atlas IP Whitelist — add `0.0.0.0/0` for dev

### Monaco not rendering
- Usually a CSS height issue — parent must have explicit height
- `EditorPanel` uses `height="100%"` — ensure parent flex is set correctly

### xterm blank/not attaching
- WebContainer must be fully booted before spawning `jsh`
- `jsh` is WebContainer's built-in shell — always use this, not `bash`

---

## Production Deployment Notes

### Backend (Railway / Render free tier)
- Set all env vars in dashboard
- Add `NODE_ENV=production`

### Frontend (Vercel / Netlify)
- Set `VITE_API_URL` to production backend URL
- **Critical:** Add custom headers for COOP/COEP:
  ```
  # vercel.json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
        ]
      }
    ]
  }
  ```

---

## V2 Ideas

- [ ] Collaborative editing (WebSockets + operational transform)
- [ ] AI code assistant (Claude API — user provides own key)
- [ ] Project sharing (public URLs)
- [ ] Multiple terminal tabs
- [ ] Git integration (isomorphic-git in WebContainer)
- [ ] More templates (Next.js, TypeScript, Tailwind)
- [ ] Split editor panes
- [ ] Search across files
